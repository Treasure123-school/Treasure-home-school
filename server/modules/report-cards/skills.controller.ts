/**
 * Skills Controller
 * Handles affective and psychomotor skills assessment for report cards
 * Only class teachers and admins can rate skills
 */
import { Request, Response } from 'express';
import { storage } from '../../storage';
import { calculateClassTeacherPermissions, getClassTeacherPermissionDeniedMessage } from '@shared/class-teacher-permissions';

export class SkillsController {
  /**
   * GET /api/reports/:reportCardId/skills
   * Get skills ratings for a report card
   */
  async getSkills(req: Request, res: Response) {
    try {
      const { reportCardId } = req.params;
      
      const reportCard = await storage.getReportCard(Number(reportCardId));
      if (!reportCard) {
        return res.status(404).json({ message: 'Report card not found' });
      }
      
      const skills = await storage.getReportCardSkills(Number(reportCardId));
      res.json(skills || {});
    } catch (error: any) {
      console.error('[SKILLS] Error getting skills:', error);
      res.status(500).json({ message: error.message || 'Failed to get skills' });
    }
  }

  /**
   * POST /api/reports/:reportCardId/skills
   * Save/update skills ratings for a report card
   * Authorization: Only class teacher or admin
   */
  async saveSkills(req: Request, res: Response) {
    try {
      const { reportCardId } = req.params;
      const userId = req.user!.id;
      const roleId = req.user!.roleId;
      const skillsData = req.body;

      const reportCard = await storage.getReportCard(Number(reportCardId));
      if (!reportCard) {
        return res.status(404).json({ message: 'Report card not found' });
      }

      // Get the class to find the class teacher
      const classInfo = reportCard.classId ? await storage.getClass(reportCard.classId) : null;
      const classTeacherId = classInfo?.classTeacherId || null;

      // Check class teacher permission
      const permissions = calculateClassTeacherPermissions({
        loggedInUserId: userId,
        loggedInRoleId: roleId,
        classTeacherId
      });

      if (!permissions.canRateSkills) {
        return res.status(403).json({
          message: getClassTeacherPermissionDeniedMessage('skills'),
          isClassTeacher: false
        });
      }

      const result = await storage.saveReportCardSkills(Number(reportCardId), {
        ...skillsData,
        recordedBy: userId
      });
      
      res.json(result);
    } catch (error: any) {
      console.error('[SKILLS] Error saving skills:', error);
      res.status(500).json({ message: error.message || 'Failed to save skills' });
    }
  }
}
