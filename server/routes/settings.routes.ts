import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { authenticateUser, authorizeRoles, ROLES, AuthenticatedUser } from './middleware';

const router = Router();

// ==================== SETTINGS API ROUTES ====================
// Settings API endpoints (for report card subject rules, etc.)
router.get('/api/settings', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
        const { key } = req.query;
        if (key) {
            const setting = await storage.getSetting(key as string);
            if (!setting) {
                return res.status(404).json({ message: 'Setting not found' });
            }
            return res.json(setting);
        }
        const settings = await storage.getAllSettings();
        res.json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ message: 'Failed to fetch settings' });
    }
});

router.put('/api/settings', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
        const { key, value, description, dataType } = req.body;

        // Validate required fields
        if (!key || typeof key !== 'string' || key.trim().length === 0) {
            return res.status(400).json({ message: 'Setting key is required and must be a non-empty string' });
        }
        if (value === undefined || value === null) {
            return res.status(400).json({ message: 'Setting value is required' });
        }

        const userId = (req.user as AuthenticatedUser).id;
        const trimmedKey = key.trim();
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

        const existing = await storage.getSetting(trimmedKey);

        if (existing) {
            const updated = await storage.updateSetting(trimmedKey, stringValue, userId);
            return res.json(updated);
        } else {
            const created = await storage.createSetting({
                key: trimmedKey,
                value: stringValue,
                description: description || '',
                dataType: dataType || 'string',
                updatedBy: userId
            });
            return res.json(created);
        }
    } catch (error) {
        console.error('Error saving setting:', error);
        res.status(500).json({ message: 'Failed to save setting' });
    }
});
// ==================== END SETTINGS API ROUTES ====================

// ==================== ADMIN SYSTEM SETTINGS ====================
// Fields that Admin (non-superadmin) is permitted to read and update
const ADMIN_EDITABLE_FIELDS = new Set([
  'schoolName', 'schoolShortName', 'schoolMotto',
  'schoolAddress', 'schoolPhones', 'schoolEmails',
  'websiteTitle', 'footerText',
  'testWeight', 'examWeight', 'defaultGradingScale', 'scoreAggregationMode',
  'positioningMethod', 'autoCreateReportCard', 'showGradeBreakdown',
  'allowTeacherOverrides', 'requireExamPayment', 'examFeeAmount',
  'enableSmsNotifications', 'enableEmailNotifications',
  'usernameStudentPrefix', 'usernameParentPrefix',
  'usernameTeacherPrefix', 'usernameAdminPrefix',
  'tempPasswordFormat',
]);

router.get('/api/admin/settings', authenticateUser, authorizeRoles(ROLES.ADMIN), async (_req: Request, res: Response) => {
  try {
    const settings = await storage.getSystemSettings();
    res.json(settings || {});
  } catch (error) {
    console.error('Error fetching admin settings:', error);
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
});

router.put('/api/admin/settings', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
  try {
    const input = req.body as Record<string, any>;
    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      if (ADMIN_EDITABLE_FIELDS.has(key)) {
        filtered[key] = value;
      }
    }
    if (Object.keys(filtered).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided' });
    }
    filtered.updatedBy = (req.user as AuthenticatedUser).id;
    const settings = await storage.updateSystemSettings(filtered);
    await storage.createAuditLog({
      userId: (req.user as AuthenticatedUser).id,
      action: 'admin_settings_updated',
      entityType: 'system_settings',
      entityId: 'school_settings',
      reason: `Admin updated settings: ${Object.keys(filtered).filter(k => k !== 'updatedBy').join(', ')}`,
    });
    return res.json(settings);
  } catch (error) {
    console.error('Error updating admin settings:', error);
    res.status(500).json({ message: 'Failed to update settings' });
  }
});
// ==================== END ADMIN SYSTEM SETTINGS ====================

export default router;
