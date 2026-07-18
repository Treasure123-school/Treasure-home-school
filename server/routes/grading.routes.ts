/**
 * AI-Assisted Grading Routes
 *
 * Handles teacher review of AI-suggested scores and manual score overrides.
 * Extracted from routes.ts for modularity.
 *
 * Routes:
 *   GET  /api/grading/tasks/ai-suggested             – list pending AI-grading tasks
 *   POST /api/grading/ai-suggested/:answerId/review  – approve or override an AI score
 */

import { Router, Request, Response } from 'express';
import { authenticateUser, authorizeRoles, ROLES } from './middleware';
import { storage } from '../storage';
import { mergeExamScores } from '../helpers/exam-scoring';

const router = Router();

// ─── List AI-suggested grading tasks ──────────────────────────────────────────
router.get(
  '/api/grading/tasks/ai-suggested',
  authenticateUser,
  authorizeRoles(ROLES.ADMIN, ROLES.TEACHER),
  async (req: Request, res: Response) => {
    try {
      const teacherId = req.user!.id;
      const status = req.query.status as string;

      const tasks = await storage.getAISuggestedGradingTasks(teacherId, status);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch AI-suggested tasks' });
    }
  }
);

// ─── Approve or override an AI-suggested score ───────────────────────────────
router.post(
  '/api/grading/ai-suggested/:answerId/review',
  authenticateUser,
  authorizeRoles(ROLES.ADMIN, ROLES.TEACHER),
  async (req: Request, res: Response) => {
    try {
      const answerId = parseInt(req.params.answerId);
      const { approved, overrideScore, comment } = req.body;

      const answer = await storage.getStudentAnswerById(answerId);
      if (!answer) {
        return res.status(404).json({ message: 'Answer not found' });
      }

      if (approved) {
        // Teacher approved AI suggestion — mark as auto-scored and keep score
        await storage.updateStudentAnswer(answerId, {
          autoScored: true,
          manualOverride: false,
          feedbackText: comment || answer.feedbackText
        });
      } else {
        // Teacher override — use their score
        await storage.updateStudentAnswer(answerId, {
          pointsEarned: overrideScore,
          autoScored: false,
          manualOverride: true,
          feedbackText: comment
        });
      }

      // Trigger score merge — syncs to report card when all essays are graded
      await mergeExamScores(answerId, storage);

      res.json({
        message: approved ? 'AI score approved' : 'Score overridden successfully',
        answer: await storage.getStudentAnswerById(answerId)
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to review AI-suggested score' });
    }
  }
);

export default router;
