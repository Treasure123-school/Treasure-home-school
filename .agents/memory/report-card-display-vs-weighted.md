---
name: Report card display — weighted vs raw scores
description: Why Test/Exam columns must show testWeightedScore/examWeightedScore, not raw testScore/examScore
---

## The Rule
In `professional-report-card.tsx` the Test and Exam columns MUST display the **weighted** scores (`testWeightedScore` / `examWeightedScore`), not the raw scores (`testScore` / `examScore`).

## Why
- `examMaxScore` is often 100 (the actual exam paper), but the exam column header shows `/60` (the weight).
- Raw `examScore=37` out of `examMaxScore=100` → `examWeightedScore=22` (37% of 60).
- If raw score is shown: "40 + 37 = 77" doesn't equal the correct total "62" → users conclude the calculation is wrong.
- If weighted score is shown: "40 + 22 = 62" ✓ — numbers are self-consistent.

## How to Apply
- Always use `item.testWeightedScore` (fallback `item.testScore`) for the Test column.
- Always use `item.examWeightedScore` (fallback `item.examScore`) for the Exam column.
- `obtainedMarks` (=testWeightedScore + examWeightedScore) is always the Total column.
- The grade/percentage shown is computed from `obtainedMarks / totalMarks * 100` inline; never trust the stale `item.grade` / `item.percentage` DB columns.

## Deduplication pattern
Pre-compute `gradedItems` array (with `{ item, pct, gi }`) once before the JSX return, then use it in both the desktop table map and the mobile card map. No more `_gradeCfg2 / _pct2 / _gi2` duplicates.
