import { Response } from "express";
import { ZodError } from "zod";

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json(data);
}

export function sendCreated<T>(res: Response, data: T): void {
  res.status(201).json(data);
}

export function sendNoContent(res: Response): void {
  res.status(204).send();
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  details?: unknown
): void {
  const response: { error: string; details?: unknown } = { error: message };
  if (details !== undefined) {
    response.details = details;
  }
  res.status(statusCode).json(response);
}

export function sendBadRequest(res: Response, message: string, details?: unknown): void {
  sendError(res, message, 400, details);
}

export function sendUnauthorized(res: Response, message = "Unauthorized"): void {
  sendError(res, message, 401);
}

export function sendForbidden(res: Response, message = "Forbidden"): void {
  sendError(res, message, 403);
}

export function sendNotFound(res: Response, message = "Resource not found"): void {
  sendError(res, message, 404);
}

export function sendConflict(res: Response, message: string): void {
  sendError(res, message, 409);
}

export function sendServerError(res: Response, message = "Internal server error"): void {
  sendError(res, message, 500);
}

export function handleRouteError(res: Response, error: unknown, context: string): void {
  console.error(`[${context}] Error:`, error);
  
  if (error instanceof ZodError) {
    sendBadRequest(res, "Validation failed", error.errors);
    return;
  }
  
  const message = error instanceof Error ? error.message : "An unexpected error occurred";
  sendServerError(res, message);
}

export function parseIntParam(value: string | undefined, defaultValue?: number): number | undefined {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export function parseBoolParam(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return value === "true" || value === "1";
}

import { Request, NextFunction } from "express";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any>;

export function asyncHandler(context: string, handler: AsyncRequestHandler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      handleRouteError(res, error, context);
    }
  };
}
