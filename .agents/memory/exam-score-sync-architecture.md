---
name: Exam Score → Report Card Sync Architecture
description: All sync paths, modularisation layout, and invariants for the exam→report-card pipeline
---

## Sync invariants (every code path must honour these)

1. `autoScoreExamSession` fires `reliableSyncService.syncExamScoreToReportCardReliable` after saving a result **only when `pendingManualReview === 0`** (essay-only exams skip here).
2. `mergeExamScores` fires `reliableSyncService` after the last essay is graded (triggers when `essayQuestions.length === gradedEssayAnswers.length`).
3. `POST /api/admin/resync-exam-score` uses `reliableSyncService` with `syncType: 'admin_repair'`.
4. `maintenance.routes.ts` bulk repair loop uses `reliableSyncService` with `syncType: 'admin_repair'`.
5. ReliableSyncService has a 5-second idempotency window — safe to call from multiple concurrent paths.

## Call graph

```
exam submit ──┐
timeout       ├──► autoScoreExamSession ──► reliableSyncService  (if no pending review)
late rescore ─┘

essay graded ──► mergeExamScores ──► reliableSyncService  (when all essays done)

admin resync endpoint ──► reliableSyncService (admin_repair)
maintenance bulk repair ──► reliableSyncService (admin_repair)
```

## Valid SyncTypes

`exam_submit | manual_sync | bulk_sync | retry | admin_repair`

## SyncOptions key

Use `triggeredBy` (not `initiatedBy`).

## Modularisation layout (as of Jul 2026)

| File | Contents | Lines |
|---|---|---|
| `server/helpers/exam-scoring.ts` | scoreTheoryAnswer, autoScoreExamSession, withServerTiming, autoSubmitExpiredSession, mergeExamScores, createGradingTasksForSession, generateTeacherComment, generatePrincipalComment | ~606 |
| `server/routes/attendance.routes.ts` | All /api/attendance/* routes | ~279 |
| `server/routes/grading.routes.ts` | GET /api/grading/tasks/ai-suggested, POST /api/grading/ai-suggested/:answerId/review | ~82 |
| `server/routes/maintenance.routes.ts` | Admin repair/bulk-sync tools | ~462 |
| `server/routes.ts` | Remaining legacy routes | ~15,673 |

**Why:** routes.ts was 15,959 lines; extracted 3 domains + all helper functions.

**How to apply:** When adding new exam submit/score paths, always call reliableSyncService after saving; never call `storage.syncExamScoreToReportCard` directly (legacy, no audit trail).

## resolveDesignatedPrincipal

Still defined in `server/routes.ts` (not yet extracted). Used by report card routes. Will move when report-card routes are extracted.
