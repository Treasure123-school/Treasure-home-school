/**
 * Academic Session Controller
 * 
 * Handles HTTP requests/responses for session operations
 */

import { Request, Response } from "express";
import { sendSuccess, sendBadRequest, sendNotFound, handleRouteError } from "../../../utils/response-helpers";
import * as sessionService from "../services/session.service";
import * as sessionValidator from "../validators/session.validator";

/**
 * GET /api/sessions - List all academic sessions
 */
export async function listSessions(req: Request, res: Response) {
  try {
    const sessions = await sessionService.getAllSessions();
    sendSuccess(res, sessions);
  } catch (error) {
    handleRouteError(res, error, "sessions.list");
  }
}

/**
 * GET /api/sessions/active - Get currently active session
 */
export async function getActiveSession(req: Request, res: Response) {
  try {
    const session = await sessionService.getActiveSession();
    sendSuccess(res, session ?? null);
  } catch (error) {
    handleRouteError(res, error, "sessions.active");
  }
}

/**
 * GET /api/sessions/:id - Get single session by ID
 */
export async function getSessionById(req: Request, res: Response) {
  try {
    const validation = sessionValidator.validateSessionId(req.params.id);
    if (!validation.valid) {
      return sendBadRequest(res, validation.error!);
    }

    const session = await sessionService.getSessionById(validation.id!);
    if (!session) {
      return sendNotFound(res, "Academic session not found");
    }

    sendSuccess(res, session);
  } catch (error) {
    handleRouteError(res, error, "sessions.get");
  }
}

/**
 * POST /api/sessions - Create new session
 */
export async function createSession(req: any, res: Response) {
  try {
    const { name, year, startDate, endDate, description, createTerms } = req.body;

    // Validate required fields
    const fieldsValidation = sessionValidator.validateSessionCreateFields(req.body);
    if (!fieldsValidation.valid) {
      return sendBadRequest(res, fieldsValidation.error!);
    }

    // Validate year format
    const yearValidation = sessionValidator.validateYearFormat(year);
    if (!yearValidation.valid) {
      return sendBadRequest(res, yearValidation.error!);
    }

    // Validate date range
    const dateValidation = sessionValidator.validateDateRange(startDate, endDate);
    if (!dateValidation.valid) {
      return sendBadRequest(res, dateValidation.error!);
    }

    // Create session
    const result = await sessionService.createSession({
      name,
      year,
      startDate,
      endDate,
      description,
      createTerms: createTerms || false,
    });

    if (!result.success) {
      return sendBadRequest(res, result.error!);
    }

    sendSuccess(res, result.data, 201);
  } catch (error: any) {
    if (error?.code === "23505") {
      return sendBadRequest(res, "An academic session for this year already exists.");
    }
    handleRouteError(res, error, "sessions.create");
  }
}

/**
 * PUT /api/sessions/:id - Update session
 */
export async function updateSession(req: any, res: Response) {
  try {
    const validation = sessionValidator.validateSessionId(req.params.id);
    if (!validation.valid) {
      return sendBadRequest(res, validation.error!);
    }

    const { name, year, startDate, endDate, description, status } = req.body;

    // Validate year format if provided
    if (year) {
      const yearValidation = sessionValidator.validateYearFormat(year);
      if (!yearValidation.valid) {
        return sendBadRequest(res, yearValidation.error!);
      }
    }

    // Update session
    const result = await sessionService.updateSession(validation.id!, {
      name,
      year,
      startDate,
      endDate,
      description,
      status,
    });

    if (!result.success) {
      if (result.error?.includes("not found")) {
        return sendNotFound(res, result.error);
      }
      return sendBadRequest(res, result.error!);
    }

    sendSuccess(res, result.data);
  } catch (error: any) {
    if (error?.code === "23505") {
      return sendBadRequest(res, "An academic session for this year already exists.");
    }
    handleRouteError(res, error, "sessions.update");
  }
}

/**
 * DELETE /api/sessions/:id - Delete session
 */
export async function deleteSession(req: any, res: Response) {
  try {
    const validation = sessionValidator.validateSessionId(req.params.id);
    if (!validation.valid) {
      return sendBadRequest(res, validation.error!);
    }

    const result = await sessionService.deleteSession(validation.id!);

    if (!result.success) {
      if (result.error?.includes("not found")) {
        return sendNotFound(res, result.error);
      }
      return sendBadRequest(res, result.error!);
    }

    sendSuccess(res, { 
      message: "Academic session deleted successfully", 
      id: validation.id, 
      success: true 
    });
  } catch (error: any) {
    if (error?.code === "23503") {
      return sendBadRequest(res, "Cannot delete this session — it is linked to academic terms.");
    }
    handleRouteError(res, error, "sessions.delete");
  }
}

/**
 * PUT /api/sessions/:id/deactivate - Deactivate session
 */
export async function deactivateSession(req: any, res: Response) {
  try {
    const validation = sessionValidator.validateSessionId(req.params.id);
    if (!validation.valid) {
      return sendBadRequest(res, validation.error!);
    }

    const result = await sessionService.deactivateSession(validation.id!);

    if (!result.success) {
      if (result.error?.includes("not found")) {
        return sendNotFound(res, result.error);
      }
      return sendBadRequest(res, result.error!);
    }

    sendSuccess(res, result.data);
  } catch (error) {
    handleRouteError(res, error, "sessions.deactivate");
  }
}

/**
 * PUT /api/sessions/:id/mark-current - Mark session as current
 */
export async function markSessionAsCurrent(req: any, res: Response) {
  try {
    const validation = sessionValidator.validateSessionId(req.params.id);
    if (!validation.valid) {
      return sendBadRequest(res, validation.error!);
    }

    const result = await sessionService.markAsCurrent(validation.id!);

    if (!result.success) {
      if (result.error?.includes("not found")) {
        return sendNotFound(res, result.error);
      }
      return sendBadRequest(res, result.error!);
    }

    sendSuccess(res, result.data);
  } catch (error) {
    handleRouteError(res, error, "sessions.markCurrent");
  }
}
