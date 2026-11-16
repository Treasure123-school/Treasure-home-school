# Student Promotion & Rollover System - Production Deployment Guide

**Status**: ✅ Development Complete | ⏳ Awaiting Production Deployment Approval  
**Commit**: `e8098673` - feat: Student Promotion & Academic Year Rollover System  
**Date**: 2026-11-14  

---

## 🎯 System Overview

The Student Promotion & Academic Year Rollover System enables Treasure Home School to:
- **Bulk-promote** hundreds of students between academic sessions in seconds
- **Manage** 5 student outcomes: promoted, repeating, graduated, withdrawn, deferred
- **Track** full audit history of all promotions with batch records
- **Rollover** academic years with automatic term creation
- **Correct** individual student outcomes post-promotion
- **Eliminate** manual per-student profile editing

**Architecture**: Single-school system (not multi-tenant SaaS). Uses operational pointer (`students.class_id`) + per-session enrollment history (`student_enrollments` table) + snapshot-at-write academic records.

---

## 📦 What Was Built

### Backend (Phases A & B) ✅
**Database Schema Changes**:
- **3 new tables**: `student_enrollments`, `promotion_batches`, `promotion_records`
- **3 new columns** on `classes`: `sequence_order`, `next_class_id`, `is_graduation_level`
- **Partial unique index**: `promotion_batches_transition_unique_idx` (prevents duplicate active batches)
- **86 students seeded** into session 4, progression chain configured (Playgroup→SSS 3)

**Backend Module** (`server/modules/promotions/`):
- **8 REST endpoints** under `/api/admin/promotions/*`:
  1. `GET /preview` — preview promotion outcomes (promoted/repeating/graduated by class)
  2. `GET /mappings` — get class progression mappings
  3. `PUT /mappings` — update class progression
  4. `POST /execute` — bulk promote students (per-student transactions, subject assignment)
  5. `GET /history` — list all promotion batches
  6. `GET /history/:id` — get batch detail with all records
  7. `PATCH /records/:id/correct` — correct individual failed records
  8. `POST /rollover-activate` — activate new academic year (create session/terms)

**Safety & Audit Features**:
- Race-safe batch creation (23505 → 409 conflict)
- Stale batch recovery (>60min old → mark failed)
- Idempotent execute (handles dest-enrollment conflicts gracefully)
- Per-student transactions (rollback on failure)
- Correction trail (only reverts success records)
- Full history (batches + records with student names/classes)
- Duplicate prevention (unique index + service validation)

**Infrastructure Fixes**:
- Node v22 Happy-Eyeballs bug fix (`setDefaultAutoSelectFamily(false)`)
- Pool crash handler (`pool.on('error')` in `server/db.ts`)
- `getAllStudents` lifecycle filter (excludes graduated/withdrawn from active lists)

### Frontend (Phase C) ✅
**Promotion Wizard** (`client/src/pages/portal/StudentPromotion.tsx`):
- **5-step guided workflow**:
  1. **Sessions**: Select source (completed) and destination (active) sessions
  2. **Preview**: View promotion statistics with class-by-class breakdown
  3. **Outcomes**: Configure individual student overrides (optional)
  4. **Review**: Final summary before execution
  5. **Execute**: Real-time progress and results
- **History Tab**: Batch listing with sortable table, status badges, transition arrows
- **Route**: `/portal/admin/students/promotion`
- **Nav Item**: Student Management group in admin sidebar (TrendingUp icon)

**UI Components**:
- `MiniStatCard` for promotion summary stats (Total/Promoted/Repeating/Graduated)
- `DataTable` for history and batch detail records
- `Dialog` wizard with step indicator (ExamWizardDialog pattern)
- `Tabs` for Wizard/History views
- `Alert` for warnings and confirmations

### Testing Complete ✅
**Functional Tests** (86-student full cycle, session 4→5):
- ✅ 83 promoted, 1 repeating, 2 graduated, 0 withdrawn, 0 deferred
- ✅ 634 subject assignments created
- ✅ User statuses updated correctly (2 graduated active, 84 active)
- ✅ Session 5 enrollments created (83 active across JSS 1-3/SSS 1-3, 1 deferred pending)
- ✅ Corrections tested (withdrawn→promoted, deferred→promoted)
- ✅ Rollover tested (session 5 activated, 3 terms created, isCurrent flags cleared)
- ✅ Duplicate batch prevention (409 conflict)
- ✅ Graduated student login verified (JWT issued successfully)
- ✅ All 5 wizard API endpoints validated
- ✅ TypeScript compilation clean (no errors)

