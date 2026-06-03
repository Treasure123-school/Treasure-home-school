import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { authenticateUser, authorizeRoles, ROLES } from './middleware';

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
    const { topic, className, subjectName, termName, weekNumber, duration = '40 minutes' } = req.body;
    if (!topic) return res.status(400).json({ message: 'topic is required' });

    const subj = subjectName || 'General';
    const cls  = className  || 'Secondary School';
    const t    = topic;

    // Try OpenAI if key is present
    if (process.env.OPENAI_API_KEY) {
      try {
        const prompt = `You are an expert Nigerian secondary school curriculum specialist who writes detailed, professional lesson notes.

Generate a complete lesson note in JSON format for:
Topic: "${t}"
Class: "${cls}"
Subject: "${subj}"
Term: "${termName || 'First Term'}"
Duration: "${duration}"

Return ONLY valid JSON with exactly these 7 keys. Use HTML in all values.
Rules:
- "objectives": Use <ol><li> numbered list. 4–5 specific, measurable outcomes starting with action verbs (define, identify, explain, demonstrate, apply).
- "previousKnowledge": 1–2 sentences about what students already know that links to this topic. No list needed.
- "materials": <ul><li> list of 5–7 specific teaching materials (textbook name, charts, specimens, etc.).
- "introduction": 2–3 paragraphs. How teacher opens the lesson — a relatable question or scenario, then links to prior knowledge, then states the topic. No bullet lists.
- "content": This is the MOST IMPORTANT section. Write detailed, textbook-quality content with:
  * <h2> for the main topic heading
  * <h3> for each sub-topic (at least 3 sub-topics)
  * <p> paragraphs with clear explanations
  * <ul><li> or <ol><li> for lists/types/examples where appropriate
  * Use <strong> for key terms
  * Include a table using <table><tr><th>/<td> if listing types/comparisons (e.g. types with explanation and examples)
  * Minimum 400 words of real educational content specific to the Nigerian curriculum
- "teacherActivities": <table><tr> with 3 columns: Step | Activity | Time. 5 steps covering intro, explanation, demonstration, guided practice, conclusion. Use <th> for headers.
- "studentActivities": <ul><li> list of 6–8 specific student actions during the lesson.

{
  "objectives": "...",
  "previousKnowledge": "...",
  "materials": "...",
  "introduction": "...",
  "content": "...",
  "teacherActivities": "...",
  "studentActivities": "..."
}`;

        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 3000,
            temperature: 0.5,
          }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json() as any;
          const raw = aiData.choices?.[0]?.message?.content;
          if (raw) {
            const sections = JSON.parse(raw);
            return res.json({ sections, aiGenerated: true });
          }
        } else {
          const errBody = await aiRes.text();
          console.log('[AI Generation] OpenAI error:', aiRes.status, errBody);
        }
      } catch (err) {
        console.log('[AI Generation] OpenAI failed, falling back to template:', (err as any).message);
      }
    }

    // Template fallback (no API key or OpenAI error)
    const sections = {
      objectives: `<ol>
<li>By the end of this lesson, students should be able to <strong>define ${t}</strong> accurately in their own words.</li>
<li>Identify and describe the key types or components of ${t}.</li>
<li>Explain the importance and applications of ${t} in ${subj} and everyday life.</li>
<li>Distinguish between the major categories or features associated with ${t}.</li>
<li>Apply knowledge of ${t} to answer questions and solve related problems.</li>
</ol>`,
      previousKnowledge: `<p>Students have been previously taught related concepts in ${subj} including basic definitions, classifications, and the Nigerian environment context. They are expected to be familiar with introductory topics covered earlier this term in ${cls}.</p>`,
      materials: `<ul>
<li>${subj} Textbook for ${cls}</li>
<li>Whiteboard / chalkboard and markers or chalk</li>
<li>Charts and diagrams illustrating ${t}</li>
<li>Real-world specimens or models (where applicable)</li>
<li>Worksheets and exercise sheets</li>
<li>Projector or TV screen (if available)</li>
</ul>`,
      introduction: `<p>The teacher begins by greeting the class and briefly reviewing the previous lesson to activate prior knowledge. Students are asked: <em>"Can you give me examples of ${t} from your daily life?"</em> A short discussion follows to generate interest.</p>
<p>The teacher then introduces today's topic by connecting it to familiar real-world scenarios in the Nigerian context, making the subject matter relevant and relatable to students in ${cls}.</p>
<p>The topic <strong>"${t}"</strong> is written on the board and the learning objectives are stated clearly so students know what they are expected to achieve by the end of the lesson.</p>`,
      content: `<h2>${t}</h2>
<p><strong>Definition:</strong> [Write a clear, concise definition of ${t} appropriate for ${cls} ${subj} students.]</p>

<h3>Types / Categories</h3>
<table>
<tr><th>Type</th><th>Description</th><th>Examples</th></tr>
<tr><td>[Type 1]</td><td>[Brief description]</td><td>[Local Nigerian examples]</td></tr>
<tr><td>[Type 2]</td><td>[Brief description]</td><td>[Examples]</td></tr>
<tr><td>[Type 3]</td><td>[Brief description]</td><td>[Examples]</td></tr>
</table>

<h3>Key Characteristics</h3>
<ul>
<li><strong>Characteristic 1:</strong> [Explain]</li>
<li><strong>Characteristic 2:</strong> [Explain]</li>
<li><strong>Characteristic 3:</strong> [Explain]</li>
</ul>

<h3>Importance / Uses</h3>
<p>[Explain why ${t} is important to ${subj} and to everyday Nigerian life. Give specific examples.]</p>

<h3>Summary</h3>
<p>[Summarise the key points of the lesson in 2–3 sentences for students to note.]</p>`,
      teacherActivities: `<table>
<tr><th>Step</th><th>Activity</th><th>Time</th></tr>
<tr><td>1</td><td>Introduce the topic, state objectives, review previous lesson</td><td>5 min</td></tr>
<tr><td>2</td><td>Explain key concepts of ${t} using the board, charts, and real examples</td><td>10 min</td></tr>
<tr><td>3</td><td>Demonstrate worked examples and invite student responses</td><td>10 min</td></tr>
<tr><td>4</td><td>Guide students through class exercises; circulate and give feedback</td><td>10 min</td></tr>
<tr><td>5</td><td>Summarise lesson, ask evaluative questions, give take-home task</td><td>5 min</td></tr>
</table>`,
      studentActivities: `<ul>
<li>Listen attentively as the teacher introduces the topic and states objectives</li>
<li>Respond to opening questions and contribute to class discussion</li>
<li>Copy key definitions, diagrams, and examples into their exercise books</li>
<li>Answer oral questions posed by the teacher during the lesson</li>
<li>Participate actively in demonstrations and group discussions</li>
<li>Attempt class exercises individually or in pairs</li>
<li>Ask questions where clarification is needed</li>
<li>Record the take-home task in their assignment notebooks</li>
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
