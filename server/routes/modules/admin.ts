import { Router } from "express";
import { storage } from "../../storage";
import { authenticateUser, authorizeRoles, ROLES } from "../middleware";

const router = Router();

// ==================== REALTIME SYNC ENDPOINT ====================
const ALLOWED_SYNC_TABLES = ['classes', 'subjects', 'academic_terms', 'users', 'students', 'announcements', 'exams', 'homepage_content', 'notifications'];

router.post('/realtime/sync', authenticateUser, async (req, res) => {
  try {
    const { tables } = req.body as { tables: string[] };
    if (!Array.isArray(tables) || tables.length === 0) {
      return res.status(400).json({ message: 'Tables array is required' });
    }
    
    const normalizedTables = tables
      .filter(t => typeof t === 'string' && t.length > 0)
      .map(t => t.toLowerCase().trim());
    
    const invalidTables = normalizedTables.filter(t => !ALLOWED_SYNC_TABLES.includes(t));
    if (invalidTables.length > 0) {
      return res.status(400).json({ 
        message: 'Request contains invalid table names',
        invalidTables,
        allowedTables: ALLOWED_SYNC_TABLES 
      });
    }
    
    const uniqueTables = [...new Set(normalizedTables)];
    const userRoleId = req.user!.roleId;
    const userId = req.user!.id;
    
    const syncData: Record<string, any> = {};
    
    for (const table of uniqueTables) {
      switch (table) {
        case 'classes':
          syncData.classes = await storage.getClasses();
          break;
        case 'subjects':
          syncData.subjects = await storage.getSubjects();
          break;
        case 'academic_terms':
          syncData.academic_terms = await storage.getAcademicTerms();
          break;
        case 'users':
          if (userRoleId === ROLES.ADMIN || userRoleId === ROLES.SUPER_ADMIN) {
            const allUsers = await storage.getAllUsers();
            syncData.users = allUsers.map((u: any) => {
              const { passwordHash, ...safe } = u;
              return safe;
            });
          }
          break;
        case 'students':
          if (userRoleId === ROLES.ADMIN || userRoleId === ROLES.SUPER_ADMIN) {
            const allStudents = await storage.getAllStudents();
            syncData.students = Array.isArray(allStudents) ? allStudents : [];
          }
          break;
        case 'announcements':
          syncData.announcements = await storage.getAnnouncements();
          break;
        case 'exams':
          syncData.exams = await storage.getAllExams();
          break;
        case 'homepage_content':
          if (userRoleId === ROLES.ADMIN || userRoleId === ROLES.SUPER_ADMIN) {
            syncData.homepage_content = await storage.getHomePageContent();
          }
          break;
        case 'notifications':
          syncData.notifications = await storage.getNotificationsByUserId(userId);
          break;
      }
    }
    
    res.json({
      success: true,
      data: syncData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to sync realtime data' });
  }
});

// ==================== SYSTEM SETTINGS (ADMIN) ====================
router.get('/settings', authenticateUser, async (req, res) => {
  try {
    const settings = await storage.getSystemSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
});

export default router;
