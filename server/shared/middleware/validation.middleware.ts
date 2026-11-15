/**
 * Validation middleware
 * Request validation using schemas
 */
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './error.middleware';

export type ValidationSchema = {
  body?: any;
  query?: any;
  params?: any;
};

/**
 * Generic validation middleware
 * Validates request body, query, and params against provided schemas
 */
export const validate = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors: string[] = [];

      // Validate body
      if (schema.body) {
        const result = validateObject(req.body, schema.body, 'body');
        if (result.length > 0) errors.push(...result);
      }

      // Validate query
      if (schema.query) {
        const result = validateObject(req.query, schema.query, 'query');
        if (result.length > 0) errors.push(...result);
      }

      // Validate params
      if (schema.params) {
        const result = validateObject(req.params, schema.params, 'params');
        if (result.length > 0) errors.push(...result);
      }

      if (errors.length > 0) {
        throw new ValidationError(errors.join(', '));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validate an object against a schema
 */
function validateObject(data: any, schema: any, location: string): string[] {
  const errors: string[] = [];

  for (const [key, rules] of Object.entries(schema)) {
    const value = data[key];
    const ruleSet = rules as any;

    // Required check
    if (ruleSet.required && (value === undefined || value === null || value === '')) {
      errors.push(`${location}.${key} is required`);
      continue;
    }

    // Skip further validation if value is not provided and not required
    if (value === undefined || value === null) {
      continue;
    }

    // Type check
    if (ruleSet.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== ruleSet.type) {
        errors.push(`${location}.${key} must be of type ${ruleSet.type}`);
        continue;
      }
    }

    // String validations
    if (typeof value === 'string') {
      if (ruleSet.minLength && value.length < ruleSet.minLength) {
        errors.push(`${location}.${key} must be at least ${ruleSet.minLength} characters`);
      }
      if (ruleSet.maxLength && value.length > ruleSet.maxLength) {
        errors.push(`${location}.${key} must not exceed ${ruleSet.maxLength} characters`);
      }
      if (ruleSet.pattern && !ruleSet.pattern.test(value)) {
        errors.push(`${location}.${key} format is invalid`);
      }
      if (ruleSet.email && !isValidEmail(value)) {
        errors.push(`${location}.${key} must be a valid email address`);
      }
    }

    // Number validations
    if (typeof value === 'number') {
      if (ruleSet.min !== undefined && value < ruleSet.min) {
        errors.push(`${location}.${key} must be at least ${ruleSet.min}`);
      }
      if (ruleSet.max !== undefined && value > ruleSet.max) {
        errors.push(`${location}.${key} must not exceed ${ruleSet.max}`);
      }
    }

    // Enum validation
    if (ruleSet.enum && !ruleSet.enum.includes(value)) {
      errors.push(`${location}.${key} must be one of: ${ruleSet.enum.join(', ')}`);
    }

    // Custom validation
    if (ruleSet.custom && typeof ruleSet.custom === 'function') {
      const customError = ruleSet.custom(value);
      if (customError) {
        errors.push(`${location}.${key} ${customError}`);
      }
    }
  }

  return errors;
}

/**
 * Email validation helper
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize input to prevent XSS attacks
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  next();
};

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return typeof obj === 'string' ? sanitizeString(obj) : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeObject(value);
  }
  return sanitized;
}

/**
 * Sanitize a string value
 */
function sanitizeString(str: string): string {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}
