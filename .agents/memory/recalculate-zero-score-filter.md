---
name: Report card recalculate — zero-score filter bug
description: All three recalculate paths must filter by score nullability, not score > 0
---

## The Rule
When computing `averagePercentage` for a report card header, filter items by:
```
item.testScore !== null || item.examScore !== null
```
**Never** use `percentage > 0 || obtainedMarks > 0` or `testScore > 0 || examScore > 0`.

## Why
- A student who legitimately scores 0 on a test is excluded by the `> 0` check.
- This shrinks the denominator (count), inflating the average for the rest of the class.
- Unscored placeholder rows (where both testScore and examScore are NULL) should be excluded — they are not real scores, they're just subjects not yet entered.

## Where This Applies (all three recalculate paths)
1. `server/storage.ts` → `recalculateReportCard()` — used by the individual Recalculate button
2. `server/services/reliable-sync-service.ts` → `recalculateReportCardTx()` (tx-aware) and `recalculateReportCard()` (non-tx) — used during exam sync
3. `server/routes/maintenance.routes.ts` → bulk SQL AVG in `/api/admin/recalculate-all-report-cards` — use `AVG(CASE WHEN test_score IS NOT NULL OR exam_score IS NOT NULL THEN percentage ELSE NULL END)` not plain `AVG(percentage)`

## averagePercentage formula
Average the `item.percentage` values (not `obtainedMarks / totalMarks * 100`). When `fullWeight=100` these are equivalent, but averaging percentages directly is more reliable if weights ever vary.
