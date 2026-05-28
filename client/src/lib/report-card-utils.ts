/**
 * Shared report-card utility functions.
 * Centralises grade colours, position formatting, age calculation and remarks
 * so they are not duplicated across StudentReportCard, TeacherReportCards,
 * ProfessionalReportCard and BaileysReportTemplate.
 */

/** Tailwind badge colour classes for a grade letter. */
export const getGradeColor = (grade: string): string => {
  if (!grade) return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  const g = grade.toUpperCase();
  if (g.startsWith('A')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (g.startsWith('B')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  if (g.startsWith('C')) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  if (g.startsWith('D') || g.startsWith('E')) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
};

/** Human-readable remark for a grade letter (e.g. "A" → "Excellent"). */
export const getRemarkFromGrade = (grade: string): string => {
  if (!grade) return '-';
  const g = grade.toUpperCase();
  if (g === 'A' || g === 'A+') return 'Excellent';
  if (g === 'B' || g === 'B+') return 'Very Good';
  if (g === 'C' || g === 'C+') return 'Good';
  if (g === 'D' || g === 'D+') return 'Pass';
  if (g === 'E') return 'Fair';
  return 'Weak';
};

/** Returns ordinal position string: "1st", "2nd", "3rd", "4th", etc. */
export const formatPosition = (pos: number): string => {
  if (!pos) return '-';
  if (pos >= 11 && pos <= 13) return `${pos}th`;
  switch (pos % 10) {
    case 1: return `${pos}st`;
    case 2: return `${pos}nd`;
    case 3: return `${pos}rd`;
    default: return `${pos}th`;
  }
};

/**
 * Calculates age in whole years from a date-of-birth string or Date object.
 * Returns null if the input is falsy or cannot be parsed.
 */
export const calculateAge = (dateOfBirth: string | Date | null | undefined): number | null => {
  if (!dateOfBirth) return null;
  try {
    const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age >= 0 ? age : null;
  } catch {
    return null;
  }
};
