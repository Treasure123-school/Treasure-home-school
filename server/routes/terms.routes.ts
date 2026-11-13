/**
 * Academic Terms Routes
 * 
 * Handles CRUD operations for academic terms/semesters.
 */

import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { authenticateUser, authorizeRoles, ROLES } from "./middleware";
import { realtimeService } from "../realtime-service";
import { sendSuccess, sendBadRequest, sendNotFound, handleRouteError } from "../utils/response-helpers";
import { checkTermOverlap, getActiveSession, getActiveTerm } from "../academic-calendar-service";
import { db } from "../db";
import * as schema from "@shared/schema.pg";
import { and, eq, isNull, ne } from "drizzle-orm";

const router = Router();

const YEAR_PATTERN = /^\d{4}\/\d{4}$/;

function validateYearFormat(year: string): { valid: boolean; error?: string } {
  if (!YEAR_PATTERN.test(year)) {
    return { valid: false, error: 'Academic year must be in YYYY/YYYY format (e.g., 2024/2025)' };
  }
  const [startYear, endYear] = year.split('/').map(Number);
  if (endYear !== startYear + 1) {
    return { valid: false, error: 'Academic year must span consecutive years (e.g., 2024/2025)' };
  }
  return { valid: true };
}

/**
 * Guard against duplicate terms (e.g., two "First Term" rows in one session).
 * Uniqueness is (sessionId, name, year); the DB unique index is the backstop.
 */
async function findDuplicateTerm(name: string, year: string, sessionId: number | null, excludeId?: number): Promise<any | null> {
  const conditions = [eq(schema.academicTerms.name, name), eq(schema.academicTerms.year, year)];
  conditions.push(sessionId == null ? isNull(schema.academicTerms.sessionId) : eq(schema.academicTerms.sessionId, sessionId));
  if (excludeId != null) conditions.push(ne(schema.academicTerms.id, excludeId));
  const rows = await db.select().from(schema.academicTerms).where(and(...conditions)).limit(1);
  return rows[0] ?? null;
}

router.get('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const sessionId = req.query.sessionId ? parseInt(String(req.query.sessionId)) : null;
    const year = req.query.year ? String(req.query.year) : null;
    const scope = req.query.scope ? String(req.query.scope) : null;

    let terms = await storage.getAcademicTerms();

    if (sessionId !== null && !isNaN(sessionId)) {
      terms = terms.filter((t: any) => t.sessionId === sessionId);
    }
    if (year) {
      terms = terms.filter((t: any) => t.year === year);
    }
    // scope=current-session → terms of the currently active session only
    if (scope === 'current-session' && sessionId === null && !year) {
      const activeSession = await getActiveSession();
      if (activeSession) {
        terms = terms.filter((t: any) => t.sessionId === activeSession.id);
      } else {
        // Fall back to the current term's year (mirrors the calendar service)
        const currentTerm = await getActiveTerm();
        const currentYear = currentTerm?.year ?? null;
        terms = currentYear ? terms.filter((t: any) => t.year === currentYear) : [];
      }
    }

    sendSuccess(res, terms);
  } catch (error) {
    handleRouteError(res, error, 'terms.list');
  }
});

