import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { authenticateUser, authorizeRoles, ROLES } from './middleware';
import { generateLessonNoteContent, getAIConfig } from '../services/ai-service';

const router = Router();

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

// ─── POST /generate  (AI-powered lesson note content generation) ─────────────
router.post('/generate', authenticateUser, authorizeRoles(...ALL_STAFF), async (req: Request, res: Response) => {
  try {
    const { topic, className, subjectName, termName, duration = '40 minutes' } = req.body;
    if (!topic) return res.status(400).json({ message: 'topic is required' });

    const subj = subjectName || 'General';
    const cls  = className  || 'Secondary School';
    const t    = topic;

    // Load AI config and check feature toggle
    const config = await getAIConfig();
    if (!config.features.lessonNotes) {
      return res.status(403).json({ message: 'AI lesson note generation is currently disabled by the administrator.' });
    }

    // Attempt AI generation if a key is available
    if (config.apiKey) {
      try {
        const result = await generateLessonNoteContent({
          topic: t,
          className: cls,
          subjectName: subj,
          termName: termName || 'First Term',
          duration,
        });
        return res.json({ sections: result.sections, aiGenerated: true, provider: result.provider, model: result.model });
      } catch (err) {
        console.log('[AI Generation] Failed, falling back to template:', (err as any).message);
      }
    }

    // Template fallback (no API key or generation error)
    const sections = {
      objectives: `<ol>
<li>By the end of this lesson, students should be able to <strong>define ${t}</strong> accurately in their own words.</li>
<li>Identify and describe the key types or components of ${t}.</li>
<li>Explain the importance and applications of ${t} in ${subj} and everyday Nigerian life.</li>
<li>Distinguish between the major categories or features associated with ${t}.</li>
<li>Apply knowledge of ${t} to answer examination questions and solve related problems.</li>
</ol>`,
      introduction: `<p>Have you ever wondered how <strong>${t}</strong> affects your daily life here in Nigeria? Think about the things around you — in your home, your community, and the environment. Many of these connect directly to what we are about to study today.</p>
<p>In our previous lessons, we have been building knowledge in ${subj}. Today, we take a step further by exploring <strong>${t}</strong> — a topic that is both important for your examinations and relevant to the world around you. By understanding this topic well, you will be able to make better sense of real events and phenomena you encounter every day.</p>
<p>By the end of today's lesson, you will have a thorough understanding of ${t}, its key features, types, significance, and applications in everyday Nigerian life.</p>`,
      content: `<h3>Definition of ${t}</h3>
<p><strong>${t}</strong> can be defined as [provide a clear, detailed definition here suitable for ${cls} ${subj} students in the Nigerian curriculum context]. It is an important concept in ${subj} because it helps us understand [explain the relevance].</p>

<h3>Background and Overview</h3>
<p>[Provide background context for ${t}. Explain the broader topic area it belongs to, why it is studied in ${subj}, and how it connects to real life in Nigeria. Write at least 2 detailed paragraphs here.]</p>
<p>[Continue with further background — historical context, scientific basis, or geographical relevance depending on the subject area. Make this thorough and educational.]</p>

<h3>Types and Classifications</h3>
<p>There are several important types or categories of ${t} that students must understand and be able to distinguish:</p>
<table>
<tr><th>Type / Category</th><th>Description</th><th>Nigerian Examples</th></tr>
<tr><td>[Type 1]</td><td>[Detailed description of this type — explain its features clearly]</td><td>[Specific Nigerian/local examples]</td></tr>
<tr><td>[Type 2]</td><td>[Detailed description of this type — explain its features clearly]</td><td>[Specific Nigerian/local examples]</td></tr>
<tr><td>[Type 3]</td><td>[Detailed description of this type — explain its features clearly]</td><td>[Specific Nigerian/local examples]</td></tr>
<tr><td>[Type 4]</td><td>[Detailed description of this type — explain its features clearly]</td><td>[Specific Nigerian/local examples]</td></tr>
</table>

<h3>Key Characteristics and Features</h3>
<p>The following are the main characteristics that define ${t}:</p>
<ul>
<li><strong>[Feature 1]:</strong> [Explain this feature in detail. Why is it important? Give an example.]</li>
<li><strong>[Feature 2]:</strong> [Explain this feature in detail. Why is it important? Give an example.]</li>
<li><strong>[Feature 3]:</strong> [Explain this feature in detail. Why is it important? Give an example.]</li>
<li><strong>[Feature 4]:</strong> [Explain this feature in detail. Why is it important? Give an example.]</li>
</ul>

<h3>Importance and Applications</h3>
<p>[Write 2 detailed paragraphs explaining the importance of ${t} in ${subj}. Include its role in the Nigerian economy, society, agriculture, health, or environment — whichever is relevant. Use specific Nigerian examples and statistics where appropriate.]</p>
<p>[Continue discussing practical applications — how is this knowledge used in real situations? What happens when this is absent or neglected? Make the content rich and relatable to students in ${cls}.]</p>

<h3>Practical Examples and Illustrations</h3>
<p>[Provide at least 2 detailed worked examples, case studies, or illustrations of ${t} in practice. For science/maths topics, show calculations step by step. For humanities, provide narrative examples. For vocational topics, describe practical procedures. Use Nigerian contexts throughout.]</p>`,
      evaluation: `<ol>
<li>Define <strong>${t}</strong> in your own words. <em>(2 marks)</em></li>
<li>List <strong>four</strong> types or characteristics of ${t}. <em>(4 marks)</em></li>
<li>Explain <strong>two</strong> ways in which ${t} is important in everyday Nigerian life. <em>(4 marks)</em></li>
<li>Give <strong>three</strong> examples of ${t} found in your local environment or community. <em>(3 marks)</em></li>
<li>Compare and contrast any <strong>two</strong> types of ${t} you have studied today. <em>(4 marks)</em></li>
<li>In your own words, explain why it is important for every Nigerian student to understand ${t}. <em>(3 marks)</em></li>
</ol>`,
      assignment: `<ol>
<li>In your exercise book, write a detailed note on <strong>${t}</strong> covering: definition, types, key characteristics, and importance. Add labelled diagrams or tables where possible.</li>
<li>Find and describe <strong>two real-life examples</strong> of ${t} in your home, community, or local environment. Write a paragraph on each example.</li>
<li>Draw a clearly labelled diagram or construct a table that summarises the main types and features of ${t}.</li>
<li>Research and write half a page on how knowledge of ${t} has benefited Nigeria or a Nigerian industry, community, or agricultural practice.</li>
</ol>`,
      summary: `<ul>
<li><strong>${t}</strong> is a key concept in ${subj} that refers to [brief one-line recap of the definition].</li>
<li>The main types and categories include [list the key types briefly].</li>
<li>Key characteristics of ${t} include [state 2–3 important features from the lesson].</li>
<li>${t} is significant because [state the main reason for its importance in Nigeria/the subject area].</li>
<li>Understanding ${t} enables us to [practical benefit or application for students in ${cls}].</li>
</ul>`,
    };

    res.json({ sections, aiGenerated: false });
  } catch (err: any) { res.status(500).json({ message: err.message }); }
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

export default router;
