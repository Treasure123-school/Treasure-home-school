/** Auto-split from routes.ts — student-attendance (orig lines 15567-15607). See git history. */
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { storage } from '../storage';
import { type Express, type Request, type Response } from 'express';

export async function registerStudentAttendanceRoutes(app: Express) {
  // ==================== STUDENT ATTENDANCE ROUTE ====================
  app.get('/api/student/attendance', authenticateUser, authorizeRoles(ROLES.STUDENT), async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { month, year } = req.query;

      const studentRecord = await storage.getStudentByUserId(userId);
      if (!studentRecord) {
        return res.status(404).json({ message: 'Student record not found' });
      }

      const records = await storage.getAttendanceByStudent(studentRecord.id);

      let filtered = records;

      if (month !== undefined && year !== undefined) {
        const m = parseInt(month as string);
        const y = parseInt(year as string);
        filtered = records.filter((r: any) => {
          const d = new Date(r.date);
          return d.getMonth() === m && d.getFullYear() === y;
        });
      }

      const enriched = filtered.map((r: any) => ({
        id: r.id,
        date: r.date,
        status: (r.status as string).toLowerCase(),
        notes: r.notes || null,
        subject: null,
        teacher: null,
        remarks: r.notes || null,
      }));

      return res.json(enriched);
    } catch (error: any) {
      console.error('Error fetching student attendance:', error);
      return res.status(500).json({ message: 'Failed to fetch attendance' });
    }
  });
  // ==================== END STUDENT ATTENDANCE ROUTE ====================
}
