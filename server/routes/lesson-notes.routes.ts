import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { storage } from '../storage';
import { authenticateUser, authorizeRoles, ROLES } from './middleware';
import { generateLessonNoteContent, streamGenerateLessonNote, getAIConfig } from '../services/ai-service';
import {
  buildImagePrompt,
  generateImage,
  saveGeneratedImage,
  getActiveImageProvider,
  getActiveImagePromptTemplate,
} from '../services/cloudflare-ai-service';

const router = Router();

// ─── In-memory AI generation job store ───────────────────────────────────────
type JobStatus = 'pending' | 'done' | 'error';
interface GenerationJob {
  status: JobStatus;
  result?: { sections: any; provider: string; model: string };
  error?: string;
  createdAt: number;
}
const aiJobs = new Map<string, GenerationJob>();

// Expire jobs older than 10 minutes to prevent memory leaks
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [id, job] of aiJobs) {
    if (job.createdAt < cutoff) aiJobs.delete(id);
  }
}, 60 * 1000);

function getUser(req: Request) {
  return (req as any).user as { id: string; roleId: number };
}

const ADMIN_ROLES = [ROLES.ADMIN, ROLES.SUPER_ADMIN];
const ALL_STAFF   = [ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.TEACHER];

// ─── GET /stats  (admin only) ───────────────────────────────────────────────
router.get('/stats', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    res.json(await storage.getLessonNotesStats());
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ─── GET /  (admin sees all enriched; teacher sees own enriched) ─────────────
router.get('/', authenticateUser, authorizeRoles(...ALL_STAFF), async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const isTeacher = user.roleId === ROLES.TEACHER;
    const filters: any = {};
    if (req.query.classId)   filters.classId   = parseInt(req.query.classId as string);
    if (req.query.subjectId) filters.subjectId = parseInt(req.query.subjectId as string);
    if (req.query.termId)    filters.termId    = parseInt(req.query.termId as string);
    if (req.query.status)    filters.status    = req.query.status as string;
    if (isTeacher) filters.createdBy = user.id;
    const notes = await storage.getLessonNotesEnriched(filters);
    res.json(notes);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ─── GET /by-topic/:topicId  (student=published only; staff=any) ────────────
router.get('/by-topic/:topicId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const isStudent = user.roleId === ROLES.STUDENT;
    const note = await storage.getLessonNoteByTopicId(parseInt(req.params.topicId), isStudent);
    if (!note) return res.status(404).json({ message: 'No lesson note for this topic' });
    res.json(note);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ─── GET /:id  (admin=any; teacher=own) ─────────────────────────────────────
router.get('/:id', authenticateUser, authorizeRoles(...ALL_STAFF), async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const note = await storage.getLessonNoteById(parseInt(req.params.id));
    if (!note) return res.status(404).json({ message: 'Lesson note not found' });
    if (user.roleId === ROLES.TEACHER && note.createdBy !== user.id)
      return res.status(403).json({ message: 'Access denied' });
    res.json(note);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ─── POST /  (teacher or admin creates) ──────────────────────────────────────
router.post('/', authenticateUser, authorizeRoles(...ALL_STAFF), async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { topicId, classId, subjectId, termId, title, content, objectives, attachmentUrl, attachmentName } = req.body;
    if (!topicId || !classId || !subjectId || !termId || !title)
      return res.status(400).json({ message: 'topicId, classId, subjectId, termId, and title are required' });
    // One note per topic — if exists return it so UI can redirect
    const existing = await storage.getLessonNoteByTopicId(parseInt(topicId));
    if (existing) return res.status(409).json({ message: 'A lesson note already exists for this topic', existingId: existing.id });
    const note = await storage.createLessonNote({
      topicId: parseInt(topicId), classId: parseInt(classId),
      subjectId: parseInt(subjectId), termId: parseInt(termId),
      title, content, objectives, attachmentUrl, attachmentName,
      status: 'draft', createdBy: user.id,
    });
    res.status(201).json(note);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ─── PATCH /:id/hidden-sections  (teacher=own or admin toggles section visibility) ─
router.patch('/:id/hidden-sections', authenticateUser, authorizeRoles(...ALL_STAFF), async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const note = await storage.getLessonNoteById(parseInt(req.params.id));
    if (!note) return res.status(404).json({ message: 'Lesson note not found' });
    if (user.roleId === ROLES.TEACHER && note.createdBy !== user.id)
      return res.status(403).json({ message: 'Access denied' });
    const { hiddenSections } = req.body;
    if (!Array.isArray(hiddenSections))
      return res.status(400).json({ message: 'hiddenSections must be an array of section keys' });
    const updated = await storage.updateLessonNote(note.id, { hiddenSections } as any);
    res.json(updated);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ─── POST /generate/start  (kick off AI generation — returns jobId immediately)
router.post('/generate/start', authenticateUser, authorizeRoles(...ALL_STAFF), async (req: Request, res: Response) => {
  try {
    const { topic, className, subjectName, termName, duration = '40 minutes' } = req.body;
    if (!topic) return res.status(400).json({ message: 'topic is required' });

    const config = await getAIConfig();
    if (!config.features.lessonNotes) {
      return res.status(403).json({ message: 'AI lesson note generation is currently disabled by the administrator.' });
    }
    if (!config.apiKey) {
      return res.status(400).json({
        message: `No API key configured for provider "${config.provider}". Go to AI Configuration → Providers and add your key.`,
        aiError: 'no_api_key',
      });
    }

    // Create a job record and start generation in the background
    const jobId = randomUUID();
    aiJobs.set(jobId, { status: 'pending', createdAt: Date.now() });

    // Fire and forget — do NOT await
    generateLessonNoteContent({
      topic,
      className:   className   || 'Secondary School',
      subjectName: subjectName || 'General',
      termName:    termName    || 'First Term',
      duration,
    }).then(result => {
      aiJobs.set(jobId, { status: 'done', result, createdAt: Date.now() });
    }).catch(err => {
      console.error('[AI Generation] Failed:', err.message);
      aiJobs.set(jobId, { status: 'error', error: err.message || 'Unknown AI error', createdAt: Date.now() });
    });

    return res.json({ jobId });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ─── GET /generate/poll/:jobId  (poll for job result) ────────────────────────
router.get('/generate/poll/:jobId', authenticateUser, authorizeRoles(...ALL_STAFF), (req: Request, res: Response) => {
  const job = aiJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ message: 'Job not found or expired.' });

  if (job.status === 'pending') return res.json({ status: 'pending' });

  if (job.status === 'error') {
    aiJobs.delete(req.params.jobId);
    return res.status(400).json({ status: 'error', message: `AI generation failed: ${job.error}` });
  }

  // Done — return result and clean up
  aiJobs.delete(req.params.jobId);
  return res.json({ status: 'done', ...job.result });
});

// ─── POST /generate/stream-live  (SSE — pipes AI tokens directly to browser) ───
router.post('/generate/stream-live', authenticateUser, authorizeRoles(...ALL_STAFF), async (req: Request, res: Response) => {
  const { topic, className, subjectName, termName, duration = '40 minutes' } = req.body;

  if (!topic) return res.status(400).json({ message: 'topic is required' });

  try {
    const config = await getAIConfig();
    if (!config.features.lessonNotes) {
      return res.status(403).json({ message: 'AI lesson note generation is currently disabled by the administrator.' });
    }
    if (!config.apiKey) {
      return res.status(400).json({
        message: `No API key configured for provider "${config.provider}". Go to AI Configuration → Providers and add your key.`,
        aiError: 'no_api_key',
      });
    }
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }

  // Switch to SSE mode
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx/Replit proxy buffering
  res.flushHeaders();

  let closed = false;
  req.on('close', () => { closed = true; });

  const send = (payload: object) => {
    if (!closed && !res.writableEnded) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      // Flush the compression middleware buffer so every token reaches the
      // browser immediately instead of being held until the stream ends.
      (res as any).flush?.();
    }
  };

  try {
    const result = await streamGenerateLessonNote(
      { topic, className: className || 'Secondary School', subjectName: subjectName || 'General', termName: termName || 'First Term', duration },
      (text) => send({ t: text }),
    );
    send({ done: true, sections: result.sections, provider: result.provider, model: result.model, tokensUsed: result.tokensUsed });
  } catch (err: any) {
    console.error('[AI Streaming] Failed:', err.message);
    send({ error: err.message || 'AI generation failed.' });
  } finally {
    if (!res.writableEnded) res.end();
  }
});

// ─── POST /generate  (legacy — kept for backwards compat, now uses job pattern internally) ─
router.post('/generate', authenticateUser, authorizeRoles(...ALL_STAFF), async (req: Request, res: Response) => {
  return res.status(410).json({ message: 'This endpoint has been replaced. Please refresh the page.' });
});

// ─── PUT /:id  (teacher=own draft/rejected; admin=any) ───────────────────────
router.put('/:id', authenticateUser, authorizeRoles(...ALL_STAFF), async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const isTeacher = user.roleId === ROLES.TEACHER;
    const note = await storage.getLessonNoteById(parseInt(req.params.id));
    if (!note) return res.status(404).json({ message: 'Lesson note not found' });
    if (isTeacher) {
      if (note.createdBy !== user.id) return res.status(403).json({ message: 'Access denied' });
      if (!['draft', 'rejected'].includes(note.status))
        return res.status(400).json({ message: 'You can only edit draft or rejected notes' });
    }
    const { title, content, objectives, attachmentUrl, attachmentName } = req.body;
    const updated = await storage.updateLessonNote(note.id, { title, content, objectives, attachmentUrl, attachmentName });
    res.json(updated);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ─── DELETE /:id  (teacher=own draft; admin=any) ─────────────────────────────
router.delete('/:id', authenticateUser, authorizeRoles(...ALL_STAFF), async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const isTeacher = user.roleId === ROLES.TEACHER;
    const note = await storage.getLessonNoteById(parseInt(req.params.id));
    if (!note) return res.status(404).json({ message: 'Lesson note not found' });
    if (isTeacher) {
      if (note.createdBy !== user.id) return res.status(403).json({ message: 'Access denied' });
      if (note.status !== 'draft') return res.status(400).json({ message: 'You can only delete draft notes' });
    }
    await storage.deleteLessonNote(note.id);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ─── POST /:id/submit  (teacher submits; admin can submit any) ───────────────
router.post('/:id/submit', authenticateUser, authorizeRoles(...ALL_STAFF), async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const isTeacher = user.roleId === ROLES.TEACHER;
    const note = await storage.getLessonNoteById(parseInt(req.params.id));
    if (!note) return res.status(404).json({ message: 'Lesson note not found' });
    if (isTeacher && note.createdBy !== user.id)
      return res.status(403).json({ message: 'Access denied' });
    if (!['draft', 'rejected'].includes(note.status))
      return res.status(400).json({ message: 'Only draft or rejected notes can be submitted' });
    const updated = await storage.updateLessonNote(note.id, {
      status: 'submitted', submittedBy: user.id, submittedAt: new Date(), rejectionReason: null as any,
    });
    res.json(updated);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ─── POST /:id/approve  (admin approves from submitted or draft) ─────────────
router.post('/:id/approve', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const note = await storage.getLessonNoteById(parseInt(req.params.id));
    if (!note) return res.status(404).json({ message: 'Lesson note not found' });
    if (note.status === 'published') return res.status(400).json({ message: 'Note is already published' });
    if (note.status === 'approved')  return res.status(400).json({ message: 'Note is already approved' });
    // Admin can approve from draft, submitted, or rejected
    const updated = await storage.updateLessonNote(note.id, {
      status: 'approved', approvedBy: user.id, approvedAt: new Date(), rejectionReason: null as any,
      submittedBy: note.submittedBy ?? user.id, submittedAt: note.submittedAt ?? new Date(),
    });
    res.json(updated);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ─── POST /:id/reject  (admin rejects) ───────────────────────────────────────
router.post('/:id/reject', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const note = await storage.getLessonNoteById(parseInt(req.params.id));
    if (!note) return res.status(404).json({ message: 'Lesson note not found' });
    if (['draft', 'rejected', 'archived'].includes(note.status))
      return res.status(400).json({ message: 'Cannot reject a draft or already-rejected note' });
    const { reason } = req.body;
    const updated = await storage.updateLessonNote(note.id, {
      status: 'rejected', rejectedBy: user.id, rejectedAt: new Date(),
      rejectionReason: reason?.trim() || 'No reason provided',
    });
    res.json(updated);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ─── POST /:id/publish  (admin publishes approved note) ──────────────────────
router.post('/:id/publish', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const note = await storage.getLessonNoteById(parseInt(req.params.id));
    if (!note) return res.status(404).json({ message: 'Lesson note not found' });
    if (note.status !== 'approved') return res.status(400).json({ message: 'Only approved notes can be published' });
    const updated = await storage.updateLessonNote(note.id, {
      status: 'published', publishedBy: user.id, publishedAt: new Date(),
    });
    res.json(updated);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ─── POST /:id/unpublish  (admin unpublishes back to approved) ───────────────
router.post('/:id/unpublish', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const note = await storage.getLessonNoteById(parseInt(req.params.id));
    if (!note) return res.status(404).json({ message: 'Lesson note not found' });
    if (note.status !== 'published') return res.status(400).json({ message: 'Only published notes can be unpublished' });
    const updated = await storage.updateLessonNote(note.id, { status: 'approved', publishedAt: null as any, publishedBy: null as any });
    res.json(updated);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ─── POST /:id/approve-publish  (admin approves + immediately publishes) ─────
router.post('/:id/approve-publish', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const note = await storage.getLessonNoteById(parseInt(req.params.id));
    if (!note) return res.status(404).json({ message: 'Lesson note not found' });
    if (note.status === 'published') return res.status(400).json({ message: 'Already published' });
    const updated = await storage.updateLessonNote(note.id, {
      status: 'published',
      approvedBy: user.id, approvedAt: new Date(),
      publishedBy: user.id, publishedAt: new Date(),
      submittedBy: note.submittedBy ?? user.id, submittedAt: note.submittedAt ?? new Date(),
      rejectionReason: null as any,
    });
    res.json(updated);
  } catch (err: any) { res.status(500).json({ message: err.message }); }
});

// ─── POST /generate-image  (System AI — uses active provider from settings) ────
// Generates a diagram image using the configured system AI provider (Cloudflare
// or NVIDIA) and saves it to local/cloud storage. No note ID required.
router.post('/generate-image', authenticateUser, authorizeRoles(...ALL_STAFF), async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'prompt required' });

    const enhancedPrompt = `${prompt}, educational textbook diagram, white background, clear labels, scientific illustration, clean, professional, high quality`;

    const activeProvider = await getActiveImageProvider();
    console.log(`[generate-image] provider=${activeProvider} prompt="${prompt.slice(0, 60)}"`);

    const { buffer, provider, model } = await generateImage(enhancedPrompt);
    const imageUrl = await saveGeneratedImage(buffer, `diagram-${Date.now()}`);

    console.log(`[generate-image] saved via ${provider} (${model}): ${imageUrl}`);
    return res.json({ imageUrl, provider, model });
  } catch (err: any) {
    console.error('[generate-image] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /:id/generate-image-cf  (AI image generation — Cloudflare or NVIDIA) ─
// Unified endpoint: dispatches to Cloudflare or NVIDIA based on the active
// imageProvider setting. Saves the PNG and stores the URL on the lesson note.
router.post('/:id/generate-image-cf', authenticateUser, authorizeRoles(...ALL_STAFF), async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const noteId = parseInt(req.params.id);
    const note = await storage.getLessonNoteById(noteId);
    if (!note) return res.status(404).json({ error: 'Lesson note not found' });

    if (user.roleId === ROLES.TEACHER && note.createdBy !== user.id)
      return res.status(403).json({ error: 'Access denied' });

    // Build prompt
    const { prompt: customPrompt, subject, className } = req.body;
    const topic = note.title;
    const promptTemplate = await getActiveImagePromptTemplate();
    const prompt = customPrompt || buildImagePrompt(promptTemplate, { topic, subject, className });

    const activeProvider = await getActiveImageProvider();
    console.log(`[Image AI] Generating for note ${noteId}, provider: ${activeProvider}, prompt: "${prompt.slice(0, 80)}"`);

    const { buffer, provider, model } = await generateImage(prompt);
    const imageUrl = await saveGeneratedImage(buffer, noteId);

    await storage.updateLessonNote(noteId, {
      aiImageUrl: imageUrl,
      aiImagePrompt: prompt,
    });

    console.log(`[Image AI] Saved for note ${noteId} via ${provider}: ${imageUrl}`);
    return res.json({ imageUrl, prompt, model, provider });
  } catch (err: any) {
    console.error('[Image AI] generation error:', err.message);
    return res.status(500).json({ error: err.message || 'Image generation failed' });
  }
});

// ─── POST /generate-image-cf/preview  (admin preview — no DB save) ───────────
router.post('/generate-image-cf/preview', authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const { prompt, subject, className, topic, provider: providerOverride } = req.body;
    const promptTemplate = await getActiveImagePromptTemplate();
    const finalPrompt = prompt ||
      buildImagePrompt(promptTemplate, {
        topic: topic || 'sample educational topic',
        subject,
        className,
      });

    const { buffer, provider, model } = await generateImage(finalPrompt, providerOverride);
    const imageUrl = await saveGeneratedImage(buffer, `preview-${Date.now()}`);

    return res.json({ imageUrl, prompt: finalPrompt, model, provider });
  } catch (err: any) {
    console.error('[Image AI] preview error:', err.message);
    return res.status(500).json({ error: err.message || 'Image generation failed' });
  }
});

// ─── GET /:id/image  (retrieve the stored AI image URL for a lesson note) ──────
router.get('/:id/image', authenticateUser, async (req: Request, res: Response) => {
  try {
    const note = await storage.getLessonNoteById(parseInt(req.params.id));
    if (!note) return res.status(404).json({ error: 'Lesson note not found' });
    if (!note.aiImageUrl) return res.status(404).json({ error: 'No AI image for this lesson note' });
    return res.json({ imageUrl: note.aiImageUrl, prompt: note.aiImagePrompt });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /:id/image  (remove AI image from a lesson note) ─────────────────
router.delete('/:id/image', authenticateUser, authorizeRoles(...ALL_STAFF), async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const note = await storage.getLessonNoteById(parseInt(req.params.id));
    if (!note) return res.status(404).json({ error: 'Lesson note not found' });
    if (user.roleId === ROLES.TEACHER && note.createdBy !== user.id)
      return res.status(403).json({ error: 'Access denied' });

    await storage.updateLessonNote(note.id, { aiImageUrl: null as any, aiImagePrompt: null as any });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
