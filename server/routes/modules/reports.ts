import { Router } from "express";
import { storage } from "../../storage";
import { authenticateUser, authorizeRoles, ROLES } from "../middleware";

const router = Router();

// Get exam results for the current logged-in student
router.get('/exam-results', authenticateUser, authorizeRoles(ROLES.STUDENT), async (req, res) => {
  try {
    const studentId = req.user!.id;
    const results = await storage.getExamResultsByStudent(studentId);
    
    const enrichedResults = await Promise.all(results.map(async (result: any) => {
      const exam = await storage.getExamById(result.examId);
      return {
        ...result,
        examTitle: exam?.name || `Exam #${result.examId}`,
        percentage: result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0
      };
    }));
    
    res.json(enrichedResults);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch exam results' });
  }
});

// Get grading tasks for teachers
router.get('/grading/tasks', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req, res) => {
  try {
    const teacherId = req.user!.id;
    const tasks = await storage.getGradingTasksByTeacher(teacherId);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch grading tasks' });
  }
});

export default router;
