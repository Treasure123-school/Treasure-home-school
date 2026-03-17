/**
 * Optimized Student Exam Visibility Module
 * 
 * Performance optimizations:
 * - Session-based caching for student exam visibility (5-minute TTL)
 * - Pre-computed visibility context caching
 * - Parallel data fetching with request coalescing
 * - Efficient filtering algorithms
 * 
 * Target: <100ms response time for student exam access
 */

import { storage } from './storage';
import { enhancedCache, EnhancedCache } from './enhanced-cache';

interface StudentExamVisibilityContext {
  studentId: string;
  classId: number;
  classLevel: string;
  department?: string;
}

interface SubjectInfo {
  id: number;
  category: string;
}

// Cache TTLs (in milliseconds)
const VISIBILITY_CACHE_TTL = 5 * 60 * 1000;  // 5 minutes for exam visibility
const CONTEXT_CACHE_TTL = 10 * 60 * 1000;    // 10 minutes for student context
const SUBJECTS_CACHE_TTL = 30 * 60 * 1000;   // 30 minutes for subjects (rarely change)

/**
 * Check if class level is Senior Secondary (SS1, SS2, SS3)
 * Optimized with early returns
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
 * Normalize subject category for comparison
 */
function normalizeCategory(category: string | null | undefined): string {
  return (category || 'general').trim().toLowerCase();
}

/**
 * Normalize department for comparison
 */
function normalizeDepartment(department: string | null | undefined): string | undefined {
  const normalized = (department || '').trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

/**
 * Get student's exam visibility context with caching
 * Caches student class information to reduce database queries
 */
export async function getStudentExamVisibilityContext(studentId: string): Promise<StudentExamVisibilityContext | null> {
  const cacheKey = `visibility:context:${studentId}`;
  
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
    CONTEXT_CACHE_TTL,
    'L2'
  );
}

/**
 * Get cached subjects with category information
 */
async function getCachedSubjects(): Promise<SubjectInfo[]> {
  return enhancedCache.getOrSet(
    'visibility:subjects',
    async () => {
      const subjects = await storage.getSubjects();
      return subjects.map((s: any) => ({
        id: s.id,
        category: normalizeCategory(s.category)
      }));
    },
    SUBJECTS_CACHE_TTL,
    'L1'  // Hot data - promoted to L1
  );
}

/**
 * Get class-subject mappings for a class (cached)
 * Uses class_subject_mappings as the centralized source of truth
 */
async function getCachedClassSubjectMappings(classId: number): Promise<number[]> {
  const cacheKey = `visibility:class_subject_mappings:${classId}`;
  
  return enhancedCache.getOrSet(
    cacheKey,
    async () => {
      const mappings = await storage.getClassSubjectMappings(classId);
      return mappings.map((m: any) => m.subjectId);
    },
    VISIBILITY_CACHE_TTL,
    'L2'
  );
}

/**
 * Get class-subject mappings for a class and department (cached)
 * Used for SS classes with department-specific subjects
 */
async function getCachedClassSubjectMappingsWithDept(classId: number, department?: string): Promise<number[]> {
  const cacheKey = `visibility:class_subject_mappings:${classId}:${department || 'all'}`;
  
  return enhancedCache.getOrSet(
    cacheKey,
    async () => {
      const mappings = await storage.getClassSubjectMappings(classId, department);
      return mappings.map((m: any) => m.subjectId);
    },
    VISIBILITY_CACHE_TTL,
    'L2'
  );
}

/**
 * Get all published exams (cached)
 */
async function getCachedPublishedExams(): Promise<any[]> {
  return enhancedCache.getOrSet(
    'visibility:published_exams',
    async () => {
      const allExams = await storage.getAllExams();
      return allExams.filter((exam: any) => exam.isPublished);
    },
    EnhancedCache.TTL.SHORT,  // 30 seconds - exams can change frequently
    'L2'
  );
}

/**
 * Optimized exam filtering for student context
 * Uses class_subject_mappings as the SINGLE SOURCE OF TRUTH
 * No fallback to category-based filtering - admin must configure subject assignments
 */
