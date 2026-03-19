import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Senior Secondary class detection patterns (SS1-SS3, SSS1-SSS3, SSS 1-SSS 3)
const SENIOR_SECONDARY_PATTERNS = [
  /^SS\s*1$/i,   // SS1, SS 1
  /^SS\s*2$/i,   // SS2, SS 2
  /^SS\s*3$/i,   // SS3, SS 3
  /^SSS\s*1$/i,  // SSS1, SSS 1
  /^SSS\s*2$/i,  // SSS2, SSS 2
  /^SSS\s*3$/i,  // SSS3, SSS 3
  /senior\s*secondary\s*[123]/i, // Senior Secondary 1/2/3
];

/**
 * Check if a class name is a Senior Secondary class (SS1-SS3, SSS1-SSS3)
 * This is used for department selection requirement - only SS classes need a department
 */
export function isSeniorSecondaryClass(className: string | undefined | null): boolean {
  if (!className) return false;
  return SENIOR_SECONDARY_PATTERNS.some(pattern => pattern.test(className.trim()));
}

export function getRoleName(roleId: number): string {
  // Role IDs: 1=Super Admin, 2=Admin, 3=Teacher, 4=Student, 5=Parent
  const roleNames: Record<number, string> = {
    1: 'Super Admin',
    2: 'Admin',
    3: 'Teacher',
    4: 'Student',
    5: 'Parent'
  };
  return roleNames[roleId] || 'Unknown';
}