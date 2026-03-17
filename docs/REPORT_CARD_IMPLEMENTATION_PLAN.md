# Report Card Redesign + Username-as-ID + Grading Settings
## Implementation Plan (Phase 0 Deliverable)

---

## DISCOVERY SUMMARY

### Current State Analysis

#### 1. Database Schema (Already Exists)

**Report Cards Tables** (`shared/schema.pg.ts` & `shared/schema.ts`):
- `reportCards`: id, studentId (UUID), classId, termId, sessionYear, totalScore, averageScore, averagePercentage, overallGrade, position, totalStudentsInClass, teacherRemarks, principalRemarks, status, gradingScale, scoreAggregationMode, timestamps
- `reportCardItems`: id, reportCardId, subjectId, testExamId, testScore, testMaxScore, testWeightedScore, examExamId, examScore, examMaxScore, examWeightedScore, totalMarks, obtainedMarks, percentage, grade, teacherRemarks, isOverridden, overriddenAt

**User Schema**:
- `users`: Has `username` field (VARCHAR, unique, indexed)
- `students`: Has `admissionNumber` field (VARCHAR, unique)
- Username format: `THS-ROLE-###` (e.g., THS-STU-001, THS-TCH-001)
- Username generation: `server/auth-utils.ts` and `server/username-generator.ts`

**System Settings** (`systemSettings` table):
- Already has: `testWeight` (default 40), `examWeight` (default 60), `defaultGradingScale` (default 'standard')
- Already has username prefix configs: `usernameStudentPrefix`, `usernameTeacherPrefix`, etc.

#### 2. Grading Logic (Already Exists)
- `shared/grading-utils.ts`: STANDARD_GRADING_SCALE with testWeight: 40, examWeight: 60
- `calculateWeightedScore()`: Combines test + exam scores using configured weights
- `calculateGradeFromPercentage()`: Maps percentage to grade letter
- Scales: standard, waec, percentage

#### 3. Socket.IO Realtime (Already Exists)
- `server/realtime-service.ts`: Full implementation
- `emitReportCardEvent()`: Handles created, updated, published, finalized, reverted
- Client hook: `useSocketIORealtime` for automatic cache invalidation

#### 4. Teacher Report Cards Page (Exists, Needs Enhancement)
- `client/src/pages/portal/TeacherReportCards.tsx` (1333 lines)
- Has: Class/term selectors, report card list, view/edit dialogs, status management
- Has: Override functionality, bulk operations, real-time subscriptions

#### 5. Admin Settings Page (Exists, Needs Grading Section)
- `client/src/pages/portal/SuperAdminSettings.tsx`
- Has: School info, module toggles, maintenance mode
- Missing: Grading weights, grading scale editor, report card behavior settings

---

## IMPLEMENTATION PHASES

### PHASE 1: Canonical Identifier (Username = Admission ID)
**Status: Mostly Complete - Minor Updates Needed**

**Current State**:
- Users table has `username` field with unique index
- Students table has `admissionNumber` field
- Username generation uses THS-ROLE-### format

**Tasks**:
1. [ ] Verify all report card queries include username in responses
2. [ ] Update report card API responses to include `studentUsername` alongside `studentId`
3. [ ] Add username to report card list display in teacher UI
4. [ ] Ensure CSV imports populate username correctly

**No Database Migration Required** - Schema already supports this.

---

### PHASE 2: Grading Settings in Admin UI
**Status: Backend Ready - Frontend Needed**

**Current State**:
- `systemSettings` table has `testWeight`, `examWeight`, `defaultGradingScale`
- API endpoints exist: GET/PUT `/api/superadmin/settings`
- SuperAdminSettings.tsx doesn't display grading fields

**Tasks**:
1. [ ] Add "Grading Configuration" card to SuperAdminSettings.tsx with:
   - Test Weight slider/input (0-100, default 40)
   - Exam Weight slider/input (0-100, default 60)
   - Validation: Test + Exam = 100
   - Default Grading Scale selector (standard/waec/percentage)
2. [ ] Add "Report Card Behavior" toggles:
   - Auto-create report card on first exam
   - Score aggregation mode (last/best/average)
   - Show grade breakdown toggle
   - Allow teacher overrides toggle
3. [ ] Add Grading Scale Editor:
   - Display current scale ranges
   - Allow editing min/max/grade/remarks for each range
   - Save custom scales to JSON in settings
4. [ ] Broadcast settings changes via Socket.IO for instant effect

**No Database Migration Required** - Fields already exist in systemSettings.

---

### PHASE 3: Teacher Report Card UI Redesign
**Status: Functional - Professional Redesign Needed**

**Current State**:
- TeacherReportCards.tsx has basic functionality
- View dialog exists but needs enhancement
- Override dialog exists for score editing

**Tasks**:
1. [ ] Redesign header with:
   - Class/term/session selectors
   - Generate/recompute actions
   - Export buttons (PDF/CSV)
   - Grading weights display
2. [ ] Enhance student list table with columns:
   - Position | Photo | Student Name | Admission No (username) | Average | Grade | Status | Actions
   - Sortable columns
   - Quick status indicators
3. [ ] Redesign Student Report Modal:
   - Student header with photo (Cloudinary), username, class info
   - Subject table: Subject | Teacher | Test (editable) | Exam | Total | Grade | Remarks
   - Inline editing with optimistic updates
   - Action buttons: Save Draft, Finalize, Publish, Revert
   - Signature & remarks section
