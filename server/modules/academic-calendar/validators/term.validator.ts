/**
 * Academic Term Validators
 * 
 * Validation functions for term-related requests
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate required fields for term creation
 */
export function validateTermCreateFields(data: any): ValidationResult {
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
 * Validate term ID parameter
 */
export function validateTermId(id: string): { valid: boolean; id?: number; error?: string } {
  const numId = parseInt(id);
  if (isNaN(numId)) {
    return { valid: false, error: "Invalid term ID" };
  }
  return { valid: true, id: numId };
}

/**
 * Validate term status
 */
export function validateTermStatus(status: string): ValidationResult {
  const validStatuses = ['active', 'upcoming', 'completed', 'inactive', 'archived'];
  
  if (!validStatuses.includes(status)) {
    return { 
      valid: false, 
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
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
