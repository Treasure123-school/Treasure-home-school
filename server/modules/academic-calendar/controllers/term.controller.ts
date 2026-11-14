/**
 * Academic Term Controller
 * 
 * Handles HTTP requests/responses for term operations
 */

import { Request, Response } from "express";
import { sendSuccess, sendBadRequest, sendNotFound, handleRouteError } from "../../../utils/response-helpers";
import * as termService from "../services/term.service";
import * as termValidator from "../validators/term.validator";

/**
 * GET /api/terms - List all academic terms
 */
export async function listTerms(req: Request, res: Response) {
  try {
    const terms = await termService.getAllTerms();
    sendSuccess(res, terms);
  } catch (error) {
    handleRouteError(res, error, "terms.list");
  }
}

/**
 * GET /api/terms/active - Get currently active term
 */
export async function getActiveTerm(req: Request, res: Response) {
  try {
    const term = await termService.getActiveTerm();
    sendSuccess(res, term ?? null);
  } catch (error) {
    handleRouteError(res, error, "terms.active");
  }
}

/**
 * GET /api/terms/:id - Get single term by ID
 */
export async function getTermById(req: Request, res: Response) {
  try {
    const validation = termValidator.validateTermId(req.params.id);
    if (!validation.valid) {
      return sendBadRequest(res, validation.error!);
    }

    const term = await termService.getTermById(validation.id!);
    if (!term) {
      return sendNotFound(res, "Academic term not found");
    }

    sendSuccess(res, term);
  } catch (error) {
    handleRouteError(res, error, "terms.get");
  }
}

/**
 * POST /api/terms - Create new term
 */
export async function createTerm(req: any, res: Response) {
  try {
    const { name, year, startDate, endDate, sessionId, description } = req.body;

    // Validate required fields
    const fieldsValidation = termValidator.validateTermCreateFields(req.body);
    if (!fieldsValidation.valid) {
      return sendBadRequest(res, fieldsValidation.error!);
    }

    // Validate date range
    const dateValidation = termValidator.validateDateRange(startDate, endDate);
    if (!dateValidation.valid) {
      return sendBadRequest(res, dateValidation.error!);
    }

    // Create term
    const result = await termService.createTerm({
      name,
      year,
      startDate,
      endDate,
      sessionId,
      description,
    });

    if (!result.success) {
      return sendBadRequest(res, result.error!);
    }

    sendSuccess(res, result.data, 201);
  } catch (error: any) {
    if (error?.code === "23505") {
      return sendBadRequest(res, "An academic term for this period already exists.");
    }
    handleRouteError(res, error, "terms.create");
  }
}

/**
 * PUT /api/terms/:id - Update term
 */
export async function updateTerm(req: any, res: Response) {
  try {
    const validation = termValidator.validateTermId(req.params.id);
    if (!validation.valid) {
      return sendBadRequest(res, validation.error!);
    }

    const { name, year, startDate, endDate, sessionId, description, status } = req.body;

    // Update term
    const result = await termService.updateTerm(validation.id!, {
      name,
      year,
      startDate,
      endDate,
      sessionId,
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
      return sendBadRequest(res, "An academic term for this period already exists.");
    }
    handleRouteError(res, error, "terms.update");
  }
}

/**
 * PUT /api/terms/:id/status - Update term status
 */
export async function updateTermStatus(req: any, res: Response) {
  try {
    const validation = termValidator.validateTermId(req.params.id);
    if (!validation.valid) {
      return sendBadRequest(res, validation.error!);
    }

    const { status } = req.body;
    if (!status) {
      return sendBadRequest(res, "Status is required");
    }

    // Validate status
    const statusValidation = termValidator.validateTermStatus(status);
    if (!statusValidation.valid) {
      return sendBadRequest(res, statusValidation.error!);
    }

    // Update status
    const result = await termService.updateTermStatus(validation.id!, status);

    if (!result.success) {
      if (result.error?.includes("not found")) {
        return sendNotFound(res, result.error);
      }
      return sendBadRequest(res, result.error!);
    }

    sendSuccess(res, result.data);
  } catch (error) {
    handleRouteError(res, error, "terms.updateStatus");
  }
}

/**
 * DELETE /api/terms/:id - Delete term
 */
export async function deleteTerm(req: any, res: Response) {
  try {
    const validation = termValidator.validateTermId(req.params.id);
    if (!validation.valid) {
      return sendBadRequest(res, validation.error!);
    }

    const result = await termService.deleteTerm(validation.id!);

    if (!result.success) {
      if (result.error?.includes("not found")) {
        return sendNotFound(res, result.error);
      }
      return sendBadRequest(res, result.error!);
    }

    sendSuccess(res, { 
      message: "Academic term deleted successfully", 
      id: validation.id, 
      success: true 
    });
  } catch (error: any) {
    if (error?.code === "23503") {
      return sendBadRequest(res, "Cannot delete this term — it is linked to other records.");
    }
    handleRouteError(res, error, "terms.delete");
  }
}

/**
 * PUT /api/terms/:id/deactivate - Deactivate term
 */
export async function deactivateTerm(req: any, res: Response) {
  try {
    const validation = termValidator.validateTermId(req.params.id);
    if (!validation.valid) {
      return sendBadRequest(res, validation.error!);
    }

    const result = await termService.deactivateTerm(validation.id!);

    if (!result.success) {
      if (result.error?.includes("not found")) {
        return sendNotFound(res, result.error);
      }
      return sendBadRequest(res, result.error!);
    }

    sendSuccess(res, result.data);
  } catch (error) {
    handleRouteError(res, error, "terms.deactivate");
  }
}

/**
 * PUT /api/terms/:id/mark-current - Mark term as current
 */
export async function markTermAsCurrent(req: any, res: Response) {
  try {
    const validation = termValidator.validateTermId(req.params.id);
    if (!validation.valid) {
      return sendBadRequest(res, validation.error!);
    }

    const result = await termService.markAsCurrent(validation.id!);

    if (!result.success) {
      if (result.error?.includes("not found")) {
        return sendNotFound(res, result.error);
      }
      return sendBadRequest(res, result.error!);
    }

    sendSuccess(res, result.data);
  } catch (error) {
    handleRouteError(res, error, "terms.markCurrent");
  }
}
