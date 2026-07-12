---
name: Report Card Admin Editing Rules
description: Key backend and frontend decisions for admin editing of report cards (scores, remarks, skills, status)
---

## Rules for Admin Report Card Editing

**Score override on published cards:**  
By default the score override endpoint (`PATCH /api/reports/items/:itemId/override`) blocks all edits when `reportCard.status === 'published'` (line ~12666 in routes.ts). **Admin and Super Admin are allowed to bypass this lock.** Check for `userRoleId === ROLES.ADMIN || userRoleId === ROLES.SUPER_ADMIN` before returning 403.

**Why:** Requirement says admin can edit any report card at any time regardless of status.

**How to apply:** When adding new edit endpoints, always add this admin bypass. Teachers remain locked out of published cards.

---

## Status Display Remapping

The `finalized` DB status value is displayed as **"In Progress"** in the admin UI (badge + stat card). The published/draft values keep their natural labels.

DB status → display label:
- `draft` → "Draft"
- `finalized` → "In Progress"
- `published` → "Published"

The admin action to move `draft → finalized` is labeled **"Mark In Progress"** in the row dropdown.

**Why:** School workflow: teacher submits (finalize) → admin reviews (in progress) → admin publishes. "Finalized" confused users who thought it meant "done/ready."

---

## Admin Report Card Query Default

`GET /api/admin/report-cards/finalized` defaults to `status = 'all'` (not 'finalized'). Admin must always see all report cards regardless of status. Frontend also defaults `statusFilter = 'all'`.

---

## Skills Save Endpoint

Save psychomotor/affective skills: `POST /api/reports/:reportCardId/skills` (NOT PUT/PATCH). Authorization: TEACHER or ADMIN; the class teacher check uses `calculateClassTeacherPermissions`.

---

## Admin Preview Editing

In `AdminResultPublishing.tsx`, the `ProfessionalReportCard` inside the preview dialog has admin editing fully enabled:
- `canEditTeacherRemarks={true}` — admin can always edit
- `canEditPrincipalRemarks={true}` — admin role has principal access  
- `canEditSkills={true}` — no status restriction for admin
- `onEditSubject` opens a score override dialog for the clicked subject item
- Real-time: a second `useSocketIORealtime` for `report_card_items` table is gated by `isViewDialogOpen`

---

## Generate Missing Report Cards Endpoint

`POST /api/admin/report-cards/generate-missing` — creates report cards for students with exam results but no report card yet. Accepts optional `classId` and `termId` query params.

**Must pre-filter to truly-missing student+term pairs before calling any per-item sync function.** The endpoint used to loop over *every* exam result and call `storage.syncExamScoreToReportCard` unconditionally (deduped only by `studentId:termId`, keeping just the first exam per student). Two bugs resulted: (1) it resynced/recalculated scores and class positions for students who already had a complete report card — never a true no-op even when nothing was missing; (2) newly-created report cards only got the *first* exam's subject populated since dedup stopped after one exam per student, leaving every other subject at 0. Fixed by first querying existing `report_cards` for the term(s) in scope, building a `studentId:termId` set, filtering exam results down to pairs NOT in that set, and — critically — no longer deduping across a missing student's exams, so every one of their exams gets synced (populating all subjects). If the filtered "missing" set is empty, return early without touching the DB or invalidating caches.

**Why:** `syncExamScoreToReportCard` has real side effects (overwrites `reportCardItems` scores, recalculates class positions) — it's safe to call once per real exam submission, but calling it for already-complete report cards during a bulk "generate missing" sweep is wasteful and semantically wrong: the feature name promises "missing only."

**How to apply:** Any future bulk backfill/repair endpoint that reuses a per-item sync/upsert function must pre-compute the true "missing" set first and only invoke the sync function for those — never rely on the sync function's own idempotency checks as the sole safety net when the endpoint's contract says "only affects missing items."