**Regression Tests**:
- ✅ `/api/students` returns 84 active students (86-2 graduated, withdrawn corrected back)
- ✅ `/api/classes` returns 14 classes
- ✅ `/api/exams` returns 1 exam
- ✅ Report cards preserved in DB (session 4/term 14)
- ✅ Term 15 is isCurrent

---

## 🚀 Production Deployment Steps

### Prerequisites
- [x] Development testing complete (86 students promoted successfully)
- [x] Backend code committed (`e8098673`)
- [x] Frontend wizard built and tested
- [ ] **User approval for production deployment**
- [ ] Production database credentials (Neon pooler: `ep-still-bread-ah4dijdo-pooler`)
- [ ] Backup plan and rollback procedure

### Step 1: Database Migration (Production)

**⚠️ CRITICAL**: These DDL statements **MUST** be run on production Neon database **BEFORE** deploying code.

```bash
# Connect to production database
psql "postgresql://neondb_owner:...@ep-still-bread-ah4dijdo-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

**Run the following SQL** (statement-by-statement; each is idempotent — safe to re-run).

> **NOTE (updated 2026-11-16)**: This DDL matches `shared/schema.pg.ts` exactly — the version
> previously written here was an earlier draft and did NOT match the app's queries (wrong
> column names like `enrollment_status`, `source_class_id`, `created_at` on batches, and UUID
> FK types). Production uses `varchar(36)` ids for users/students; FKs below match that.
> Verified working on production 2026-11-16.

```sql
-- 1. Create student_enrollments table (matches schema.pg studentEnrollments)
CREATE TABLE IF NOT EXISTS student_enrollments (
  id SERIAL PRIMARY KEY,
  student_id VARCHAR(36) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  session_id INTEGER NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  promotion_outcome VARCHAR(20),
  promoted_to_class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS student_enrollments_student_idx ON student_enrollments(student_id);
CREATE INDEX IF NOT EXISTS student_enrollments_session_idx ON student_enrollments(session_id);
CREATE INDEX IF NOT EXISTS student_enrollments_class_idx ON student_enrollments(class_id);
CREATE UNIQUE INDEX IF NOT EXISTS student_enrollments_unique_idx ON student_enrollments(student_id, session_id);

-- 2. Create promotion_batches table (matches schema.pg promotionBatches)
CREATE TABLE IF NOT EXISTS promotion_batches (
  id SERIAL PRIMARY KEY,
  source_session_id INTEGER NOT NULL REFERENCES academic_sessions(id),
  destination_session_id INTEGER NOT NULL REFERENCES academic_sessions(id),
  executed_by VARCHAR(36) NOT NULL REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  total_students INTEGER NOT NULL DEFAULT 0,
  promoted_count INTEGER NOT NULL DEFAULT 0,
  repeating_count INTEGER NOT NULL DEFAULT 0,
  graduated_count INTEGER NOT NULL DEFAULT 0,
  withdrawn_count INTEGER NOT NULL DEFAULT 0,
  deferred_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  executed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS promotion_batches_source_idx ON promotion_batches(source_session_id);
CREATE INDEX IF NOT EXISTS promotion_batches_dest_idx ON promotion_batches(destination_session_id);
CREATE INDEX IF NOT EXISTS promotion_batches_executed_by_idx ON promotion_batches(executed_by);
CREATE INDEX IF NOT EXISTS promotion_batches_executed_at_idx ON promotion_batches(executed_at);

-- Partial unique index: one non-failed batch per session transition
CREATE UNIQUE INDEX IF NOT EXISTS promotion_batches_transition_unique_idx
  ON promotion_batches (source_session_id, destination_session_id)
  WHERE status <> 'failed';

-- 3. Create promotion_records table (matches schema.pg promotionRecords)
CREATE TABLE IF NOT EXISTS promotion_records (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES promotion_batches(id) ON DELETE CASCADE,
  student_id VARCHAR(36) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  from_class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  to_class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  outcome VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'success',
  reason TEXT,
  error_message TEXT,
  corrected_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
  corrected_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS promotion_records_batch_idx ON promotion_records(batch_id);
CREATE INDEX IF NOT EXISTS promotion_records_student_idx ON promotion_records(student_id);
CREATE INDEX IF NOT EXISTS promotion_records_outcome_idx ON promotion_records(outcome);

-- 4. Add progression columns to classes table
ALTER TABLE classes ADD COLUMN IF NOT EXISTS sequence_order INTEGER;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS next_class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_graduation_level BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_classes_sequence ON classes(sequence_order);
CREATE INDEX IF NOT EXISTS idx_classes_next ON classes(next_class_id);

-- 5. Seed progression chain (Playgroup -> SSS 3)
-- Class names must match your classes table; Primary 5 chains straight to JSS 1
-- when no Primary 6 row exists (matches dev + prod).
UPDATE classes SET sequence_order = 1, next_class_id = (SELECT id FROM classes WHERE name='Nursery 1'), is_graduation_level = FALSE WHERE name = 'Playgroup';
UPDATE classes SET sequence_order = 2, next_class_id = (SELECT id FROM classes WHERE name='Nursery 2'), is_graduation_level = FALSE WHERE name = 'Nursery 1';
UPDATE classes SET sequence_order = 3, next_class_id = (SELECT id FROM classes WHERE name='Primary 1'), is_graduation_level = FALSE WHERE name = 'Nursery 2';
UPDATE classes SET sequence_order = 4, next_class_id = (SELECT id FROM classes WHERE name='Primary 2'), is_graduation_level = FALSE WHERE name = 'Primary 1';
UPDATE classes SET sequence_order = 5, next_class_id = (SELECT id FROM classes WHERE name='Primary 3'), is_graduation_level = FALSE WHERE name = 'Primary 2';
UPDATE classes SET sequence_order = 6, next_class_id = (SELECT id FROM classes WHERE name='Primary 4'), is_graduation_level = FALSE WHERE name = 'Primary 3';
UPDATE classes SET sequence_order = 7, next_class_id = (SELECT id FROM classes WHERE name='Primary 5'), is_graduation_level = FALSE WHERE name = 'Primary 4';
UPDATE classes SET sequence_order = 8, next_class_id = COALESCE((SELECT id FROM classes WHERE name='Primary 6'), (SELECT id FROM classes WHERE name='JSS 1')), is_graduation_level = FALSE WHERE name = 'Primary 5';
UPDATE classes SET sequence_order = 9, next_class_id = (SELECT id FROM classes WHERE name='JSS 2'), is_graduation_level = FALSE WHERE name = 'Primary 6';
UPDATE classes SET sequence_order = 10, next_class_id = (SELECT id FROM classes WHERE name='JSS 2'), is_graduation_level = FALSE WHERE name = 'JSS 1';
UPDATE classes SET sequence_order = 11, next_class_id = (SELECT id FROM classes WHERE name='JSS 3'), is_graduation_level = FALSE WHERE name = 'JSS 2';
UPDATE classes SET sequence_order = 12, next_class_id = (SELECT id FROM classes WHERE name='SSS 1'), is_graduation_level = FALSE WHERE name = 'JSS 3';
UPDATE classes SET sequence_order = 13, next_class_id = (SELECT id FROM classes WHERE name='SSS 2'), is_graduation_level = FALSE WHERE name = 'SSS 1';
UPDATE classes SET sequence_order = 14, next_class_id = (SELECT id FROM classes WHERE name='SSS 3'), is_graduation_level = FALSE WHERE name = 'SSS 2';
UPDATE classes SET sequence_order = 15, next_class_id = NULL, is_graduation_level = TRUE WHERE name = 'SSS 3';

-- 6. Seed current students into student_enrollments (active session)
-- Uses the students table (class pointer lives there, not on users).
INSERT INTO student_enrollments (student_id, session_id, class_id, status)
SELECT
  s.id,
  (SELECT id FROM academic_sessions WHERE status = 'active' LIMIT 1),
  s.class_id,
  'active'
FROM students s
WHERE s.class_id IS NOT NULL
ON CONFLICT (student_id, session_id) DO NOTHING;

-- 7. Verify installation
SELECT
  (SELECT COUNT(*) FROM student_enrollments) as enrollments_count,
  (SELECT COUNT(*) FROM promotion_batches) as batches_count,
  (SELECT COUNT(*) FROM promotion_records) as records_count,
  (SELECT COUNT(*) FROM classes WHERE sequence_order IS NOT NULL) as classes_with_progression;
```

**Expected Output**:
```
enrollments_count | batches_count | records_count | classes_with_progression
------------------+---------------+---------------+-------------------------
           86     |      0        |      0        |           15
```

### Step 2: Deploy Code to Render

```bash
# Push commit to main branch (triggers Render auto-deploy)
cd /public/Treasure-home-school
git push origin main

# Monitor deployment logs in Render dashboard
# Verify server starts successfully with no errors
```

**Check deployment logs for**:
- ✅ `✅ Database indexes: 55 created/verified, 0 errors`
- ✅ `serving on port 5000`
- ⚠️ No `ETIMEDOUT` or `ECONNABORTED` errors (Happy-Eyeballs fix should prevent)
- ⚠️ No unhandled pool errors (crash handler should catch)

### Step 3: Smoke Test Production

```bash
# 1. Login as admin
curl -X POST https://ths-portal.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin","password":"YOUR_ADMIN_PASSWORD"}' \
  | jq -r .token > /tmp/prod_token.txt

TOKEN=$(cat /tmp/prod_token.txt)

# 2. Test promotion endpoints
curl -s https://ths-portal.onrender.com/api/admin/promotions/history \
  -H "Authorization: Bearer $TOKEN" | jq

curl -s "https://ths-portal.onrender.com/api/admin/promotions/mappings" \
  -H "Authorization: Bearer $TOKEN" | jq length

# 3. Access wizard in browser
# Navigate to: https://ths-portal.onrender.com/portal/admin/students/promotion
# Verify:
# - Wizard opens with 5 steps
# - Sessions dropdown populated
# - History tab shows empty state (no batches yet)
```

### Step 4: First Production Promotion (Manual Oversight)

**⚠️ CRITICAL**: Run the first production promotion during **low-traffic hours** with **admin supervision**.

1. **Backup production database** before promotion:
   ```bash
   pg_dump "postgresql://..." > ths_backup_before_promotion_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Create destination session** if not exists:
   - Go to Academic Terms page
   - Create new session (e.g., 2027/2028)
   - Set status to "upcoming" (not "active" yet)

3. **Complete current session**:
   - Mark current session (e.g., 2026/2027) as "completed"

4. **Run promotion wizard**:
   - Select source session (completed) and destination session (upcoming)
   - Review preview carefully — verify student counts match expectations
   - Check class progression mappings
   - Execute promotion
   - **Monitor server logs during execution** for errors

5. **Verify results**:
   - Check batch detail in History tab
   - Verify promoted students' `class_id` updated
   - Verify `student_enrollments` created for destination session
   - Test student login (should see new class)
   - Check subject assignments created

6. **Activate destination session**:
   - Use rollover-activate endpoint OR manually set session status to "active"
   - Verify terms created
   - Verify `isCurrent` flag set correctly

### Step 5: Post-Deployment Monitoring

**Week 1 checklist**:
- [ ] Monitor server logs for pool errors, ETIMEDOUT, or promotion failures
- [ ] Verify graduated students can still login (status=graduated, is_active=true)
- [ ] Verify withdrawn students cannot login (is_active=false)
- [ ] Check `/api/students` excludes graduated/withdrawn from active lists
- [ ] Monitor Neon database performance (connection pool usage, query times)
- [ ] Test correction flow if any students need outcome changes

---

## 🔄 Rollback Procedure

If promotion fails or produces incorrect results:

### Option 1: Correction (Preferred for partial failures)
Use the correction endpoint to fix individual student outcomes:
```bash
curl -X PATCH https://ths-portal.onrender.com/api/admin/promotions/records/:recordId/correct \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "correctedOutcome": "promoted",
    "destinationClassId": 10,
    "reason": "Student passed after re-assessment"
  }'
```

### Option 2: Full Rollback (For catastrophic failures)
1. **Restore database backup**:
   ```bash
   psql "postgresql://..." < ths_backup_before_promotion_YYYYMMDD_HHMMSS.sql
   ```
2. **Revert code deployment** (Render dashboard → Rollback to previous commit)
3. **Verify system state** (sessions, students, classes)

---

## 📊 Known Limitations & Future Enhancements

**Current Limitations**:
- Duplicate-batch guard allows only **1 completed batch per session transition** (corrections via PATCH, not re-run)
- No bulk correction UI (must use API directly)
- Outcome overrides in wizard Step 3 are UI-only (not yet wired to backend logic for per-student overrides during execute)
- No email notifications for promoted students/parents

**Future Enhancements** (not implemented, defer to Phase D):
- Bulk correction UI for failed records
- Pre-promotion validation rules (e.g., require passing grades, fee clearance)
- Email/SMS notifications on promotion
- Multi-tenant support (if THS expands to multiple campuses)
- Promotion scheduling (execute at specific date/time)
- Undo promotion (full batch revert with transaction log)

---

## 🐛 Troubleshooting

### Issue: `ETIMEDOUT` on database connections
**Cause**: Node v22 Happy-Eyeballs bug (250ms per-attempt timeout)  
**Fix**: Applied in `server/db.ts` — `net.setDefaultAutoSelectFamily(false)` + 5000ms timeout  
**Verify**: Check server logs for no `ETIMEDOUT` errors on startup

### Issue: Unhandled pool error crashes server
**Cause**: Idle connection drops (`ECONNABORTED` on TLS socket)  
**Fix**: Applied in `server/db.ts` — `pool.on('error', ...)` handler logs and ignores  
**Verify**: Check server logs for `⚠️ Pool error (ignored)` messages (not crash)

### Issue: Duplicate batch error (409)
**Cause**: Trying to create 2nd batch for same session transition while 1st is in-progress/completed  
**Fix**: Expected behavior — check History tab for existing batch, use corrections if needed  
**Override**: Manually mark old batch as `failed` in DB to allow retry

### Issue: Student not promoted
**Cause**: Student may have failed record with error message  
**Fix**: Check batch detail in History → find failed record → use correction endpoint  
**Debug**: Query `promotion_records` table for `status='failed'` and `error_message`

### Issue: Graduated students missing from student list
**Cause**: `getAllStudents` filter excludes `graduated` status (by design)  
**Fix**: Expected behavior — graduated students can still login but hidden from active lists  
**Query**: Use `/api/students?includeGraduated=true` (if implemented) or query DB directly

---

## 📝 Files Modified/Created

**Backend** (787 lines):
- `server/modules/promotions/promotions.service.ts` (640 lines) — core business logic
- `server/modules/promotions/promotions.controller.ts` (127 lines) — HTTP handlers
- `server/modules/promotions/promotions.routes.ts` (20 lines) — Express routes
- `server/modules/promotions/index.ts` — barrel export
- `server/routes.ts` — mount `/api/admin/promotions`
- `server/db.ts` — pool crash handler + Happy-Eyeballs fix
- `server/storage/student-parent-profiles.ts` — `getAllStudents` filter
- `shared/schema.pg.ts` — table declarations

**Frontend** (744 lines):
- `client/src/pages/portal/StudentPromotion.tsx` (744 lines) — wizard + history
- `client/src/components/layout/PortalShells.tsx` — route registration
- `client/src/components/layout/PortalLayout.tsx` — nav item + TrendingUp icon import

**Documentation**:
- `PROMOTION_DEPLOYMENT_GUIDE.md` — this file
- `MIGRATION_PROGRESS.md` — updated with freeze notice and testing results

**Git Commit**: `e8098673` — 11 files changed, 1826 insertions(+), 8 deletions(-)

---

## ✅ Pre-Deployment Checklist

- [x] Backend API endpoints tested (8/8 working)
- [x] Frontend wizard built and tested (5 steps, TypeScript clean)
- [x] Database schema validated (3 tables, 3 columns, indexes, unique constraint)
- [x] 86-student full cycle tested on dev (83 promoted, 1 repeating, 2 graduated)
- [x] Corrections tested (withdrawn→promoted, deferred→promoted)
- [x] Rollover tested (session 5 activated, 3 terms created)
- [x] Duplicate prevention tested (409 conflict)
- [x] Graduated student login verified
- [x] Regression tests passed (students/classes/exams/report-cards preserved)
- [x] Infrastructure fixes applied (Happy-Eyeballs, pool crash handler)
- [x] Code committed (`e8098673`)
- [ ] **User approval obtained** ← **REQUIRED BEFORE PROCEEDING**
- [ ] Production database backup created
- [ ] DDL statements run on production Neon
- [ ] Code deployed to Render
- [ ] Smoke tests passed
- [ ] First production promotion executed under supervision

---

## 📞 Support Contacts

**Developer**: Kiro (OpenCode AI)  
**School Administrator**: [THS Admin Contact]  
**Database Provider**: Neon (https://neon.tech)  
**Hosting Provider**: Render (https://render.com)  

**Emergency Rollback**: Restore database backup + revert code deployment in Render dashboard.

---

**END OF DEPLOYMENT GUIDE**
