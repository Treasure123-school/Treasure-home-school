---
name: Recalculate stale-cache root causes
description: Why recalculate wrote old scores back after retake — all five confirmed bugs and their fixes.
---

## Bug 1 — allowExamRetake never clears report_card_items cache (ROOT CAUSE)
**Rule:** After deleting exam_results, also null out testScore/examScore/testWeightedScore/examWeightedScore/testExamId/examExamId on the matching report_card_items row. Recompute obtainedMarks/percentage/grade/remarks from whatever component still remains.
**Why:** reapplyWeightedScoresToItems reads the cached score columns, not exam_results. If the cache isn't cleared after a retake, "Recalculate" reads the stale cache and writes the old score back forever.
**How to apply:** server/storage.ts allowExamRetake() — cache-clear block runs after the main transaction, wrapped in try/catch (non-fatal). Respects isOverridden flag.

## Bug 2 — reapplyWeightedScoresToItems hardcoded gradingScale 'standard'
**Rule:** Fetch the report card's own gradingScale before calling recalculateReportCard; pass it instead of 'standard'.
**Why:** Non-standard grading-scale cards always recalculated with the wrong scale.
**How to apply:** server/storage.ts reapplyWeightedScoresToItems() — rcRows query added at top.

## Bug 3 — reliableSyncService.performSyncWithTransaction skipped system-settings weight overlay
**Rule:** After getActiveGradingConfig(), query systemSettings for testWeight/examWeight and spread-override onto config (same as autoPopulateReportCardScores pattern).
**Why:** Exam submissions computed grades with different weights than Recalculate, causing visible grade drift when teacher ran Recalculate.
**How to apply:** server/services/reliable-sync-service.ts performSyncWithTransaction() — uses tx (inside transaction).

## Bug 4 — overrideReportCardItemScore skipped system-settings weight overlay
**Rule:** Same system-settings overlay as Bug 3.
**Why:** Admin-overridden scores used the wrong weight split, inconsistent with all other paths.
**How to apply:** server/storage.ts overrideReportCardItemScore().

## Bug 5 — Bulk recalculate response hardcoded succeeded/failed counts
**Rule:** Use the actual succeeded/failed counters from the batch loop in the JSON response.
**Why:** Response always said "0 failed" even when errors occurred, hiding failures from admins.
**How to apply:** server/routes/maintenance.routes.ts.

## Non-bug clarification
The original audit claimed examSubmissionsArchive used wrong column names (oldScore vs score).
That was based on reading shared/schema.ts (the SQLite stub, not used in production).
The real schema is shared/schema.pg.ts, which correctly declares score/maxScore/grade/remarks/answersSnapshot — matching the code exactly.
