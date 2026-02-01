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

router.get('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const terms = await storage.getAcademicTerms();
    sendSuccess(res, terms);
  } catch (error) {
    handleRouteError(res, error, 'terms.list');
  }
});

router.get('/grouped', authenticateUser, async (req: Request, res: Response) => {
  try {
    const terms = await storage.getAcademicTerms();
    
    const grouped: { [year: string]: any[] } = {};
    for (const term of terms) {
      if (!grouped[term.year]) {
        grouped[term.year] = [];
      }
      grouped[term.year].push(term);
    }

    const termOrder = ['First Term', 'Second Term', 'Third Term'];
    for (const year of Object.keys(grouped)) {
      grouped[year].sort((a, b) => {
        const aIndex = termOrder.findIndex(t => a.name.includes(t.replace(' Term', '')));
        const bIndex = termOrder.findIndex(t => b.name.includes(t.replace(' Term', '')));
        return aIndex - bIndex;
      });
    }

    const result = Object.entries(grouped)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, terms]) => ({ year, terms }));

    sendSuccess(res, result);
  } catch (error) {
    handleRouteError(res, error, 'terms.grouped');
  }
});

router.post('/', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
  try {
    if (!req.body.name || !req.body.year || !req.body.startDate || !req.body.endDate) {
      return sendBadRequest(res, 'Missing required fields: name, year, startDate, endDate');
    }
    
    const yearValidation = validateYearFormat(req.body.year);
    if (!yearValidation.valid) {
      return sendBadRequest(res, yearValidation.error!);
    }
    
    const term = await storage.createAcademicTerm(req.body);
    
    realtimeService.emitTableChange('academic_terms', 'INSERT', term, undefined, req.user!.id);
    realtimeService.emitToRole('admin', 'term.created', term);
    realtimeService.emitToRole('teacher', 'term.created', term);
    
    sendSuccess(res, term);
  } catch (error) {
    handleRouteError(res, error, 'terms.create');
  }
});

router.put('/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
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

    const term = await storage.updateAcademicTerm(termId, req.body);
    
    realtimeService.emitTableChange('academic_terms', 'UPDATE', term, existingTerm, req.user!.id);
    realtimeService.emitToRole('admin', 'term.updated', term);
    realtimeService.emitToRole('teacher', 'term.updated', term);
    
    sendSuccess(res, term);
  } catch (error) {
    handleRouteError(res, error, 'terms.update');
  }
});

router.delete('/:id', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
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

router.put('/:id/mark-current', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
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

router.put('/:id/toggle-lock', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
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

router.put('/:id/status', authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
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

    const term = await storage.updateAcademicTerm(termId, { status: req.body.status });
    
    realtimeService.emitTableChange('academic_terms', 'UPDATE', term, existingTerm, req.user!.id);
    realtimeService.emitToRole('admin', 'term.status-changed', term);
    
    sendSuccess(res, term);
  } catch (error) {
    handleRouteError(res, error, 'terms.updateStatus');
  }
});

export default router;
