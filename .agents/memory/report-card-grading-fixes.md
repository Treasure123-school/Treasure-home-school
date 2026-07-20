---
name: Report Card Grading Fixes
description: Audit findings and fixes for the report card calculation system (grade inflation, weighted scoring, bulk recalculate)
---

## Core Bug: Grade Inflation on Test-Only Subjects
`calculateWeightedScore` (shared/grading-utils.ts) was dividing `weightedScore` by
`totalWeight` (only the available component weight, e.g. 40 for test-only) instead of
the full configured weight (testWeight + examWeight, typically 100).

**Result:** A student scoring 100% on the test (worth 40%) got 100% overall instead of 40%.

**Fix:** Changed divisor from `totalWeight` to `config.testWeight + config.examWeight`.
Now test-only max = testWeight%; exam-only max = examWeight%.

## recalculateReportCard Uses item.percentage, Not obtainedMarks/totalMarks
`storage.recalculateReportCard()` was summing `obtainedMarks / totalMarks` per item.
`obtainedMarks` caps at testWeight (40) for test-only but `totalMarks` is always 100,
making the result misleadingly low (16% instead of 40%).

**Fix:** Now uses `average of item.percentage` directly (which already carries the correct
weighted value per item). Only items that have been scored (percentage > 0 OR obtainedMarks > 0)
count toward the average to avoid uncalculated zero-items dragging the result down.

## Bulk Recalculate SQL Used Raw Sum Formula (Not Weighted)
`POST /api/admin/recalculate-all-report-cards` SQL was doing:
  `obtained_marks = exam_score + test_score`
  `percentage = (exam_score + test_score) / (exam_max_score + test_max_score) * 100`

This ignores the 40/60 weight split and inflates grades when exam is absent
(test_max_score matches test_score → 100%).

**Fix:** SQL now uses proper weighted formula fetching testWeight/examWeight from system_settings.
Also added a JS post-step to update `grade` and `remarks` columns on all affected items
(previously only the header `overall_grade` was updated).

## Individual Recalculate Endpoint Enhanced
`POST /api/reports/:reportCardId/recalculate` now first calls `autoPopulateReportCardScores()`
to re-apply weighted scoring to all non-overridden items from stored raw scores, THEN
recalculates the header. Previously it only recalculated the header aggregate.

## Bulk Recalculate in Three-Dot Menu
Added `bulkRecalculateMutation` (calls `/api/admin/recalculate-all-report-cards` scoped
to selected class+term) and a `MoreVertical` DropdownMenu to the "Class Report Cards"
CardHeader — visible to admin users only.

## classHighest/classLowest Bug
Stats were computed using `|| 0` for null averagePercentage, meaning uncalculated cards
(averagePercentage=null) contributed 0 to Math.min/max, skewing stats.

**Fix:** Filter to `scoredCards` (where averagePercentage is not null) before computing
highest, lowest, and average stats.

## Grading Is NOT Hardcoded for Report Cards
Report card grading uses `getActiveGradingConfig()` (grade-scale-service.ts) which reads
the active `grading_scales` + `grading_boundaries` from the DB. The hardcoded grades in
the codebase (storage.ts L5203, L7313) are only for exam session display and analytics —
NOT for report card generation.
