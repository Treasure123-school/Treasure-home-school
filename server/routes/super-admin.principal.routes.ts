/** Super admin + leadership — designated principal management.
/** Auto-split from routes.ts — super-admin (orig lines 10068-10779). See git history. */
import * as schema from '@shared/schema.pg';
import { upload } from '../routes/upload-config';
import { enhancedCache } from '../enhanced-cache';
import { PerformanceCache, performanceCache } from '../performance-cache';
import { realtimeService } from '../realtime-service';
import { ROLES, authenticateUser, authorizeRoles } from '../routes/middleware';
import { db, storage } from '../storage';
import { uploadFileToStorage } from '../upload-service';
import { generateAdminUsername } from '../username-generator';
import { users } from '@shared/schema.pg';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { type Express, type Request, type Response } from 'express';
import path from 'path';
import sharp from 'sharp';
import { ZodError, z } from 'zod';


export function registerSuperAdminPrincipalRoutes(app: Express) {

  // ==================== PRINCIPAL DESIGNATION ROUTES ====================

  // GET /api/superadmin/principal — return current designated principal + all admin users for selection
  app.get('/api/superadmin/principal', authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
    try {
      const [sysSettings] = await db.select().from(schema.systemSettings).limit(1);
      const designatedPrincipalId = (sysSettings as any)?.designatedPrincipalId || null;

      // Direct JOIN — no reliance on storage.getUser()
      const adminRows = await db
        .select({
          id: schema.users.id,
          username: schema.users.username,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
        })
        .from(schema.adminProfiles)
        .innerJoin(schema.users, eq(schema.adminProfiles.userId, schema.users.id))
        .orderBy(schema.users.firstName);

      const admins = adminRows.map((row: any) => ({
        id: row.id,
        username: row.username,
        name: `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.username,
      }));

      res.json({ designatedPrincipalId, admins });
    } catch (error: any) {
      console.error('[principal route] error:', error);
      res.status(500).json({ message: 'Failed to fetch principal settings', detail: error?.message });
    }
  });

  // PUT /api/superadmin/principal — set the designated principal
  app.put('/api/superadmin/principal', authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
    try {
      const { designatedPrincipalId } = req.body;
      // Validate: must be an existing admin (or null to clear)
      if (designatedPrincipalId) {
        const [adminProfile] = await db
          .select({ userId: schema.adminProfiles.userId })
          .from(schema.adminProfiles)
          .where(eq(schema.adminProfiles.userId, designatedPrincipalId))
          .limit(1);
        if (!adminProfile) return res.status(400).json({ message: 'Selected user is not an admin' });
      }
      await storage.updateSystemSettings({ designatedPrincipalId: designatedPrincipalId || null } as any);
      await storage.createAuditLog({
        userId: req.user!.id,
        action: 'principal_designated',
        entityType: 'system_settings',
        entityId: designatedPrincipalId || 'none',
        reason: `Principal designation updated by Super Admin`,
      });
      res.json({ success: true, designatedPrincipalId: designatedPrincipalId || null });
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to update principal designation' });
    }
  });

  // ==================== SCHOOL LEADERSHIP ROUTES (Admin + Super Admin) ====================

  // GET /api/leadership/principal — current designation + all admins with signature info
  app.get('/api/leadership/principal', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const [sysSettings] = await db.select().from(schema.systemSettings).limit(1);
      const designatedPrincipalId = (sysSettings as any)?.designatedPrincipalId || null;

      const adminRows = await db
        .select({
          id: schema.users.id,
          username: schema.users.username,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          signatureUrl: schema.adminProfiles.signatureUrl,
        })
        .from(schema.adminProfiles)
        .innerJoin(schema.users, eq(schema.adminProfiles.userId, schema.users.id))
        .orderBy(schema.users.firstName);

      const admins = adminRows.map((row: any) => ({
        id: row.id,
        username: row.username,
        name: `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.username,
        signatureUrl: row.signatureUrl || null,
        hasSignature: !!(row.signatureUrl && row.signatureUrl.trim()),
      }));

      const currentPrincipal = designatedPrincipalId
        ? (admins.find((a: any) => a.id === designatedPrincipalId) ?? null)
        : null;

      res.json({ designatedPrincipalId, admins, currentPrincipal });
    } catch (error: any) {
      console.error('[leadership/principal GET] error:', error);
      res.status(500).json({ message: 'Failed to fetch leadership settings' });
    }
  });

  // PUT /api/leadership/principal — assign or clear the designated principal
  app.put('/api/leadership/principal', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: Request, res: Response) => {
    try {
      const { designatedPrincipalId } = req.body;
      if (designatedPrincipalId) {
        const [adminProfile] = await db
          .select({ userId: schema.adminProfiles.userId })
          .from(schema.adminProfiles)
          .where(eq(schema.adminProfiles.userId, designatedPrincipalId))
          .limit(1);
        if (!adminProfile) return res.status(400).json({ message: 'Selected user is not a school admin' });
      }
      await storage.updateSystemSettings({ designatedPrincipalId: designatedPrincipalId || null } as any);
      await storage.createAuditLog({
        userId: req.user!.id,
        action: 'principal_designated',
        entityType: 'system_settings',
        entityId: designatedPrincipalId || 'none',
        reason: `Principal designation updated by ${(req.user as any)?.role || 'admin'}`,
      });
      res.json({ success: true, designatedPrincipalId: designatedPrincipalId || null });
    } catch (error: any) {
      console.error('[leadership/principal PUT] error:', error);
      res.status(500).json({ message: error.message || 'Failed to update principal designation' });
    }
  });
}