export function filterExamsForStudentContext(
  exams: any[],
  context: StudentExamVisibilityContext,
  subjects: SubjectInfo[],
  mappedSubjectIds?: number[]
): any[] {
  // Early return for empty inputs
  if (!exams.length) return [];
  
  // Pre-filter by class (most selective filter first)
  const classExams = exams.filter((exam: any) => 
    exam.isPublished && exam.classId === context.classId
  );
  
  if (classExams.length === 0) return [];
  
  // SINGLE SOURCE OF TRUTH: Use class_subject_mappings only
  // If no mappings exist, no exams are visible (admin must configure subjects)
  if (!mappedSubjectIds || mappedSubjectIds.length === 0) {
    console.log(`[EXAM-VISIBILITY] No class_subject_mappings for class ${context.classId}, dept: ${context.department || 'none'}. Student cannot see any exams.`);
    return [];
  }
  
  const validSubjectIds = new Set(mappedSubjectIds);
  return classExams.filter((exam: any) => validSubjectIds.has(exam.subjectId));
}

/**
 * Get visible exams for a student with optimized caching
 * 
 * Performance: Target <100ms with caching
 * - Uses multi-tier cache (L1/L2)
 * - Request coalescing prevents thundering herd
 * - Parallel data fetching
 * 
 * Security: Cache key includes 'student_exams' prefix for role isolation.
 * Parent caches use different prefix 'parent_exams' to prevent data leakage.
 * 
 * Filter Logic:
 * 1. Primary: Use class_subject_mappings if configured (centralized source of truth)
 * 2. Fallback: Category-based filtering (general + department for SS students)
 */
export async function getVisibleExamsForStudent(studentId: string): Promise<any[]> {
  // Cache key format: visibility:{role}_exams:{userId}
  // Role is embedded in prefix for security isolation
  const cacheKey = `visibility:student_exams:${studentId}`;
  
  return enhancedCache.getOrSet(
    cacheKey,
    async () => {
      const startTime = Date.now();
      
      // First fetch context to get classId
      const context = await getStudentExamVisibilityContext(studentId);
      
      if (!context) {
        console.log(`[EXAM-VISIBILITY] No student context found for studentId: ${studentId}`);
        return [];
      }
      
      // Fetch class-subject mappings, subjects, and exams in parallel
      const isSS = isSeniorSecondaryLevel(context.classLevel);
      const [mappedSubjectIds, subjects, publishedExams] = await Promise.all([
        // For SS students with department, get department-specific mappings
        isSS && context.department 
          ? getCachedClassSubjectMappingsWithDept(context.classId, context.department)
          : getCachedClassSubjectMappings(context.classId),
        getCachedSubjects(),
        getCachedPublishedExams()
      ]);
      
      const visibleExams = filterExamsForStudentContext(publishedExams, context, subjects, mappedSubjectIds);
      
      const duration = Date.now() - startTime;
      if (duration > 50) {
        console.log(`[EXAM-VISIBILITY] Student ${studentId}: ${visibleExams.length}/${publishedExams.length} exams (mappings: ${mappedSubjectIds.length}), ${duration}ms`);
      }
      
      return visibleExams;
    },
    VISIBILITY_CACHE_TTL,
    'L1'  // Hot data for frequently accessed student exams
  );
}

/**
 * Get visible exams for a parent (aggregated from all children)
 * Uses cached child contexts for efficiency
 * 
 * Security: Cache key uses 'parent_exams' prefix (different from 'student_exams')
 * to ensure role-based isolation. Parent and student caches never overlap.
 */
export async function getVisibleExamsForParent(parentId: string): Promise<any[]> {
  // Cache key format: visibility:{role}_exams:{userId}
  // Role is embedded in prefix for security isolation
  const cacheKey = `visibility:parent_exams:${parentId}`;
  
  return enhancedCache.getOrSet(
    cacheKey,
    async () => {
      const children = await storage.getStudentsByParentId(parentId);
      
      if (!children || children.length === 0) {
        return [];
      }
      
      // Fetch all child contexts in parallel
      const childContexts = await Promise.all(
        children.map((child: any) => getStudentExamVisibilityContext(child.id))
      );
      
      const validContexts = childContexts.filter((ctx): ctx is StudentExamVisibilityContext => ctx !== null);
      
      if (validContexts.length === 0) {
        return [];
      }
      
      // Fetch subjects, exams, and class-subject mappings for each child
      const [subjects, publishedExams] = await Promise.all([
        getCachedSubjects(),
        getCachedPublishedExams()
      ]);
      
      // Use Map for deduplication (more efficient than Set with objects)
      const examMap = new Map<number, any>();
      
      // Process each child with their class-subject mappings
      for (const context of validContexts) {
        const isSS = isSeniorSecondaryLevel(context.classLevel);
        const mappedSubjectIds = await (isSS && context.department 
          ? getCachedClassSubjectMappingsWithDept(context.classId, context.department)
          : getCachedClassSubjectMappings(context.classId));
        
        const childExams = filterExamsForStudentContext(publishedExams, context, subjects, mappedSubjectIds);
        for (const exam of childExams) {
          if (!examMap.has(exam.id)) {
            examMap.set(exam.id, exam);
          }
        }
      }
      
      return Array.from(examMap.values());
    },
    VISIBILITY_CACHE_TTL,
    'L2'
  );
}

