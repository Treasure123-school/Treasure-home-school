import { type Request, Response, NextFunction } from "express";
import { performanceMonitor } from "./performance-monitor";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const path = req.path;
  const isProduction = process.env.NODE_ENV === 'production';
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  if (req.method === 'GET' && path.startsWith('/api/')) {
    if (path.includes('/homepage-content') || path.includes('/announcements')) {
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120');
    } else if (!path.includes('/auth')) {
      res.setHeader('Cache-Control', 'private, max-age=30');
    }
  }

  if (!isProduction) {
    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      performanceMonitor.recordRequest(req.method, req.route?.path || path, duration, res.statusCode);
    }
    if (res.statusCode >= 400 && res.statusCode < 500) {
      console.log(`❌ 4xx ERROR: ${req.method} ${req.originalUrl || path} - Status ${res.statusCode}`);
    }
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (!isProduction && capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(sanitizeLogData(capturedJsonResponse))}`;
      }
      console.log(logLine.length > 80 ? logLine.slice(0, 79) + "…" : logLine);
    }
  });
  next();
}

function sanitizeLogData(data: any): any {
  if (Array.isArray(data)) return data.map(item => sanitizeLogData(item));
  if (data && typeof data === 'object') {
    const sanitized = { ...data };
    const sensitiveFields = ['password', 'token', 'jwt', 'secret', 'key', 'auth', 'session'];
    for (const field of sensitiveFields) {
      if (field in sanitized) sanitized[field] = '[REDACTED]';
    }
    for (const key in sanitized) {
      if (sanitized[key] && typeof sanitized[key] === 'object') {
        sanitized[key] = sanitizeLogData(sanitized[key]);
      }
    }
    return sanitized;
  }
  return data;
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.log(`ERROR: ${req.method} ${req.path} - ${err.message}`);
  if (!res.headersSent) {
    res.status(status).json({ message });
  }
}
