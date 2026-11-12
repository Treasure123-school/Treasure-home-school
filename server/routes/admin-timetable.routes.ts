/** Auto-split from routes.ts — admin-timetable (orig lines 15325-15426). See git history. */
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { storage } from '../storage';
import { type Express, type Request, type Response } from 'express';

export async function registerAdminTimetableRoutes(app: Express) {
  // ==================== ADMIN TIMETABLE ROUTES ====================
  app.get('/api/admin/timetable', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const classId = req.query.classId ? parseInt(req.query.classId as string) : undefined;
      const teacherId = req.query.teacherId as string | undefined;
      const termId = req.query.termId ? parseInt(req.query.termId as string) : undefined;
      const entries = await storage.getAllTimetableEntries({ classId, teacherId, termId });
      return res.json(entries);
    } catch (error: any) {
      console.error('Error fetching timetable:', error);
      return res.status(500).json({ message: 'Failed to fetch timetable', error: error.message });
    }
  });

  app.post('/api/admin/timetable', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { teacherId, classId, subjectId, dayOfWeek, startTime, endTime, location, termId } = req.body;
      if (!teacherId || !classId || !subjectId || !dayOfWeek || !startTime || !endTime) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      // Conflict check: teacher already scheduled at overlapping time on same day
      const all = await storage.getAllTimetableEntries({ teacherId });
      const conflict = all.find(e => {
        if (e.dayOfWeek !== dayOfWeek) return false;
        const eStart = e.startTime; const eEnd = e.endTime;
        return startTime < eEnd && endTime > eStart;
      });
      if (conflict) {
        return res.status(409).json({
          message: `Teacher is already scheduled for ${conflict.subjectName} (${conflict.className}) at this time on ${dayOfWeek}.`,
          conflict,
        });
      }
      const entry = await storage.createTimetableEntry({ teacherId, classId: parseInt(classId), subjectId: parseInt(subjectId), dayOfWeek, startTime, endTime, location: location || null, termId: termId ? parseInt(termId) : null });
      return res.status(201).json(entry);
    } catch (error: any) {
      console.error('Error creating timetable entry:', error);
      return res.status(500).json({ message: 'Failed to create timetable entry', error: error.message });
    }
  });

  app.put('/api/admin/timetable/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { teacherId, classId, subjectId, dayOfWeek, startTime, endTime, location, termId } = req.body;
      // Conflict check: teacher already scheduled at overlapping time on same day (excluding current entry)
      if (teacherId && dayOfWeek && startTime && endTime) {
        const all = await storage.getAllTimetableEntries({ teacherId });
        const conflict = all.find(e => {
          if (e.id === id) return false;
          if (e.dayOfWeek !== dayOfWeek) return false;
          return startTime < e.endTime && endTime > e.startTime;
        });
        if (conflict) {
          return res.status(409).json({
            message: `Teacher is already scheduled for ${conflict.subjectName} (${conflict.className}) at this time on ${dayOfWeek}.`,
            conflict,
          });
        }
      }
      const updated = await storage.updateTimetableEntry(id, {
        ...(teacherId && { teacherId }),
        ...(classId && { classId: parseInt(classId) }),
        ...(subjectId && { subjectId: parseInt(subjectId) }),
        ...(dayOfWeek && { dayOfWeek }),
        ...(startTime && { startTime }),
        ...(endTime && { endTime }),
        location: location ?? null,
        ...(termId !== undefined && { termId: termId ? parseInt(termId) : null }),
      });
      if (!updated) return res.status(404).json({ message: 'Timetable entry not found' });
      return res.json(updated);
    } catch (error: any) {
      console.error('Error updating timetable entry:', error);
      return res.status(500).json({ message: 'Failed to update timetable entry', error: error.message });
    }
  });

  app.delete('/api/admin/timetable/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteTimetableEntry(id);
      if (!deleted) return res.status(404).json({ message: 'Timetable entry not found' });
      return res.json({ message: 'Timetable entry deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting timetable entry:', error);
      return res.status(500).json({ message: 'Failed to delete timetable entry', error: error.message });
    }
  });

  app.get('/api/teacher/timetable', authenticateUser, authorizeRoles(ROLES.TEACHER), async (req: Request, res: Response) => {
    try {
      const teacherId = req.user!.id;
      const entries = await storage.getAllTimetableEntries({ teacherId });
      return res.json(entries);
    } catch (error: any) {
      console.error('Error fetching teacher timetable:', error);
      return res.status(500).json({ message: 'Failed to fetch timetable', error: error.message });
    }
  });
  // ==================== END ADMIN TIMETABLE ROUTES ====================

}
