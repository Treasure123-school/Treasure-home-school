/**
 * Classes Service
 * Business logic for class management, subject mappings, and student rankings
 */
import { storage } from '../../storage';
import { PerformanceCache, performanceCache } from '../../performance-cache';
import { invalidateSubjectMappingsAndSync } from '../../routes/upload-config';
import { InsertClass, InsertClassSubjectMapping } from '@shared/schema.pg';

export class ClassesService {
  /**
   * Get all active classes with caching
   */
  async getClasses(includeInactive = false) {
    if (includeInactive) {
      return await storage.getAllClasses(true);
    }

    // Use cache for active classes (rarely changes, high read frequency)
    return await performanceCache.getOrSet(
      PerformanceCache.keys.activeClasses(),
      () => storage.getAllClasses(true),
      PerformanceCache.TTL.MEDIUM // 5 minute cache
    );
  }

  /**
   * Get single class by ID
   */
  async getClass(classId: number) {
    const classInfo = await storage.getClass(classId);
    if (!classInfo) {
      throw { statusCode: 404, message: 'Class not found' };
    }
    return classInfo;
  }

  /**
   * Create new class
   */
  async createClass(data: {
    name: string;
    level: string;
    classTeacherId?: string | null;
    capacity?: number;
    isActive?: boolean;
  }) {
    if (!data.name || !data.level) {
      throw { statusCode: 400, message: 'Name and level are required' };
    }

    const classData: InsertClass = {
      name: data.name,
      level: data.level,
      classTeacherId: data.classTeacherId || null,
      capacity: data.capacity || 30,
      isActive: data.isActive !== false
    };

    try {
      const newClass = await storage.createClass(classData);

      // Invalidate classes cache
      performanceCache.invalidate(PerformanceCache.keys.activeClasses());
      performanceCache.invalidate(PerformanceCache.keys.classes());

      return newClass;
    } catch (error: any) {
      if (error.message?.includes('UNIQUE constraint')) {
        throw { statusCode: 409, message: 'A class with this name already exists' };
      }
      throw error;
    }
  }

  /**
   * Update existing class
   */
  async updateClass(classId: number, data: Partial<InsertClass>) {
    const existingClass = await storage.getClass(classId);
    if (!existingClass) {
      throw { statusCode: 404, message: 'Class not found' };
    }

    try {
      const updatedClass = await storage.updateClass(classId, data);

      // Invalidate classes cache
      performanceCache.invalidate(PerformanceCache.keys.activeClasses());
      performanceCache.invalidate(PerformanceCache.keys.classes());

      return updatedClass;
    } catch (error: any) {
      if (error.message?.includes('UNIQUE constraint')) {
        throw { statusCode: 409, message: 'A class with this name already exists' };
      }
      throw error;
    }
  }

  /**
   * Delete class
   */
  async deleteClass(classId: number) {
    const existingClass = await storage.getClass(classId);
    if (!existingClass) {
      throw { statusCode: 404, message: 'Class not found' };
    }

    try {
      const success = await storage.deleteClass(classId);
      if (!success) {
        throw new Error('Failed to delete class');
      }

      // Invalidate classes cache
      performanceCache.invalidate(PerformanceCache.keys.activeClasses());
      performanceCache.invalidate(PerformanceCache.keys.classes());

      return { success: true, deletedClass: existingClass };
    } catch (error: any) {
      if (error.code === '23503' || error.message?.includes('linked')) {
        throw { 
          statusCode: 400, 
          message: 'Cannot delete class because it has students or other records linked to it.' 
        };
      }
      throw error;
    }
  }

  /**
   * Get available subjects for a class based on level and department
   */
  async getAvailableSubjects(classId: number, department?: string) {
    const classInfo = await storage.getClass(classId);
    if (!classInfo) {
      throw { statusCode: 404, message: 'Class not found' };
    }

    const subjects = await storage.getSubjectsForClassLevel(
      classInfo.level,
      department
    );

    return subjects;
  }

