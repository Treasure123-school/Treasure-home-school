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

    // Try OpenAI if key is present
    if (process.env.OPENAI_API_KEY) {
      try {
        const prompt = `You are an expert Nigerian secondary school curriculum specialist.
Generate a complete, professional lesson note in JSON format for the following:
Topic: "${topic}"
Class: "${className || 'Secondary School'}"
Subject: "${subjectName || 'General'}"
Term: "${termName || 'First Term'}"
Week: "${weekNumber || '1'}"
Duration: "${duration}"

Return ONLY a JSON object with these exact keys (HTML allowed in values, use <ul><li> for lists, <strong> for bold, <p> for paragraphs):
{
  "objectives": "...",
  "materials": "...",
  "previousKnowledge": "...",
  "introduction": "...",
  "content": "...",
  "teacherActivities": "...",
  "studentActivities": "...",
  "evaluation": "...",
  "assignment": "...",
  "references": "..."
}

Make objectives use numbered bullet list. Make teacherActivities use step-by-step format. Make evaluation have 4-5 specific questions. Content should be detailed and educational.`;

        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            response_format: { type: 'json_object' },
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 2000,
            temperature: 0.7,
          }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json() as any;
          const sections = JSON.parse(aiData.choices[0].message.content);
          return res.json({ sections, aiGenerated: true });
        }
      } catch (err) {
        console.log('[AI Generation] OpenAI failed, falling back to template:', (err as any).message);
      }
    }

    // Template generation (no API key / fallback)
    const subj = subjectName || 'this subject';
    const cls  = className  || 'the class';
    const t    = topic;

    const sections = {
      objectives: `<ul>
<li>By the end of this lesson, students should be able to <strong>define and explain ${t}</strong> in their own words.</li>
<li>Identify and list the key components or features of ${t}.</li>
<li>Apply knowledge of ${t} to solve simple problems or answer questions.</li>
<li>Appreciate the relevance of ${t} to everyday life and the ${subj} curriculum.</li>
</ul>`,
      materials: `<ul>
<li>${subj} textbook (recommended for ${cls})</li>
<li>Whiteboard and markers / chalk and chalkboard</li>
<li>Relevant charts, diagrams, or illustrations</li>
<li>Worksheets or exercise sheets</li>
<li>Real-world specimens or models (where applicable)</li>
</ul>`,
      previousKnowledge: `<p>Students are expected to have prior knowledge of the following concepts that directly relate to <strong>${t}</strong>:</p>
<ul>
<li>Basic definitions and terminology in ${subj}</li>
<li>Topics previously covered this term in ${cls}</li>
<li>General observation and problem-solving skills</li>
</ul>`,
      introduction: `<p>The teacher begins the lesson by:</p>
<ul>
<li>Welcoming students and briefly reviewing the previous lesson</li>
<li>Asking thought-provoking questions related to <strong>${t}</strong> to stimulate student interest</li>
<li>Introducing the topic by connecting it to real-world examples familiar to students in ${cls}</li>
<li>Writing the topic <strong>"${t}"</strong> on the board and stating the lesson objectives clearly</li>
</ul>`,
      content: `<h2>${t}</h2>
<p><strong>Definition:</strong> [Provide a clear, concise definition of ${t} appropriate for ${cls} ${subj}.]</p>
<h3>Key Concepts</h3>
<ul>
<li><strong>Concept 1:</strong> [Explain the first major concept related to ${t}]</li>
<li><strong>Concept 2:</strong> [Explain the second major concept]</li>
<li><strong>Concept 3:</strong> [Explain the third major concept]</li>
</ul>
<h3>Worked Example</h3>
<p>[Provide a clear worked example that demonstrates the key principle of ${t}. Show step-by-step working.]</p>
<h3>Important Notes</h3>
<p>[Add any important notes, exceptions, or key facts students must remember about ${t}.]</p>`,
      teacherActivities: `<ul>
<li><strong>Step 1 (5 min):</strong> Introduce the topic "${t}", state objectives, and connect to prior knowledge.</li>
<li><strong>Step 2 (10 min):</strong> Explain key concepts of ${t} using the board, diagrams, and real-world examples. Ask guided questions.</li>
<li><strong>Step 3 (10 min):</strong> Demonstrate a worked example step by step. Invite students to participate.</li>
<li><strong>Step 4 (10 min):</strong> Guide students through practice exercises. Circulate and provide feedback.</li>
<li><strong>Step 5 (5 min):</strong> Summarise the lesson, evaluate understanding, and give assignment.</li>
</ul>`,
      studentActivities: `<ul>
<li>Listen attentively and take notes as the teacher explains ${t}</li>
<li>Answer oral questions posed by the teacher throughout the lesson</li>
<li>Participate actively in class discussions and demonstrations</li>
<li>Copy key definitions, diagrams, and examples into their notebooks</li>
<li>Attempt practice exercises individually or in pairs</li>
<li>Ask questions where clarification is needed</li>
</ul>`,
      evaluation: `<p><strong>The teacher evaluates students' understanding by asking the following questions:</strong></p>
<ul>
<li>1. In your own words, what is <strong>${t}</strong>?</li>
<li>2. List <strong>three</strong> characteristics or features of ${t}.</li>
<li>3. Give <strong>two</strong> examples of ${t} as it applies to ${subj}.</li>
<li>4. Explain the <strong>importance</strong> of ${t} to everyday life or to ${subj}.</li>
<li>5. What is the <strong>difference</strong> between [key term A] and [key term B] related to ${t}?</li>
</ul>`,
      assignment: `<p><strong>Students are to complete the following by the next lesson:</strong></p>
<ul>
<li>1. Write a half-page summary on <strong>${t}</strong> in your own words.</li>
<li>2. Draw and label a diagram illustrating ${t} (where applicable).</li>
<li>3. List <strong>five</strong> examples of ${t} from your environment or daily experience.</li>
<li>4. Answer questions [page/exercise reference] in your ${subj} textbook.</li>
</ul>`,
      references: `<ul>
<li>Recommended ${subj} Textbook for ${cls} — Chapter on ${t}</li>
<li>Nigerian Educational Research and Development Council (NERDC). (2015). <em>${subj} Curriculum for ${cls}</em>. NERDC Press.</li>
<li>Universal Basic Education Commission (UBEC). <em>Basic Education Scheme of Work</em>.</li>
<li>Relevant online educational resources (teacher's discretion)</li>
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
