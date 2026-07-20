---
name: Score sync bugs — why "Sync All" doesn't update wrong scores
description: Root causes of report card scores not matching exam_results, and all fixes applied
---

## The core problem
`syncAllMissingExamScores` only synced rows where `examScore IS NULL` or `testScore IS NULL`.
If a score already existed but was wrong/stale, the WHERE clause filtered it out — so the
sync was a permanent no-op for any student who had ever had a score written.

## All bugs fixed (this session)

### Bug 1 — syncAllMissingExamScores: null-only WHERE clause (root cause of "sync does nothing")
**storage.ts** — removed `isNull(examScore)` / `isNull(testScore)` from WHERE.
Added `isOverridden = false` guard instead so manual overrides are still respected.
Removed the redundant in-memory null-check guards in `processRecord`.

### Bug 2 — syncAllMissingExamScores: hardcoded 'standard' grading scale
**storage.ts** — replaced `recalculateReportCard(rcId, 'standard')` with
`reapplyWeightedScoresToItems(rcId)`, which reads each card's own gradingScale and
system-settings weights. Now consistent with the per-card Recalculate button.

### Bug 3 — syncExamScoreToReportCard: no system-settings weight overlay
**storage.ts** — after `getActiveGradingConfig()`, now overlays system_settings
testWeight/examWeight exactly like autoPopulateReportCardScores and reapplyWeightedScoresToItems.
This is the per-submission sync path (called when a student submits an exam).

### Bug 4 — force-resync-all-exams Step 4: raw arithmetic ignores weight system
**maintenance.routes.ts** — Steps 4 and 5 used raw `exam_score + test_score / max` arithmetic,
ignoring testWeight/examWeight, and never updated grade/remarks/testWeightedScore/examWeightedScore
on report_card_items. Replaced with a SELECT of affected report card IDs followed by
batch calls to `storage.reapplyWeightedScoresToItems()` (CONCURRENCY=5).

## Key architectural rule
Every path that writes a score to report_card_items MUST end with either:
- `reapplyWeightedScoresToItems(rcId)` — recalculates weights + grades from stored raw scores
- `recalculateReportCard(rcId, gradingScale)` — recalculates header totals only

**Why:** The raw scores (testScore, examScore) and the weighted/grade columns are separate.
Writing raw scores without re-running the weight formula leaves grade/remarks/weighted cols stale.

## schema.ts warning
Added a prominent banner comment at the top of `shared/schema.ts` explaining it is a
SQLite stub, NOT the production schema. The real schema is `shared/schema.pg.ts`.
Cannot delete schema.ts yet — still imported by routes.ts (Zod validation schemas),
seed files (table objects), csv-import-service. Any agent asked to audit tables/columns
must read schema.pg.ts, not schema.ts.
