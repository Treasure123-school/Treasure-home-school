---
name: Auto-sync gap fixes
description: Three confirmed gaps in the exam-score → report-card sync pipeline, all patched.
---

## Bug 1 — PATCH /api/teacher/exam-results/:resultId never synced

**Rule:** After `storage.updateExamResult()` in the teacher PATCH handler, always fire a background `reliableSyncService.syncExamScoreToReportCardReliable()` using `syncType: 'manual_sync'`.

**Why:** The handler saved the new score to `exam_results` but never propagated it to `report_card_items.exam_score`, so report cards remained stale after a teacher edited a score.

**How to apply:** Any route that calls `storage.updateExamResult()` and involves a score change should follow with a fire-and-forget sync. Use `triggeredBy` (not `initiatedBy`) in SyncOptions.

---

## Bug 2 — mergeExamScores (essay grading) never synced

**Rule:** After all essay questions are graded and `mergeExamScores()` calls `storage.updateExamResult()` with the merged score, immediately fire a background `reliableSyncService.syncExamScoreToReportCardReliable()` using `syncType: 'exam_submit'`.

**Why:** Essay grading completion saved the merged total to `exam_results` but `report_card_items` was never updated, leaving report cards blank for essay exams.

**How to apply:** SyncOptions interface uses `triggeredBy?: string` (not `initiatedBy`). Valid SyncType values: `'exam_submit' | 'manual_sync' | 'bulk_sync' | 'retry' | 'admin_repair'`.

---

## Bug 3 — addMissingSubjectsToReportCards skipped existing NULL-score rows

**Rule:** The repair function must run in two phases:
- Phase 1 (existing): insert missing subject rows + fill scores on newly inserted rows only
- Phase 2 (new): scan ALL existing `report_card_items` rows where `exam_score IS NULL AND (is_overridden IS NULL OR is_overridden = false)`, join to matching exam results, and fill them too

**Why:** Phase 1 tracked newly inserted item IDs in `newItemMap` and only wrote scores for those. Students whose report card already had the subject row (from initial generation) but `exam_score = NULL` were never touched — repair returned `{itemsAdded: 0, examScoresSynced: 0}` and stopped.

**How to apply:** Phase 2 uses a single Drizzle JOIN query across `report_card_items → report_cards → exam_results → exams`, filtered to `inArray(report_cards.studentId, studentIds)`. Follow with `recalculateReportCard()` for every changed rcId.

---

## SyncOptions interface (server/services/reliable-sync-service.ts)

```typescript
interface SyncOptions {
  triggeredBy?: string;     // user ID who triggered (NOT initiatedBy)
  syncType: SyncType;       // 'exam_submit' | 'manual_sync' | 'bulk_sync' | 'retry' | 'admin_repair'
  skipAuditLog?: boolean;
  maxRetries?: number;
}
```
`forceOverride` is NOT a SyncOptions property — it is derived internally from `syncType` ('manual_sync' | 'bulk_sync' | 'admin_repair' all force-override).
