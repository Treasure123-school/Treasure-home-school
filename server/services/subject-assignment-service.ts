/**
 * Subject Assignment Service
 * 
 * Centralized service for determining which subjects a student can access.
 * This is the single source of truth for:
 * - Exam visibility (which exams a student can take)
 * - Report card subjects (which subjects appear on report cards)
 * - Subject selection in various UIs
 * 
 * Uses class_subject_mappings table as the authoritative source.
 * For JSS classes: uses mappings without department filter
 * For SSS classes: uses mappings with department filter (science, art, commercial)
 */

import { storage } from '../storage';
import { enhancedCache } from '../enhanced-cache';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface StudentContext {
  studentId: string;
  classId: number;
  classLevel: string;
  department?: string;
}

interface AllowedSubject {
  id: number;
  name: string;
  code: string;
  category: string;
  isCompulsory: boolean;
}

/**
 * Check if class level is Senior Secondary (SS1, SS2, SS3, SSS1, SSS2, SSS3)
 */
function isSeniorSecondaryLevel(level: string): boolean {
  if (!level) return false;
  const normalizedLevel = level.trim().toLowerCase();
  return (
    normalizedLevel.includes('senior secondary') ||
    normalizedLevel.includes('senior_secondary') ||
    /^ss\s*[123]$/i.test(normalizedLevel) ||
    /^sss\s*[123]$/i.test(normalizedLevel)
  );
}

/**
 * Normalize department string for comparison
 */
function normalizeDepartment(department: string | null | undefined): string | undefined {
  const normalized = (department || '').trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Get student context (class, level, department)
 */
export async function getStudentContext(studentId: string): Promise<StudentContext | null> {
  const cacheKey = `subject-assignment:context:${studentId}`;
  
  return enhancedCache.getOrSet(
    cacheKey,
    async () => {
      const student = await storage.getStudent(studentId);
      
      if (!student || !student.classId) {
        return null;
      }
      
      const studentClass = await storage.getClass(student.classId);
      if (!studentClass) {
        return null;
      }
      
      return {
        studentId,
        classId: student.classId,
        classLevel: studentClass.level || '',
        department: normalizeDepartment(student.department)
      };
    },
    CACHE_TTL,
    'L2'
  );
}

/**
 * Get allowed subject IDs for a student based on class and department
 * Returns only the subject IDs (useful for filtering)
 */
export async function getAllowedSubjectIdsForStudent(studentId: string): Promise<number[]> {
  const cacheKey = `subject-assignment:allowed-ids:${studentId}`;
  
  return enhancedCache.getOrSet(
    cacheKey,
    async () => {
      const context = await getStudentContext(studentId);
      
      if (!context) {
        console.log(`[SUBJECT-ASSIGNMENT] No context found for student ${studentId}`);
        return [];
      }
      
      return getAllowedSubjectIdsForClass(context.classId, context.classLevel, context.department);
    },
    CACHE_TTL,
    'L2'
  );
}

/**
 * Get allowed subject IDs for a class and optional department
 * This is the core method that determines subject visibility
 */
export async function getAllowedSubjectIdsForClass(
  classId: number, 
  classLevel: string,
  department?: string
): Promise<number[]> {
  const isSS = isSeniorSecondaryLevel(classLevel);
  const deptKey = isSS && department ? department : 'none';
  const cacheKey = `subject-assignment:class-subjects:${classId}:${deptKey}`;
  
  return enhancedCache.getOrSet(
    cacheKey,
    async () => {
      // For SS students with department, get department-specific mappings
      if (isSS && department) {
        const mappings = await storage.getClassSubjectMappings(classId, department);
        return mappings.map((m: any) => m.subjectId);
      }
      
      // For non-SS students or SS without department, get all class mappings
      const mappings = await storage.getClassSubjectMappings(classId);
      return mappings.map((m: any) => m.subjectId);
    },
    CACHE_TTL,
    'L2'
  );
}

/**
 * Get full subject details for allowed subjects
 */
export async function getAllowedSubjectsForStudent(studentId: string): Promise<AllowedSubject[]> {
  const cacheKey = `subject-assignment:allowed-full:${studentId}`;
  
  return enhancedCache.getOrSet(
    cacheKey,
    async () => {
      const context = await getStudentContext(studentId);
      
      if (!context) {
        return [];
      }
      
      const isSS = isSeniorSecondaryLevel(context.classLevel);
      
      // Get mappings with full subject details
      const mappings = await storage.getClassSubjectMappings(
        context.classId, 
        isSS ? context.department : undefined
      );
      
      if (mappings.length === 0) {
        return [];
      }
      
      // Get all subjects
      const subjects = await storage.getSubjects();
      const subjectMap = new Map(subjects.map(s => [s.id, s]));
      
      // Build allowed subjects list
      return mappings
        .map((m: any) => {
          const subject = subjectMap.get(m.subjectId);
          if (!subject || !subject.isActive) return null;
          
          return {
            id: subject.id,
            name: subject.name,
            code: subject.code,
            category: subject.category || 'general',
            isCompulsory: m.isCompulsory || false
          };
        })
        .filter((s): s is AllowedSubject => s !== null);
    },
    CACHE_TTL,
    'L2'
  );
}

/**
 * Check if a student can access a specific subject
 */
export async function canStudentAccessSubject(studentId: string, subjectId: number): Promise<boolean> {
  const allowedIds = await getAllowedSubjectIdsForStudent(studentId);
  return allowedIds.includes(subjectId);
}

/**
 * Invalidate all subject assignment caches for a student
 */
export function invalidateStudentCache(studentId: string): number {
  let invalidated = 0;
  invalidated += enhancedCache.invalidate(`subject-assignment:context:${studentId}`);
  invalidated += enhancedCache.invalidate(`subject-assignment:allowed-ids:${studentId}`);
  invalidated += enhancedCache.invalidate(`subject-assignment:allowed-full:${studentId}`);
  return invalidated;
}

/**
 * Invalidate all subject assignment caches for a class
 * This should be called when class-subject mappings are updated
 */
export function invalidateClassCache(classId: number): number {
  let invalidated = 0;
  invalidated += enhancedCache.invalidate(new RegExp(`^subject-assignment:class-subjects:${classId}:`));
  // Also invalidate all student caches since class mappings affect students
  invalidated += enhancedCache.invalidate(/^subject-assignment:allowed-ids:/);
  invalidated += enhancedCache.invalidate(/^subject-assignment:allowed-full:/);
  invalidated += enhancedCache.invalidate(/^subject-assignment:context:/);
  return invalidated;
}

/**
 * Invalidate all subject assignment caches
 */
export function invalidateAllCaches(): number {
  return enhancedCache.invalidate(/^subject-assignment:/);
}

/**
 * Get students affected by a class subject mapping change
 * Used to identify which students need cache invalidation
 */
export async function getAffectedStudentIds(classId: number, department?: string): Promise<string[]> {
  const students = await storage.getStudentsByClass(classId);
  
  if (!department) {
    return students.map((s: any) => s.id);
  }
  
  // Filter by department for SS classes
  return students
    .filter((s: any) => normalizeDepartment(s.department) === normalizeDepartment(department))
    .map((s: any) => s.id);
}

export const SubjectAssignmentService = {
  getStudentContext,
  getAllowedSubjectIdsForStudent,
  getAllowedSubjectIdsForClass,
  getAllowedSubjectsForStudent,
  canStudentAccessSubject,
  invalidateStudentCache,
  invalidateClassCache,
  invalidateAllCaches,
  getAffectedStudentIds,
  isSeniorSecondaryLevel,
  normalizeDepartment
};
