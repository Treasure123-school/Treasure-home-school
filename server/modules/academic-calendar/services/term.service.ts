/**
 * Academic Term Service
 * 
 * Business logic for term operations
 */

import { storage } from "../../../storage";
import { realtimeService } from "../../../realtime-service";
import { checkTermOverlap } from "../academic-calendar.service";

export interface ServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateTermData {
  name: string;
  year: string;
  startDate: string;
  endDate: string;
  sessionId?: number | null;
  description?: string;
}

export interface UpdateTermData {
  name?: string;
  year?: string;
  startDate?: string;
  endDate?: string;
  sessionId?: number | null;
  description?: string;
  status?: string;
}

/**
 * Get all academic terms
 */
export async function getAllTerms() {
  return await storage.getAcademicTerms();
}

/**
 * Get active academic term
 */
export async function getActiveTerm() {
  return await storage.getCurrentTerm();
}

/**
 * Get term by ID
 */
export async function getTermById(id: number) {
  return await storage.getAcademicTerm(id);
}

/**
 * Create new academic term
 */
export async function createTerm(data: CreateTermData): Promise<ServiceResult> {
  // Check for date overlap
  const overlap = await checkTermOverlap(data.startDate, data.endDate, data.sessionId ?? undefined);
  if (overlap.hasOverlap) {
    const names = overlap.conflictingTerms.map(t => t.name).join(", ");
    return {
      success: false,
      error: `Date range overlaps with existing term(s): ${names}`,
    };
  }

  // Create term
  const term = await storage.createAcademicTerm({
    name: data.name,
    year: data.year,
    startDate: data.startDate,
    endDate: data.endDate,
    sessionId: data.sessionId,
    description: data.description,
    status: 'upcoming',
    isCurrent: false,
  });

  // Emit realtime event
  realtimeService.emitToRole("admin", "term.created", term);

  return {
    success: true,
    data: term,
  };
}

/**
 * Update academic term
 */
export async function updateTerm(id: number, data: UpdateTermData): Promise<ServiceResult> {
  // Check if term exists
  const existing = await storage.getAcademicTerm(id);
  if (!existing) {
    return {
      success: false,
      error: "Academic term not found",
    };
  }

  // Resolve dates for overlap check
  const resolvedStart = data.startDate ?? existing.startDate;
  const resolvedEnd = data.endDate ?? existing.endDate;
  const resolvedSessionId = data.sessionId !== undefined ? data.sessionId : existing.sessionId;

  // Validate date range
  if (resolvedStart >= resolvedEnd) {
    return {
      success: false,
      error: "startDate must be before endDate",
    };
  }

  // Check for overlap if dates or session changed
  if (data.startDate || data.endDate || data.sessionId !== undefined) {
    const overlap = await checkTermOverlap(resolvedStart, resolvedEnd, resolvedSessionId ?? undefined, id);
    if (overlap.hasOverlap) {
      const names = overlap.conflictingTerms.map(t => t.name).join(", ");
      return {
        success: false,
        error: `Date range overlaps with existing term(s): ${names}`,
      };
    }
  }

  // When deactivating or archiving, clear isCurrent flag
  const inactiveStatuses = ["inactive", "archived", "completed"];
  const isCurrent = data.status && inactiveStatuses.includes(data.status) ? false : undefined;

  const updates: any = {
    name: data.name,
    year: data.year,
    startDate: data.startDate,
    endDate: data.endDate,
    sessionId: data.sessionId,
    description: data.description,
    status: data.status,
  };
  if (isCurrent === false) updates.isCurrent = false;

  // Update term
  const term = await storage.updateAcademicTerm(id, updates);

  // Emit realtime event
  realtimeService.emitToRole("admin", "term.updated", term);

  return {
    success: true,
    data: term,
  };
}

/**
 * Update term status
 */
export async function updateTermStatus(id: number, status: string): Promise<ServiceResult> {
  // Check if term exists
  const existing = await storage.getAcademicTerm(id);
  if (!existing) {
    return {
      success: false,
      error: "Academic term not found",
    };
  }

  // When deactivating or archiving, clear isCurrent flag
  const inactiveStatuses = ["inactive", "archived", "completed"];
  const isCurrent = inactiveStatuses.includes(status) ? false : undefined;

  const updates: any = { status };
  if (isCurrent === false) updates.isCurrent = false;

  // Update term
  const term = await storage.updateAcademicTerm(id, updates);

  // Emit realtime event
  realtimeService.emitToRole("admin", "term.updated", term);

  return {
    success: true,
    data: term,
  };
}

/**
 * Delete academic term
 */
export async function deleteTerm(id: number): Promise<ServiceResult> {
  // Check if term exists
  const existing = await storage.getAcademicTerm(id);
  if (!existing) {
    return {
      success: false,
      error: "Academic term not found",
    };
  }

  // Delete term
  const success = await storage.deleteAcademicTerm(id);
  if (!success) {
    return {
      success: false,
      error: "Failed to delete academic term",
    };
  }

  // Emit realtime event
  realtimeService.emitToRole("admin", "term.deleted", { id });

  return {
    success: true,
    data: { id, success: true },
  };
}

/**
 * Deactivate term
 */
export async function deactivateTerm(id: number): Promise<ServiceResult> {
  // Check if term exists
  const existing = await storage.getAcademicTerm(id);
  if (!existing) {
    return {
      success: false,
      error: "Academic term not found",
    };
  }

  // Deactivate
  const term = await storage.updateAcademicTerm(id, {
    isCurrent: false,
    status: "inactive",
  });

  // Emit realtime event
  realtimeService.emitToRole("admin", "term.deactivated", term);

  return {
    success: true,
    data: term,
  };
}

/**
 * Mark term as current
 */
export async function markAsCurrent(id: number): Promise<ServiceResult> {
  // Check if term exists
  const existing = await storage.getAcademicTerm(id);
  if (!existing) {
    return {
      success: false,
      error: "Academic term not found",
    };
  }

  // Mark as current
  const term = await storage.markTermAsCurrent(id);

  // Emit realtime event
  realtimeService.emitToRole("admin", "term.current-changed", term);

  return {
    success: true,
    data: term,
  };
}
