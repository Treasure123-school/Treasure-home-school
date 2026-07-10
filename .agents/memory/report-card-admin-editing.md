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

`POST /api/admin/report-cards/generate-missing` — creates report cards for students with exam results but no report card. Uses `selectDistinct` + deduplicates by `studentId:termId` key. Accepts optional `classId` and `termId` query params.
