/** Auto-split from routes.ts — student-class-rank (orig lines 15076-15118). See git history. */
import * as schema from '@shared/schema.pg';
import { AuthenticatedUser, authenticateUser } from '../routes/middleware';
import { db, storage } from '../storage';
import { eq } from 'drizzle-orm';
import { type Express, type Request, type Response } from 'express';

export async function registerStudentClassRankRoutes(app: Express) {
  // ==================== STUDENT CLASS RANK ROUTE ====================
  app.get('/api/student/class-rank', authenticateUser, async (req: Request, res: Response) => {
    try {
      const authUser = (req as any).user as AuthenticatedUser;
      const student = await storage.getStudentByUserId(authUser.id);
      if (!student || !student.classId) {
        return res.json({ rank: null, total: null, percentage: null });
      }

      const classStudents = await storage.getStudentsByClass(student.classId);
      if (classStudents.length === 0) {
        return res.json({ rank: null, total: 0, percentage: null });
      }

      const studentScores = await Promise.all(
        classStudents.map(async (s) => {
          const results = await db
            .select({ score: schema.examResults.score, marksObtained: schema.examResults.marksObtained, maxScore: schema.examResults.maxScore })
            .from(schema.examResults)
            .where(eq(schema.examResults.studentId, s.id));
          const valid = results.filter((r: { score: number | null; marksObtained: number | null; maxScore: number | null }) => r.score != null || r.marksObtained != null);
          const avg = valid.length > 0
            ? valid.reduce((sum: number, r: { score: number | null; marksObtained: number | null; maxScore: number | null }) => sum + (r.score ?? r.marksObtained ?? 0), 0) / valid.length
            : 0;
          return { studentId: s.id, avg };
        })
      );

      studentScores.sort((a, b) => b.avg - a.avg);

      const rankIndex = studentScores.findIndex((s) => s.studentId === authUser.id);
      const rank = rankIndex >= 0 ? rankIndex + 1 : null;
      const total = classStudents.length;
      const percentage = rank !== null ? Math.round((rank / total) * 100) : null;

      res.json({ rank, total, percentage });
    } catch (error: any) {
      console.error('Error fetching class rank:', error);
      res.status(500).json({ message: 'Failed to fetch class rank' });
    }
  });
  // ==================== END STUDENT CLASS RANK ROUTE ====================

}