/**
 * Check if a specific student can access a specific exam
 * Uses cached visibility data for fast response
 */
export async function canStudentAccessExam(studentId: string, examId: number): Promise<boolean> {
  const visibleExams = await getVisibleExamsForStudent(studentId);
  return visibleExams.some((exam: any) => exam.id === examId);
}

/**
 * Get students who should see a teacher's exam
 * Filters by department for SS classes
 */
export async function getStudentsForTeacherExam(
  teacherId: string, 
  examClassId: number, 
  examSubjectId: number
): Promise<any[]> {
  const cacheKey = `visibility:exam_students:${examClassId}:${examSubjectId}`;
  
  return enhancedCache.getOrSet(
    cacheKey,
    async () => {
      const students = await storage.getStudentsByClass(examClassId);
      
      if (!students || students.length === 0) {
        return [];
      }
      
      const subjects = await getCachedSubjects();
      const examSubject = subjects.find(s => s.id === examSubjectId);
      
      if (!examSubject) {
        return [];
      }
      
      // General subject: all students can see
      if (examSubject.category === 'general') {
        return students;
      }
      
      const studentClass = await storage.getClass(examClassId);
      
      // Non-SS classes: all students see general subjects
      if (!studentClass || !isSeniorSecondaryLevel(studentClass.level)) {
        return students;
      }
      
      // SS class with department-specific subject: filter by department
      return students.filter((student: any) => {
        const studentDept = normalizeDepartment(student.department);
        return studentDept === examSubject.category;
      });
    },
    VISIBILITY_CACHE_TTL,
    'L2'
  );
}

/**
 * Invalidate visibility caches when exams or student data changes
 * Call this when:
 * - Exam is created/updated/deleted
 * - Exam is published/unpublished
 * - Student class assignment changes
 * - Student department changes
 * - Class-subject mappings change
 */
export function invalidateVisibilityCache(options?: {
  studentId?: string;
  classId?: number;
  examId?: number;
  all?: boolean;
}): number {
  let invalidated = 0;
  
  if (options?.all) {
    invalidated += enhancedCache.invalidate(/^visibility:/);
    console.log(`[EXAM-VISIBILITY] Invalidated all visibility caches: ${invalidated} entries`);
    return invalidated;
  }
  
  if (options?.studentId) {
    invalidated += enhancedCache.invalidate(`visibility:context:${options.studentId}`);
    invalidated += enhancedCache.invalidate(`visibility:student_exams:${options.studentId}`);
  }
  
  if (options?.classId) {
    // Invalidate all student exams for this class (pattern match)
    invalidated += enhancedCache.invalidate(/^visibility:exam_students:/);
    // Invalidate class-subject mappings cache for this class
    invalidated += enhancedCache.invalidate(new RegExp(`^visibility:class_subject_mappings:${options.classId}`));
    // Also invalidate all student/parent visibility since mappings changed
    invalidated += enhancedCache.invalidate(/^visibility:student_exams:/);
    invalidated += enhancedCache.invalidate(/^visibility:parent_exams:/);
  }
  
  if (options?.examId) {
    // When exam changes, invalidate published exams cache and all student visibility
    invalidated += enhancedCache.invalidate('visibility:published_exams');
    invalidated += enhancedCache.invalidate(/^visibility:student_exams:/);
    invalidated += enhancedCache.invalidate(/^visibility:parent_exams:/);
  }
  
  if (invalidated > 0) {
    console.log(`[EXAM-VISIBILITY] Invalidated ${invalidated} cache entries`);
  }
  
  return invalidated;
}

/**
 * Pre-warm visibility caches for active students
 * Call during server startup or after cache flush
 */
export async function warmVisibilityCache(): Promise<void> {
  try {
    // Pre-cache subjects (used by all visibility checks)
    await getCachedSubjects();
    
    // Pre-cache published exams
    await getCachedPublishedExams();
    
    console.log('[EXAM-VISIBILITY] Visibility cache warmed successfully');
  } catch (error) {
    console.error('[EXAM-VISIBILITY] Cache warming failed:', error);
  }
}
