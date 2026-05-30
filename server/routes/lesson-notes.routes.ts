import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { authenticateUser, authorizeRoles, ROLES } from './middleware';

const router = Router();

// ─── Helper to extract auth user ───────────────────────────────────────────
function getUser(req: Request) {
  return (req as any).user as { id: string; roleId: number };
}

// ─── GET /api/lesson-notes/stats  (admin only) ─────────────────────────────
router.get('/stats', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const stats = await storage.getLessonNotesStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /api/lesson-notes  (admin sees all; teacher sees own) ──────────────
router.get('/', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.TEACHER), async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const isTeacher = user.roleId === ROLES.TEACHER;
    const filters: any = {};
    if (req.query.classId)   filters.classId   = parseInt(req.query.classId as string);
    if (req.query.subjectId) filters.subjectId = parseInt(req.query.subjectId as string);
    if (req.query.termId)    filters.termId    = parseInt(req.query.termId as string);
    if (req.query.status)    filters.status    = req.query.status as string;
    // Teachers can only see their own notes
    if (isTeacher) filters.createdBy = user.id;
    const notes = await storage.getLessonNotes(filters);
    res.json(notes);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /api/lesson-notes/:id  (admin or owning teacher) ──────────────────
router.get('/:id', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.TEACHER), async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const note = await storage.getLessonNoteById(parseInt(req.params.id));
    if (!note) return res.status(404).json({ message: 'Lesson note not found' });
    const isTeacher = user.roleId === ROLES.TEACHER;
    if (isTeacher && note.createdBy !== user.id) return res.status(403).json({ message: 'Access denied' });
    res.json(note);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── POST /api/lesson-notes  (teacher or admin creates) ────────────────────
router.post('/', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.TEACHER), async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const { topicId, classId, subjectId, termId, title, content, objectives, attachmentUrl, attachmentName } = req.body;
    if (!topicId || !classId || !subjectId || !termId || !title) {
      return res.status(400).json({ message: 'topicId, classId, subjectId, termId, and title are required' });
    }
    // Check uniqueness — one note per topic
    const existing = await storage.getLessonNoteByTopicId(topicId);
    if (existing) return res.status(409).json({ message: 'A lesson note already exists for this topic', existingId: existing.id });
    const note = await storage.createLessonNote({
      topicId, classId, subjectId, termId, title, content, objectives,
      attachmentUrl, attachmentName, status: 'draft', createdBy: user.id,
    });
    res.status(201).json(note);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── PUT /api/lesson-notes/:id  (teacher owns draft/rejected; admin can edit all) ──
router.put('/:id', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.TEACHER), async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const isTeacher = user.roleId === ROLES.TEACHER;
    const note = await storage.getLessonNoteById(parseInt(req.params.id));
    if (!note) return res.status(404).json({ message: 'Lesson note not found' });
    if (isTeacher) {
      if (note.createdBy !== user.id) return res.status(403).json({ message: 'Access denied' });
      if (!['draft', 'rejected'].includes(note.status)) return res.status(400).json({ message: 'You can only edit draft or rejected notes' });
    }
    const { title, content, objectives, attachmentUrl, attachmentName } = req.body;
    const updated = await storage.updateLessonNote(note.id, { title, content, objectives, attachmentUrl, attachmentName });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── DELETE /api/lesson-notes/:id  (teacher deletes own draft; admin deletes any) ──
router.delete('/:id', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.TEACHER), async (req: Request, res: Response) => {
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
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── POST /api/lesson-notes/:id/submit  (teacher submits for review) ───────
router.post('/:id/submit', authenticateUser, authorizeRoles(ROLES.TEACHER), async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const note = await storage.getLessonNoteById(parseInt(req.params.id));
    if (!note) return res.status(404).json({ message: 'Lesson note not found' });
    if (note.createdBy !== user.id) return res.status(403).json({ message: 'Access denied' });
    if (!['draft', 'rejected'].includes(note.status)) return res.status(400).json({ message: 'Only draft or rejected notes can be submitted' });
    const updated = await storage.updateLessonNote(note.id, {
      status: 'submitted', submittedBy: user.id, submittedAt: new Date(), rejectionReason: null as any,
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── POST /api/lesson-notes/:id/approve  (admin approves) ──────────────────
router.post('/:id/approve', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const note = await storage.getLessonNoteById(parseInt(req.params.id));
    if (!note) return res.status(404).json({ message: 'Lesson note not found' });
    if (note.status !== 'submitted') return res.status(400).json({ message: 'Only submitted notes can be approved' });
    const updated = await storage.updateLessonNote(note.id, {
      status: 'approved', approvedBy: user.id, approvedAt: new Date(),
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── POST /api/lesson-notes/:id/reject  (admin rejects with reason) ─────────
router.post('/:id/reject', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const note = await storage.getLessonNoteById(parseInt(req.params.id));
    if (!note) return res.status(404).json({ message: 'Lesson note not found' });
    if (!['submitted', 'approved'].includes(note.status)) return res.status(400).json({ message: 'Only submitted or approved notes can be rejected' });
    const { reason } = req.body;
    const updated = await storage.updateLessonNote(note.id, {
      status: 'rejected', rejectedBy: user.id, rejectedAt: new Date(), rejectionReason: reason || 'No reason provided',
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── POST /api/lesson-notes/:id/publish  (admin publishes) ─────────────────
router.post('/:id/publish', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const note = await storage.getLessonNoteById(parseInt(req.params.id));
    if (!note) return res.status(404).json({ message: 'Lesson note not found' });
    if (note.status !== 'approved') return res.status(400).json({ message: 'Only approved notes can be published' });
    const updated = await storage.updateLessonNote(note.id, {
      status: 'published', publishedBy: user.id, publishedAt: new Date(),
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── POST /api/lesson-notes/:id/unpublish  (admin unpublishes → back to approved) ──
router.post('/:id/unpublish', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const note = await storage.getLessonNoteById(parseInt(req.params.id));
    if (!note) return res.status(404).json({ message: 'Lesson note not found' });
    if (note.status !== 'published') return res.status(400).json({ message: 'Only published notes can be unpublished' });
    const updated = await storage.updateLessonNote(note.id, { status: 'approved', publishedAt: null as any, publishedBy: null as any });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ─── GET /api/lesson-notes/by-topic/:topicId  (student — published only) ───
router.get('/by-topic/:topicId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const isStudent = user.roleId === ROLES.STUDENT;
    const note = await storage.getLessonNoteByTopicId(parseInt(req.params.topicId), isStudent);
    if (!note) return res.status(404).json({ message: 'No lesson note for this topic' });
    res.json(note);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