router.get('/grouped', authenticateUser, async (req: Request, res: Response) => {
  try {
    const terms = await storage.getAcademicTerms();
    const sessions = await storage.getAcademicSessions();
    const sessionById = new Map<number, any>(sessions.map((s: any) => [s.id, s]));

    const grouped: { [key: string]: any[] } = {};
    for (const term of terms) {
      // Prefer sessionId; fall back to year string for legacy terms without a session link
      const key = term.sessionId != null && sessionById.has(term.sessionId)
        ? `s:${term.sessionId}`
        : `y:${term.year}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(term);
    }

    const termOrder = ['First Term', 'Second Term', 'Third Term'];
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => {
        const aIndex = termOrder.findIndex(t => a.name.includes(t.replace(' Term', '')));
        const bIndex = termOrder.findIndex(t => b.name.includes(t.replace(' Term', '')));
        return aIndex - bIndex;
      });
    }

    const result = Object.entries(grouped)
      .sort((a, b) => {
        const aDate = a[1][0]?.startDate ?? '';
        const bDate = b[1][0]?.startDate ?? '';
        return bDate.localeCompare(aDate);
      })
      .map(([key, groupTerms]) => {
        const first = groupTerms[0];
        const session = first?.sessionId != null ? sessionById.get(first.sessionId) : undefined;
        return {
          key,
          sessionId: first?.sessionId ?? null,
          year: first?.year ?? '',
          sessionName: session?.name ?? null,
          terms: groupTerms,
        };
      });

    sendSuccess(res, result);
  } catch (error) {
    handleRouteError(res, error, 'terms.grouped');
  }
});

router.post('/', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: any, res: Response) => {
  try {
    if (!req.body.name || !req.body.year || !req.body.startDate || !req.body.endDate) {
      return sendBadRequest(res, 'Missing required fields: name, year, startDate, endDate');
    }
    
    const yearValidation = validateYearFormat(req.body.year);
    if (!yearValidation.valid) {
      return sendBadRequest(res, yearValidation.error!);
    }

    if (req.body.startDate >= req.body.endDate) {
      return sendBadRequest(res, 'startDate must be before endDate');
    }

    const sessionId = req.body.sessionId ?? null;

    const duplicate = await findDuplicateTerm(req.body.name, req.body.year, sessionId);
    if (duplicate) {
      return sendBadRequest(res, `A term named "${req.body.name}" already exists in this session (${req.body.year}). Use a different name or pick another session.`);
    }

    const overlap = await checkTermOverlap(req.body.startDate, req.body.endDate, undefined, sessionId);
    if (overlap.hasOverlap) {
      const names = overlap.conflictingTerms.map((t: any) => t.name).join(', ');
      const hint = sessionId == null
        ? ` (Tip: assign this term to a session to isolate date ranges per school year)`
        : '';
      return sendBadRequest(res, `Date range overlaps with: ${names}.${hint}`);
    }
    
    const term = await storage.createAcademicTerm(req.body);
    
    realtimeService.emitTableChange('academic_terms', 'INSERT', term, undefined, req.user!.id);
    realtimeService.emitToRole('admin', 'term.created', term);
    realtimeService.emitToRole('teacher', 'term.created', term);
    
    sendSuccess(res, term);
  } catch (error: any) {
    if (error?.code === '23505') {
      return sendBadRequest(res, 'A term with this name already exists in the selected session.');
    }
    handleRouteError(res, error, 'terms.create');
  }
});

router.put('/:id', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: any, res: Response) => {
  try {
    const termId = parseInt(req.params.id);
    if (isNaN(termId)) {
      return sendBadRequest(res, 'Invalid term ID');
    }

    const existingTerm = await storage.getAcademicTerm(termId);
    if (!existingTerm) {
      return sendNotFound(res, 'Academic term not found');
    }

    if ((existingTerm as any).isLocked && req.body.isLocked !== false) {
      return res.status(403).json({ message: 'This term is locked and cannot be edited. Unlock it first.' });
    }
    
    if (req.body.year) {
      const yearValidation = validateYearFormat(req.body.year);
      if (!yearValidation.valid) {
        return sendBadRequest(res, yearValidation.error!);
      }
    }

    if (req.body.startDate || req.body.endDate) {
      const resolvedStart = req.body.startDate ?? existingTerm.startDate;
      const resolvedEnd = req.body.endDate ?? existingTerm.endDate;
      if (resolvedStart >= resolvedEnd) {
        return sendBadRequest(res, 'startDate must be before endDate');
      }
      const sessionId = req.body.sessionId ?? (existingTerm as any).sessionId ?? null;
      const overlap = await checkTermOverlap(resolvedStart, resolvedEnd, termId, sessionId);
      if (overlap.hasOverlap) {
        const names = overlap.conflictingTerms.map((t: any) => t.name).join(', ');
        const hint = sessionId == null ? ` (Tip: assign this term to a session to isolate date ranges per school year)` : '';
        return sendBadRequest(res, `Date range overlaps with: ${names}.${hint}`);
      }
    }

    // Duplicate guard when name/year/session identity changes
    const newName = req.body.name ?? existingTerm.name;
    const newYear = req.body.year ?? existingTerm.year;
    const newSessionId = req.body.sessionId !== undefined ? req.body.sessionId : (existingTerm as any).sessionId ?? null;
    if (req.body.name || req.body.year || req.body.sessionId !== undefined) {
      const duplicate = await findDuplicateTerm(newName, newYear, newSessionId, termId);
      if (duplicate) {
        return sendBadRequest(res, `A term named "${newName}" already exists in this session (${newYear}).`);
      }
    }

    const term = await storage.updateAcademicTerm(termId, req.body);
    
    realtimeService.emitTableChange('academic_terms', 'UPDATE', term, existingTerm, req.user!.id);
    realtimeService.emitToRole('admin', 'term.updated', term);
    realtimeService.emitToRole('teacher', 'term.updated', term);
    
    sendSuccess(res, term);
  } catch (error: any) {
    if (error?.code === '23505') {
      return sendBadRequest(res, 'A term with this name already exists in the selected session.');
    }
    handleRouteError(res, error, 'terms.update');
  }
});

router.delete('/:id', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: any, res: Response) => {
  try {
    const termId = parseInt(req.params.id);
    if (isNaN(termId)) {
      return sendBadRequest(res, 'Invalid term ID');
    }

    const existingTerm = await storage.getAcademicTerm(termId);
    const success = await storage.deleteAcademicTerm(termId);

    if (!success) {
      return res.status(500).json({
        message: 'Failed to delete academic term. The term may not exist or could not be removed.'
      });
    }
    
    realtimeService.emitTableChange('academic_terms', 'DELETE', { id: termId }, existingTerm, req.user!.id);
    realtimeService.emitToRole('admin', 'term.deleted', { id: termId, ...existingTerm });
    realtimeService.emitToRole('teacher', 'term.deleted', { id: termId, ...existingTerm });
    
    sendSuccess(res, { message: 'Academic term deleted successfully', id: termId, success: true });
  } catch (error: any) {
    if (error.code === '23503' || error.message?.includes('linked to it')) {
      return sendBadRequest(res, error.message || 'Cannot delete this term because it is being used by other records.');
    }
    handleRouteError(res, error, 'terms.delete');
  }
});

router.put('/:id/mark-current', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: any, res: Response) => {
  try {
    const termId = parseInt(req.params.id);
    if (isNaN(termId)) {
      return sendBadRequest(res, 'Invalid term ID');
    }

    const existingTerm = await storage.getAcademicTerm(termId);
    if (!existingTerm) {
      return sendNotFound(res, 'Academic term not found');
    }

    const term = await storage.markTermAsCurrent(termId);
    
    realtimeService.emitTableChange('academic_terms', 'UPDATE', term, existingTerm, req.user!.id);
    realtimeService.emitToRole('admin', 'term.current-changed', term);
    realtimeService.emitToRole('teacher', 'term.current-changed', term);
    
    sendSuccess(res, term);
  } catch (error) {
    handleRouteError(res, error, 'terms.markCurrent');
  }
});

router.put('/:id/toggle-lock', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: any, res: Response) => {
  try {
    const termId = parseInt(req.params.id);
    if (isNaN(termId)) {
      return sendBadRequest(res, 'Invalid term ID');
    }

    const existingTerm = await storage.getAcademicTerm(termId);
    if (!existingTerm) {
      return sendNotFound(res, 'Academic term not found');
    }

    const newLockState = !(existingTerm as any).isLocked;
    const term = await storage.updateAcademicTerm(termId, { isLocked: newLockState });
    
    realtimeService.emitTableChange('academic_terms', 'UPDATE', term, existingTerm, req.user!.id);
    realtimeService.emitToRole('admin', 'term.lock-toggled', term);
    
    sendSuccess(res, term);
  } catch (error) {
    handleRouteError(res, error, 'terms.toggleLock');
  }
});

router.put('/:id/status', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: any, res: Response) => {
  try {
    const termId = parseInt(req.params.id);
    if (isNaN(termId)) {
      return sendBadRequest(res, 'Invalid term ID');
    }

    const existingTerm = await storage.getAcademicTerm(termId);
    if (!existingTerm) {
      return sendNotFound(res, 'Academic term not found');
    }

    if (!req.body.status) {
      return sendBadRequest(res, 'Status is required');
    }

    // When deactivating or archiving, clear isCurrent; archiving also locks the term
    const inactiveStatuses = ['completed', 'inactive', 'archived'];
    const updates: any = { status: req.body.status };
    if (inactiveStatuses.includes(req.body.status)) {
      updates.isCurrent = false;
    }
    if (req.body.status === 'archived') {
      updates.isLocked = true;
    }

    const term = await storage.updateAcademicTerm(termId, updates);
    
    realtimeService.emitTableChange('academic_terms', 'UPDATE', term, existingTerm, req.user!.id);
    realtimeService.emitToRole('admin', 'term.status-changed', term);
    
    sendSuccess(res, term);
  } catch (error) {
    handleRouteError(res, error, 'terms.updateStatus');
  }
});

// PUT /api/terms/:id/deactivate — explicit deactivate: clears isCurrent + sets status to inactive
router.put('/:id/deactivate', authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: any, res: Response) => {
  try {
    const termId = parseInt(req.params.id);
    if (isNaN(termId)) return sendBadRequest(res, 'Invalid term ID');

    const existingTerm = await storage.getAcademicTerm(termId);
    if (!existingTerm) return sendNotFound(res, 'Academic term not found');

    const term = await storage.updateAcademicTerm(termId, { isCurrent: false, status: 'inactive' });

    realtimeService.emitTableChange('academic_terms', 'UPDATE', term, existingTerm, req.user!.id);
    realtimeService.emitToRole('admin', 'term.deactivated', term);

    sendSuccess(res, term);
  } catch (error) {
    handleRouteError(res, error, 'terms.deactivate');
  }
});

export default router;
