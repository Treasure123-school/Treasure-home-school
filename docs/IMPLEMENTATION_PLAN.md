# Treasure Home School - Teacher/Student/Department/Class Assignment & Report Card Automation
## Phase 0: Discovery & Pre-Change Plan

**Generated:** November 30, 2025  
**Status:** AWAITING APPROVAL

---

## 1. CURRENT SYSTEM INVENTORY

### Database Tables (PostgreSQL via Drizzle ORM)
| Table | Status | Notes |
|-------|--------|-------|
| `users` | EXISTS | Has username field (indexed), roleId, profile fields |
| `roles` | EXISTS | 5 roles: Super Admin, Admin, Teacher, Student, Parent |
| `students` | EXISTS | Has classId, department field, parentId |
| `classes` | EXISTS | Has name, level, classTeacherId |
| `subjects` | EXISTS | Has name, code, category (default: 'general'), isActive |
| `teacher_class_assignments` | EXISTS | Links teacherId, classId, subjectId, termId |
| `teacher_profiles` | EXISTS | Professional info, subjects, assignedClasses |
| `report_cards` | EXISTS | studentId, classId, termId, status, scores, grades |
| `report_card_items` | EXISTS | testScore, examScore, weighted scores, grade |
| `system_settings` | EXISTS | testWeight(40), examWeight(60), gradingScale |
| `exams` | EXISTS | examType (test/exam), classId, subjectId |
| `exam_results` | EXISTS | Links students to exam scores |

### Key Endpoints (server/routes.ts)
- Authentication: `/api/auth/login`, `/api/auth/register`
- Students: CRUD at `/api/students`
- Teachers: CRUD at `/api/teachers`
- Classes: CRUD at `/api/classes`
- Subjects: CRUD at `/api/subjects`
- Exams: CRUD at `/api/exams`, results at `/api/exam-results`
- Report Cards: `/api/report-cards` (generation, status updates)

### Frontend Pages (client/src/pages/portal/)
- `TeacherReportCards.tsx` - Teacher report card management
- `StudentReportCard.tsx` - Student report card view
- `ParentReportCards.tsx` - Parent report card view
- `SubjectsManagement.tsx` - Subject CRUD
- `ClassesManagement.tsx` - Class CRUD
- `TeachersManagement.tsx` - Teacher CRUD
- `StudentManagement.tsx` - Student CRUD
- `SuperAdminSettings.tsx` - System settings

### Realtime Service (Socket.IO)
- Already implemented in `server/realtime-service.ts`
- Events: `reportcard.created`, `reportcard.updated`, `reportcard.published`
- Channels: user, class, role-based subscriptions

---

## 2. GAP ANALYSIS

### What Exists vs. What's Needed

| Feature | Current Status | Gap/Action Required |
|---------|----------------|---------------------|
| **Subject Categories** | Category field exists (default 'general') | Need UI to set Science/Art/Commercial |
| **Department Assignment** | `students.department` field exists | Need logic for SS1-SS3 auto-assignment |
| **Teacher Class/Subject Assignment** | `teacher_class_assignments` exists | Need enhanced UI with department filter |
| **Auto Report Card Generation** | `syncExamScoreToReportCard()` exists | Already working - verify consistency |
| **Test 40% / Exam 60% Weights** | System settings has weights | Already implemented - verify |
| **Report Card Status Workflow** | draft->finalized->published exists | Working - enhance UI |
| **Teacher Test Score Editing** | `overrideReportCardItemScore()` exists | Need better UI for inline editing |
| **Grading Settings Page** | `SuperAdminSettings.tsx` exists | Need to enhance grading section |
| **Username ID Format** | Username field exists, generators exist | THS-STU-XXX, THS-TCH-XXX patterns |

---

## 3. IMPLEMENTATION PLAN (10 PHASES)