4. [ ] Add authorization: Teachers can only edit their assigned classes/subjects

**No Database Migration Required**.

---

### PHASE 4: Auto-Generation Flow Enhancement
**Status: Partially Implemented - Needs Verification**

**Tasks**:
1. [ ] Verify exam completion triggers report card creation
2. [ ] Ensure auto-population of exam scores into report card items
3. [ ] Emit `reportcard.created` and `reportcard.updated` events
4. [ ] Test flow: Student submits exam -> Report card created/updated -> Teacher sees update

**No Database Migration Required**.

---

### PHASE 5: Real-time & Instant UX
**Status: Implemented - Verify & Polish**

**Current State**:
- Socket.IO service emits report card events
- Client hook invalidates queries on events

**Tasks**:
1. [ ] Verify optimistic UI updates on score edits
2. [ ] Test settings broadcast on weight changes
3. [ ] Ensure all stakeholders (teacher/student/parent/admin) receive appropriate updates

**No Database Migration Required**.

---

### PHASE 6: Tests & QA
**Tasks**:
1. [ ] Unit tests: grading calculations with custom weights
2. [ ] Integration tests: exam submission -> report card update flow
3. [ ] E2E tests: teacher edits -> student sees published report
4. [ ] Verify SQLite (dev) and PostgreSQL (prod) parity

---

## DATABASE MIGRATION SUMMARY

### Required Migrations: NONE

All required fields already exist:
- `reportCards` table: Complete with all fields
- `reportCardItems` table: Complete with all fields  
- `systemSettings` table: Has testWeight, examWeight, defaultGradingScale
- `users` table: Has username with index

### Backup Instructions (Before Any Changes)
```bash
# PostgreSQL (Production)
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# SQLite (Development)
cp server/db/local.db server/db/local_backup_$(date +%Y%m%d_%H%M%S).db
```

---

## API CHANGES NEEDED

### Existing Endpoints (Verified Working):
- `GET /api/reports/class-term/:classId/:termId` - Get report cards for class/term
- `GET /api/reports/:id/full` - Get full report card with items
- `PATCH /api/reports/:id/status` - Update status (draft/finalized/published)
- `PATCH /api/reports/:id/remarks` - Update remarks
- `PATCH /api/reports/items/:id/override` - Override item scores
- `POST /api/reports/:id/auto-populate` - Auto-populate from exams
- `GET /api/superadmin/settings` - Get system settings
- `PUT /api/superadmin/settings` - Update system settings
- `GET /api/grading-config` - Get grading configuration

### New/Modified Endpoints:
1. [ ] Modify report card responses to include `studentUsername`
2. [ ] Add `POST /api/calculate-grade` - Server-side grade calculation endpoint
3. [ ] Add settings broadcast via Socket.IO after PUT /api/superadmin/settings

---

## REALTIME EVENTS

### Existing Events (Verified):
- `reportcard.created` - When new report card is auto-generated
- `reportcard.updated` - When scores/remarks change
- `reportcard.finalized` - When teacher finalizes
- `reportcard.published` - When admin publishes
- `reportcard.reverted` - When reverted to draft
- `reportcard.bulk_published` / `reportcard.bulk_finalized`

### New Events:
1. [ ] `settings.updated` - Broadcast when grading weights change

---

## UI PAGES TO UPDATE

1. **SuperAdminSettings.tsx** - Add grading configuration section
2. **TeacherReportCards.tsx** - Redesign with professional UI
3. **StudentReportCard.tsx** - Verify displays username correctly
4. **ParentReportCards.tsx** - Verify displays username correctly

---

## ROLLBACK STEPS

Since no database migrations are needed, rollback is code-only:
```bash
git revert HEAD~N  # Revert N commits
npm run dev        # Restart development server
```

---

## ACCEPTANCE CRITERIA CHECKLIST

- [ ] Username is used as canonical admission ID across the system
- [ ] Lookups by username work and are indexed
- [ ] Default grading uses Test 40% & Exam 60%
- [ ] Admin can change weights via Settings page
- [ ] Changes take effect instantly (realtime broadcast)
- [ ] When student completes first exam, report card auto-creates (status = draft)
- [ ] Teacher can edit test marks, save, finalize, publish, revert
- [ ] UI updates in realtime
- [ ] Student and parent see published report immediately
- [ ] All tests pass in staging and production
- [ ] No regression in SQLite dev environment
- [ ] No dead code or duplicate logic

---

## ESTIMATED EFFORT

| Phase | Effort | Risk |
|-------|--------|------|
| Phase 1: Username as ID | Low | Low |
| Phase 2: Admin Grading UI | Medium | Low |
| Phase 3: Teacher UI Redesign | High | Medium |
| Phase 4: Auto-Generation | Low | Low |
| Phase 5: Realtime Polish | Low | Low |
| Phase 6: Testing | Medium | Low |

**Total Estimated Time**: 2-3 development sessions

---

## APPROVAL

This plan requires approval before proceeding to implementation.

**Key Findings**:
1. No database migrations needed - all fields exist
2. Backend APIs mostly complete - frontend updates needed
3. Grading logic already uses correct default weights (40/60)
4. Socket.IO realtime is fully implemented

**Recommended Approach**: Start with Phase 2 (Admin UI) and Phase 3 (Teacher UI) in parallel, then verify auto-generation and realtime flows.
