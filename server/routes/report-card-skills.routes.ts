import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { authenticateUser, authorizeRoles, ROLES } from './middleware';
import { calculateClassTeacherPermissions, getClassTeacherPermissionDeniedMessage } from '@shared/class-teacher-permissions';

const router = Router();

// ==================== REPORT CARD SKILLS API ROUTES ====================

// Get skills for a report card
router.get('/api/reports/:reportCardId/skills', authenticateUser, async (req: Request, res: Response) => {
    try {
        const { reportCardId } = req.params;
        const reportCard = await storage.getReportCard(Number(reportCardId));
        if (!reportCard) {
            return res.status(404).json({ message: 'Report card not found' });
        }
        const skills = await storage.getReportCardSkills(Number(reportCardId));
        res.json(skills || {});
    } catch (error: any) {
        console.error('Error getting skills:', error);
        res.status(500).json({ message: error.message || 'Failed to get skills' });
    }
});

// Save/update skills for a report card
// AUTHORIZATION: Only the class teacher or admins can rate skills
router.post('/api/reports/:reportCardId/skills', authenticateUser, authorizeRoles(ROLES.TEACHER, ROLES.ADMIN), async (req: Request, res: Response) => {
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

        const result = await storage.saveReportCardSkills(Number(reportCardId), { ...skillsData, recordedBy: userId });
        res.json(result);
    } catch (error: any) {
        console.error('Error saving skills:', error);
        res.status(500).json({ message: error.message || 'Failed to save skills' });
    }
});

// ==================== END REPORT CARD SKILLS API ROUTES ====================

export default router;
