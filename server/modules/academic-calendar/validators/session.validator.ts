/**
 * Academic Session Validators
 * 
 * Validation functions for session-related requests
 */

const YEAR_PATTERN = /^\d{4}\/\d{4}$/;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate academic year format (YYYY/YYYY)
 */
export function validateYearFormat(year: string): ValidationResult {
  if (!YEAR_PATTERN.test(year)) {
    return { 
      valid: false, 
      error: "Academic year must be in YYYY/YYYY format (e.g., 2024/2025)" 
    };
  }
  
  const [startYear, endYear] = year.split("/").map(Number);
  if (endYear !== startYear + 1) {
    return { 
      valid: false, 
      error: "Academic year must span consecutive years (e.g., 2024/2025)" 
    };
  }
  
  return { valid: true };
}

/**
 * Validate date range (start must be before end)
 */
export function validateDateRange(startDate: string, endDate: string): ValidationResult {
  if (startDate >= endDate) {
    return { 
      valid: false, 
      error: "startDate must be before endDate" 
    };
  }
  return { valid: true };
}

/**
 * Validate required fields for session creation
 */
export function validateSessionCreateFields(data: any): ValidationResult {
  const { name, year, startDate, endDate } = data;
  
  if (!name || !year || !startDate || !endDate) {
    return { 
      valid: false, 
      error: "Missing required fields: name, year, startDate, endDate" 
    };
  }
  
  return { valid: true };
}

/**
 * Validate session ID parameter
 */
export function validateSessionId(id: string): { valid: boolean; id?: number; error?: string } {
  const numId = parseInt(id);
  if (isNaN(numId)) {
    return { valid: false, error: "Invalid session ID" };
  }
  return { valid: true, id: numId };
}
