/**
 * Cache Invalidation Helpers
 * 
 * Centralized cache invalidation functions to avoid duplicate patterns.
 */

import { enhancedCache } from "../enhanced-cache";
import { invalidateVisibilityCache } from "../exam-visibility";
import { SubjectAssignmentService } from "../services/subject-assignment-service";
import { storage } from "../storage";

export interface SubjectMappingSyncResult {
  studentsSynced: number;
  reportCardItemsRemoved: number;
  reportCardItemsAdded: number;
  examScoresSynced: number;
  cacheKeysInvalidated: number;
  syncErrors: string[];
}

/**
 * Invalidates all report card related caches
 */
export function invalidateReportCardCaches(): number {
  let count = 0;
  count += enhancedCache.invalidate(/^reportcard:/);
  count += enhancedCache.invalidate(/^reportcards:/);
  count += enhancedCache.invalidate(/^report-card/);
  count += enhancedCache.invalidate(/^student-report/);
  return count;
}

/**
 * Comprehensive cache invalidation and student sync when class-subject mappings are modified.
 * Ensures admin changes propagate instantly to exams, report cards, and student visibility.
 */
export async function invalidateSubjectMappingsAndSync(
  affectedClassIds: number[],
  options: { cleanupReportCards?: boolean; addMissingSubjects?: boolean } = {}
): Promise<SubjectMappingSyncResult> {
  let cacheKeysInvalidated = 0;
  let totalSynced = 0;
  let reportCardItemsRemoved = 0;
  let reportCardItemsAdded = 0;
  let examScoresSynced = 0;
  const syncErrors: string[] = [];

  // 1. Invalidate visibility caches (affects exam visibility)
  for (const classId of affectedClassIds) {
    cacheKeysInvalidated += invalidateVisibilityCache({ classId });
  }

  // 2. Invalidate subject assignment caches
  for (const classId of affectedClassIds) {
    cacheKeysInvalidated += SubjectAssignmentService.invalidateClassCache(classId);
  }

  // 3. Invalidate all report card related caches
  cacheKeysInvalidated += invalidateReportCardCaches();

  // 4. Sync students with new mappings
  for (const classId of affectedClassIds) {
    const syncResult = await storage.syncStudentsWithClassMappings(classId);
    totalSynced += syncResult.synced;
    if (syncResult.errors && syncResult.errors.length > 0) {
      syncErrors.push(...syncResult.errors);
    }
  }

  // 5. Cleanup report cards for affected classes
  if (options.cleanupReportCards && affectedClassIds.length > 0) {
    const cleanupResult = await storage.cleanupReportCardsForClasses(affectedClassIds);
    reportCardItemsRemoved = cleanupResult.itemsRemoved;
  }

  // 6. Add missing subjects to existing report cards
  if (options.addMissingSubjects !== false && affectedClassIds.length > 0) {
    try {
      const addResult = await storage.addMissingSubjectsToReportCards(affectedClassIds);
      reportCardItemsAdded = addResult.itemsAdded;
      examScoresSynced = addResult.examScoresSynced;
      if (addResult.errors && addResult.errors.length > 0) {
        syncErrors.push(...addResult.errors);
      }
    } catch (error: any) {
      console.error('[SUBJECT-MAPPING-SYNC] Error adding missing subjects:', error);
      syncErrors.push(`Failed to add missing subjects: ${error.message}`);
    }
  }

  console.log(`[SUBJECT-MAPPING-SYNC] Classes: ${affectedClassIds.length}, Students: ${totalSynced}, Cache: ${cacheKeysInvalidated}, Removed: ${reportCardItemsRemoved}, Added: ${reportCardItemsAdded}`);
  
  return { studentsSynced: totalSynced, reportCardItemsRemoved, reportCardItemsAdded, examScoresSynced, cacheKeysInvalidated, syncErrors };
}
