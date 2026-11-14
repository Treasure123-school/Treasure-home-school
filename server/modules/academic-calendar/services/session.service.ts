/**
 * Academic Session Service
 * 
 * Business logic for session operations
 */

import { storage } from "../../../storage";
import { realtimeService } from "../../../realtime-service";
import { checkSessionOverlap } from "../academic-calendar.service";

export interface ServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateSessionData {
  name: string;
  year: string;
  startDate: string;
  endDate: string;
  description?: string;
  createTerms?: boolean;
}

export interface UpdateSessionData {
  name?: string;
  year?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  status?: string;
}

/**
 * Get all academic sessions
 */
export async function getAllSessions() {
  return await storage.getAcademicSessions();
}

/**
 * Get active academic session
 */
export async function getActiveSession() {
  return await storage.getActiveAcademicSession();
}

/**
 * Get session by ID
 */
export async function getSessionById(id: number) {
  return await storage.getAcademicSession(id);
}

/**
 * Create new academic session
 */
export async function createSession(data: CreateSessionData): Promise<ServiceResult> {
  // Check for date overlap
  const overlap = await checkSessionOverlap(data.startDate, data.endDate);
  if (overlap.hasOverlap) {
    const names = overlap.conflictingTerms.map(t => t.name).join(", ");
    return {
      success: false,
      error: `Date range overlaps with existing session(s): ${names}`,
    };
  }

  // Create session
  const session = await storage.createAcademicSession({
    name: data.name,
    year: data.year,
    startDate: data.startDate,
    endDate: data.endDate,
    description: data.description,
    status: 'active',
    isCurrent: false,
  });

  // Optionally scaffold terms
  let scaffoldedTerms: any[] = [];
  if (data.createTerms) {
    scaffoldedTerms = await scaffoldTermsForSession(session, data.startDate, data.endDate, data.year);
  }

  // Emit realtime event
  realtimeService.emitToRole("admin", "session.created", session);

  return {
    success: true,
    data: { ...session, scaffoldedTerms },
  };
}

/**
 * Update academic session
 */
export async function updateSession(id: number, data: UpdateSessionData): Promise<ServiceResult> {
  // Check if session exists
  const existing = await storage.getAcademicSession(id);
  if (!existing) {
    return {
      success: false,
      error: "Academic session not found",
    };
  }

  // Resolve dates for overlap check
  const resolvedStart = data.startDate ?? existing.startDate;
  const resolvedEnd = data.endDate ?? existing.endDate;

  // Validate date range
  if (resolvedStart >= resolvedEnd) {
    return {
      success: false,
      error: "startDate must be before endDate",
    };
  }

  // Check for overlap if dates changed
  if (data.startDate || data.endDate) {
    const overlap = await checkSessionOverlap(resolvedStart, resolvedEnd, id);
    if (overlap.hasOverlap) {
      const names = overlap.conflictingTerms.map(t => t.name).join(", ");
      return {
        success: false,
        error: `Date range overlaps with existing session(s): ${names}`,
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
    description: data.description,
    status: data.status,
  };
  if (isCurrent === false) updates.isCurrent = false;

  // Update session
  const session = await storage.updateAcademicSession(id, updates);

  // Emit realtime event
  realtimeService.emitToRole("admin", "session.updated", session);

  return {
    success: true,
    data: session,
  };
}

/**
 * Delete academic session
 */
export async function deleteSession(id: number): Promise<ServiceResult> {
  // Check if session exists
  const existing = await storage.getAcademicSession(id);
  if (!existing) {
    return {
      success: false,
      error: "Academic session not found",
    };
  }

  // Delete session
  const success = await storage.deleteAcademicSession(id);
  if (!success) {
    return {
      success: false,
      error: "Failed to delete academic session",
    };
  }

  // Emit realtime event
  realtimeService.emitToRole("admin", "session.deleted", { id });

  return {
    success: true,
    data: { id, success: true },
  };
}

/**
 * Deactivate session
 */
export async function deactivateSession(id: number): Promise<ServiceResult> {
  // Check if session exists
  const existing = await storage.getAcademicSession(id);
  if (!existing) {
    return {
      success: false,
      error: "Academic session not found",
    };
  }

  // Deactivate
  const session = await storage.updateAcademicSession(id, {
    isCurrent: false,
    status: "inactive",
  });

  // Emit realtime event
  realtimeService.emitToRole("admin", "session.deactivated", session);

  return {
    success: true,
    data: session,
  };
}

/**
 * Mark session as current
 */
export async function markAsCurrent(id: number): Promise<ServiceResult> {
  // Check if session exists
  const existing = await storage.getAcademicSession(id);
  if (!existing) {
    return {
      success: false,
      error: "Academic session not found",
    };
  }

  // Mark as current
  const session = await storage.markSessionAsCurrent(id);

  // Emit realtime event
  realtimeService.emitToRole("admin", "session.current-changed", session);

  return {
    success: true,
    data: session,
  };
}

/**
 * Helper: Scaffold standard terms for a new session
 */
async function scaffoldTermsForSession(
  session: any,
  startDate: string,
  endDate: string,
  year: string
): Promise<any[]> {
  const startMs = new Date(startDate).getTime();
  const endMs = new Date(endDate).getTime();
  const span = Math.max(0, endMs - startMs);
  const day = 24 * 60 * 60 * 1000;
  const boundaries = [0, 1 / 3, 2 / 3, 1].map(f => startMs + span * f);
  const names3 = ["First Term", "Second Term", "Third Term"];
  const status3 = ["active", "upcoming", "upcoming"];

  const terms: any[] = [];
  for (let i = 0; i < 3; i++) {
    const tStart = new Date(boundaries[i]).toISOString().split("T")[0];
    const tEnd = new Date(boundaries[i + 1] - day).toISOString().split("T")[0];
    try {
      const term = await storage.createAcademicTerm({
        name: names3[i],
        year,
        startDate: tStart,
        endDate: tEnd,
        sessionId: session.id,
        status: status3[i],
        isCurrent: false,
      });
      terms.push(term);
    } catch (termError: any) {
      console.error(
        "[sessions.create] scaffold term failed:",
        names3[i],
        termError?.message ?? termError
      );
    }
  }

  return terms;
}