### Phase 1: Data Model & Migrations
- [ ] Add `isActive` to subjects if missing
- [ ] Verify `department` enum for students (Science/Art/Commercial/General)
- [ ] Add `department` field to `teacher_class_assignments` if needed
- [ ] Add indexes on frequently queried fields
- **Rollback:** Migration scripts will have down migrations

### Phase 2: Subject Management & Admin UI
- [ ] Enhance SubjectsManagement.tsx with category dropdown
- [ ] Filter subjects by category in dropdowns based on class level
- [ ] API: Ensure PATCH `/api/subjects/:id` handles category updates

### Phase 3: Teacher Creation & Assignment Workflow
- [ ] Enhance TeachersManagement.tsx with:
  - Class selection (required)
  - Department selection (if SS1-SS3)
  - Subject selection (filtered by class level & department)
- [ ] Create teacher_class_assignments on teacher creation
- [ ] Teacher dashboard shows only assigned classes/subjects

### Phase 4: Student Creation & Department Auto-Assignment
- [ ] Enhance StudentManagement.tsx:
  - Department dropdown visible only for SS1-SS3
  - Auto-assign general subjects for KG1-JSS3
  - Auto-assign department subjects for SS1-SS3
- [ ] Create student_subject_assignments (if needed)

### Phase 5: Auto-Generate Report Card Pipeline
- [ ] Verify `syncExamScoreToReportCard()` creates report card on first exam
- [ ] Ensure report_card_items are created for all student's subjects
- [ ] Emit realtime events after DB commit

### Phase 6: Grading Logic & Admin Settings Page
- [ ] Enhance SuperAdminSettings.tsx grading section:
  - Test/Exam weight inputs (validate sum=100)
  - Grading scale configuration
  - Score aggregation mode (last/best/average)
- [ ] Settings changes broadcast via Socket.IO

### Phase 7: Teacher Report Card Page Redesign
- [ ] Redesign TeacherReportCards.tsx with:
  - Class/Term filters
  - Student list table with inline test score editing
  - Modal for full report view/edit
  - Status tags (Draft/Finalized/Published)
  - Save Draft, Finalize, Publish, Revert buttons
  - Teacher signature upload

### Phase 8: Student & Parent View + Realtime Delivery
- [ ] StudentReportCard.tsx shows only published (or draft if allowed)
- [ ] ParentReportCards.tsx shows children's published reports
- [ ] Socket.IO subscription for instant updates

### Phase 9: Exam -> Report Card Consistency
- [ ] Handle multiple exams per subject (last/best/average)
- [ ] Prevent duplicate report card rows
- [ ] Handle partial data (exam present, test missing)

### Phase 10: Cleanup, Testing, Docs & Deploy
- [ ] Remove dead code
- [ ] Run lint, type-check, tests
- [ ] Deploy to staging, verify
- [ ] Deploy to production

---

## 4. TEST PLAN

### Unit Tests
- Subject category filtering logic
- Department auto-assignment logic
- Grading weight calculations
- Report card generation edge cases

### Integration Tests
- Teacher creation with assignments
- Student creation with department
- Exam submission -> Report card sync
- Status transitions (draft->finalized->published)

### E2E Tests
- Teacher creates exam, student takes it, report card appears
- Teacher edits test scores, saves, finalizes, publishes
- Student and parent see published report card

---

## 5. ROLLBACK STEPS

1. **Database:** Each migration has corresponding down migration
2. **Code:** Git revert to previous commit
3. **Deployment:** Vercel/Render instant rollback to previous deployment

---

## 6. DEPLOYMENT CHECKLIST

- [ ] Backup production database
- [ ] Run migrations in staging
- [ ] Test all critical flows in staging
- [ ] Deploy to production
- [ ] Monitor error logs for 24 hours
- [ ] Confirm with stakeholders

---

## APPROVAL REQUIRED

Before proceeding to Phase 1, please confirm:
1. Do you approve this implementation plan?
2. Should I proceed with Phase 1 (Data Model & Migrations)?
3. Any specific priorities or concerns?

---

*This document will be updated after each phase completion.*