  /**
   * Get class-subject mappings with enriched subject details
   */
  async getClassSubjectMappings(classId: number, department?: string) {
    const mappings = await storage.getClassSubjectMappings(classId, department);

    // Enrich with subject details
    const enrichedMappings = await Promise.all(mappings.map(async (mapping) => {
      const subject = await storage.getSubject(mapping.subjectId);
      return {
        ...mapping,
        subjectName: subject?.name,
        subjectCode: subject?.code,
        category: subject?.category
      };
    }));

    return enrichedMappings;
  }

  /**
   * Create class-subject mapping
   * Includes cache invalidation and report card sync
   */
  async createClassSubjectMapping(data: {
    classId: number;
    subjectId: number;
    department?: string | null;
    isCompulsory?: boolean;
  }) {
    if (!data.classId || !data.subjectId) {
      throw { statusCode: 400, message: 'classId and subjectId are required' };
    }

    const mappingData: InsertClassSubjectMapping = {
      classId: data.classId,
      subjectId: data.subjectId,
      department: data.department || null,
      isCompulsory: data.isCompulsory || false
    };

    const mapping = await storage.createClassSubjectMapping(mappingData);

    // CRITICAL: Use shared helper for comprehensive cache invalidation and sync
    // FIX: Explicitly set addMissingSubjects: true to ensure new mappings are added to existing report cards
    const syncResult = await invalidateSubjectMappingsAndSync(
      [data.classId], 
      { cleanupReportCards: false, addMissingSubjects: true }
    );

    console.log(`[CLASS-SUBJECT-MAPPING] Created mapping for class ${data.classId}`);

    return { mapping, syncResult };
  }

  /**
   * Delete class-subject mapping
   * Includes cache invalidation, sync, and cleanup
   */
  async deleteClassSubjectMapping(mappingId: number) {
    // Get the mapping first to know the classId for cache invalidation
    const mappingToDelete = await storage.getClassSubjectMappingById(mappingId);

    if (!mappingToDelete) {
      throw { statusCode: 404, message: 'Mapping not found' };
    }

    const classId = mappingToDelete.classId;
    const success = await storage.deleteClassSubjectMapping(mappingId);

    if (!success) {
      throw new Error('Failed to delete mapping');
    }

    // CRITICAL: Use shared helper for comprehensive cache invalidation, sync, and cleanup
    const syncResult = await invalidateSubjectMappingsAndSync(
      [classId], 
      { cleanupReportCards: true }
    );

    console.log(`[CLASS-SUBJECT-MAPPING] Deleted mapping for class ${classId}`);

    return { success: true, classId, syncResult };
  }

  /**
   * Calculate student's rank within their class
   * Based on average exam scores
   */
  async getStudentClassRank(studentId: string) {
    const student = await storage.getStudentByUserId(studentId);
    
    if (!student || !student.classId) {
      return { rank: null, total: null, percentage: null };
    }

    const classStudents = await storage.getStudentsByClass(student.classId);
    if (classStudents.length === 0) {
      return { rank: null, total: 0, percentage: null };
    }

    // Calculate average scores for all students in the class
    const { db } = await import('../../storage');
    const schema = await import('@shared/schema.pg');
    const { eq } = await import('drizzle-orm');

    const studentScores = await Promise.all(
      classStudents.map(async (s) => {
        const results = await db
          .select({ 
            score: schema.examResults.score, 
            marksObtained: schema.examResults.marksObtained, 
            maxScore: schema.examResults.maxScore 
          })
          .from(schema.examResults)
          .where(eq(schema.examResults.studentId, s.id));

        const valid = results.filter((r: { score: number | null; marksObtained: number | null }) => r.score != null || r.marksObtained != null);
        const avg = valid.length > 0
          ? valid.reduce((sum: number, r: { score: number | null; marksObtained: number | null }) => sum + (r.score ?? r.marksObtained ?? 0), 0) / valid.length
          : 0;

        return { studentId: s.id, avg };
      })
    );

    // Sort by average score descending
    studentScores.sort((a, b) => b.avg - a.avg);

    const rankIndex = studentScores.findIndex((s) => s.studentId === studentId);
    const rank = rankIndex >= 0 ? rankIndex + 1 : null;
    const total = classStudents.length;
    const percentage = rank !== null ? Math.round((rank / total) * 100) : null;

    return { rank, total, percentage };
  }
}
