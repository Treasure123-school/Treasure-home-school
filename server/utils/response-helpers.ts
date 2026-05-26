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
  const response: { message: string; details?: unknown } = { message };
  if (details !== undefined) {
    response.details = details;
  }
  res.status(statusCode).json(response);
}

export function sendBadRequest(res: Response, message: string, details?: unknown): void {
  sendError(res, message, 400, details);
}

export function sendUnauthorized(res: Response, message = "Authentication required. Please log in."): void {
  sendError(res, message, 401);
}

export function sendForbidden(res: Response, message = "You don't have permission to perform this action."): void {
  sendError(res, message, 403);
}

export function sendNotFound(res: Response, message = "The requested resource was not found."): void {
  sendError(res, message, 404);
}

export function sendConflict(res: Response, message: string): void {
  sendError(res, message, 409);
}

export function sendServerError(res: Response, message = "A server error occurred. Please try again later."): void {
  sendError(res, message, 500);
}

export function handleRouteError(res: Response, error: unknown, context: string): void {
  console.error(`[${context}] Error:`, error);

  if (error instanceof ZodError) {
    sendBadRequest(res, "Validation failed. Please check your inputs.", error.errors);
    return;
  }

  if (error instanceof Error) {
    // Unique constraint violations
    if ((error as any).code === '23505' || error.message.includes('unique constraint')) {
      sendConflict(res, "A record with this information already exists.");
      return;
    }
    // Foreign key violations
    if ((error as any).code === '23503') {
      sendBadRequest(res, "The referenced item no longer exists.");
      return;
    }
    // Connection/timeout issues
    if (error.message.includes('connect') || error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
      sendServerError(res, "Unable to connect to the database. Please try again later.");
      return;
    }
  }

  // Never expose raw internal error details in production
  const isDev = process.env.NODE_ENV === 'development';
  const message = isDev && error instanceof Error
    ? error.message
    : "A server error occurred. Please try again later.";

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
