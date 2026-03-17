import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { authenticateUser, authorizeRoles, ROLES, AuthenticatedUser } from './middleware';

const router = Router();

// ==================== SETTINGS API ROUTES ====================
// Settings API endpoints (for report card subject rules, etc.)
router.get('/api/settings', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
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

router.put('/api/settings', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
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

export default router;
