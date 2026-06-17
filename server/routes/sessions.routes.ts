/**
 * Academic Sessions Routes
 *
 * CRUD for academic sessions (school years that group terms).
 * Sessions: e.g. "2024/2025 School Session"
 */

import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { authenticateUser, authorizeRoles, ROLES } from "./middleware";
import { sendSuccess, sendBadRequest, sendNotFound, handleRouteError } from "../utils/response-helpers";
import { checkSessionOverlap, checkTermOverlap } from "../academic-calendar-service";
import { realtimeService } from "../realtime-service";

const router = Router();

const YEAR_PATTERN = /^\d{4}\/\d{4}$/;

function validateYearFormat(year: string): { valid: boolean; error?: string } {
  if (!YEAR_PATTERN.test(year)) {
    return { valid: false, error: "Academic year must be in YYYY/YYYY format (e.g., 2024/2025)" };
  }
  const [startYear, endYear] = year.split("/").map(Number);
  if (endYear !== startYear + 1) {
    return { valid: false, error: "Academic year must span consecutive years (e.g., 2024/2025)" };
  }
  return { valid: true };
}

// GET /api/sessions — list all academic sessions
router.get("/", authenticateUser, async (req: Request, res: Response) => {
  try {
    const sessions = await storage.getAcademicSessions();
    sendSuccess(res, sessions);
  } catch (error) {
    handleRouteError(res, error, "sessions.list");
  }
});

// GET /api/sessions/active — get the currently active session
router.get("/active", authenticateUser, async (req: Request, res: Response) => {
  try {
    const session = await storage.getActiveAcademicSession();
    sendSuccess(res, session ?? null);
  } catch (error) {
    handleRouteError(res, error, "sessions.active");
  }
});

// GET /api/sessions/:id — get one session
router.get("/:id", authenticateUser, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return sendBadRequest(res, "Invalid session ID");
    const session = await storage.getAcademicSession(id);
    if (!session) return sendNotFound(res, "Academic session not found");
    sendSuccess(res, session);
  } catch (error) {
    handleRouteError(res, error, "sessions.get");
  }
});

// POST /api/sessions — create a session (admin only)
router.post("/", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
  try {
    const { name, year, startDate, endDate, description } = req.body;

    if (!name || !year || !startDate || !endDate) {
      return sendBadRequest(res, "Missing required fields: name, year, startDate, endDate");
    }

    const yearCheck = validateYearFormat(year);
    if (!yearCheck.valid) return sendBadRequest(res, yearCheck.error!);

    if (startDate >= endDate) {
      return sendBadRequest(res, "startDate must be before endDate");
    }

    const overlap = await checkSessionOverlap(startDate, endDate);
    if (overlap.hasOverlap) {
      const names = overlap.conflictingTerms.map(t => t.name).join(", ");
      return sendBadRequest(res, `Date range overlaps with existing session(s): ${names}`);
    }

    const session = await storage.createAcademicSession({ name, year, startDate, endDate, description, status: 'active', isCurrent: false });
    realtimeService.emitToRole("admin", "session.created", session);
    sendSuccess(res, session, 201);
  } catch (error: any) {
    if (error?.code === "23505") {
      return sendBadRequest(res, "An academic session for this year already exists.");
    }
    handleRouteError(res, error, "sessions.create");
  }
});

// PUT /api/sessions/:id — update a session
router.put("/:id", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return sendBadRequest(res, "Invalid session ID");

    const existing = await storage.getAcademicSession(id);
    if (!existing) return sendNotFound(res, "Academic session not found");

    const { name, year, startDate, endDate, description, status } = req.body;

    if (year) {
      const yearCheck = validateYearFormat(year);
      if (!yearCheck.valid) return sendBadRequest(res, yearCheck.error!);
    }

    const resolvedStart = startDate ?? existing.startDate;
    const resolvedEnd = endDate ?? existing.endDate;

    if (resolvedStart >= resolvedEnd) {
      return sendBadRequest(res, "startDate must be before endDate");
    }

    if (startDate || endDate) {
      const overlap = await checkSessionOverlap(resolvedStart, resolvedEnd, id);
      if (overlap.hasOverlap) {
        const names = overlap.conflictingTerms.map(t => t.name).join(", ");
        return sendBadRequest(res, `Date range overlaps with existing session(s): ${names}`);
      }
    }

    // When deactivating or archiving, also clear isCurrent flag
    const inactiveStatuses = ["inactive", "archived", "completed"];
    const isCurrent = status && inactiveStatuses.includes(status) ? false : undefined;

    const updates: any = { name, year, startDate, endDate, description, status };
    if (isCurrent === false) updates.isCurrent = false;

    const session = await storage.updateAcademicSession(id, updates);
    realtimeService.emitToRole("admin", "session.updated", session);
    sendSuccess(res, session);
  } catch (error: any) {
    if (error?.code === "23505") {
      return sendBadRequest(res, "An academic session for this year already exists.");
    }
    handleRouteError(res, error, "sessions.update");
  }
});

// DELETE /api/sessions/:id — delete a session
router.delete("/:id", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return sendBadRequest(res, "Invalid session ID");

    const existing = await storage.getAcademicSession(id);
    if (!existing) return sendNotFound(res, "Academic session not found");

    const success = await storage.deleteAcademicSession(id);
    if (!success) {
      return res.status(500).json({ message: "Failed to delete academic session." });
    }

    realtimeService.emitToRole("admin", "session.deleted", { id });
    sendSuccess(res, { message: "Academic session deleted successfully", id, success: true });
  } catch (error: any) {
    if (error?.code === "23503") {
      return sendBadRequest(res, "Cannot delete this session — it is linked to academic terms.");
    }
    handleRouteError(res, error, "sessions.delete");
  }
});

// PUT /api/sessions/:id/deactivate — explicitly deactivate: clears isCurrent + sets status to inactive
router.put("/:id/deactivate", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return sendBadRequest(res, "Invalid session ID");

    const existing = await storage.getAcademicSession(id);
    if (!existing) return sendNotFound(res, "Academic session not found");

    const session = await storage.updateAcademicSession(id, { isCurrent: false, status: "inactive" });
    realtimeService.emitToRole("admin", "session.deactivated", session);
    sendSuccess(res, session);
  } catch (error) {
    handleRouteError(res, error, "sessions.deactivate");
  }
});

// PUT /api/sessions/:id/mark-current — manually mark a session as current
router.put("/:id/mark-current", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return sendBadRequest(res, "Invalid session ID");

    const existing = await storage.getAcademicSession(id);
    if (!existing) return sendNotFound(res, "Academic session not found");

    const session = await storage.markSessionAsCurrent(id);
    realtimeService.emitToRole("admin", "session.current-changed", session);
    sendSuccess(res, session);
  } catch (error) {
    handleRouteError(res, error, "sessions.markCurrent");
  }
});

export default router;
