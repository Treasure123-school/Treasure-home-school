# Production Deployment Checklist
**Date**: 2026-11-14  
**Feature**: Student Promotion & Academic Year Rollover System + Academic Sessions Optimistic Updates  
**Target**: Production Neon Database (`ep-still-bread-ah4dijdo-pooler`)

---

## ✅ Pre-Deployment Verification

### Code Readiness
- [x] **Promotion system backend** complete (8 REST endpoints, 640-line service)
- [x] **Promotion wizard frontend** complete (744-line 5-step wizard)
- [x] **Academic Sessions optimistic updates** complete (instant UI feedback)
- [x] **TypeScript compilation** clean (no errors)
- [x] **Development testing** complete (86 students promoted successfully)
- [x] **Regression tests** passed (students/classes/exams APIs working)
- [x] **Infrastructure fixes** applied (Node v22 Happy-Eyeballs bug, pool crash handler)

### Commits Ready to Deploy
```
ec4188ed - fix: Add optimistic updates to academic sessions/terms for instant UI feedback
2376404a - feat: Complete promotion wizard with progress UI, error handling, validation, auto-refresh
9a2eaa13 - fix: History date + execute payload + live outcome editor
123827cc - feat: Functional student search in Step 3
3330c6f9 - fix: Wizard errors (API response structure, controlled components)
f950a94d - docs: Production deployment guide
e8098673 - feat: Student Promotion & Academic Year Rollover System
```

### Documentation
- [x] **PROMOTION_DEPLOYMENT_GUIDE.md** - Complete 488-line deployment guide with DDL migration
- [x] **This checklist** - Quick reference for deployment day

---

## 🚀 Deployment Day Checklist

### Phase 1: Pre-Deployment (15 minutes)
- [ ] **Notify staff** - Send notification: "Promotion system deployment in progress, expect 30-minute downtime"
- [ ] **Backup production database**
  ```bash
  pg_dump "postgresql://neondb_owner:...@ep-still-bread-ah4dijdo-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require" > ths_backup_$(date +%Y%m%d_%H%M%S).sql
  ```
- [ ] **Verify backup file size** (should be >10MB with existing data)
- [ ] **Note current row counts**
  ```sql
  SELECT 
    (SELECT COUNT(*) FROM users WHERE role_id = 4) as students,
    (SELECT COUNT(*) FROM classes) as classes,
    (SELECT COUNT(*) FROM academic_sessions) as sessions;
  ```

### Phase 2: Database Migration (20 minutes)
- [ ] **Connect to production Neon**
  ```bash
  psql "postgresql://neondb_owner:...@ep-still-bread-ah4dijdo-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
  ```
- [ ] **Run DDL migration** (copy/paste from PROMOTION_DEPLOYMENT_GUIDE.md lines 120-256)
  - [ ] Create `student_enrollments` table + indexes
  - [ ] Create `promotion_batches` table + indexes + unique constraint
  - [ ] Create `promotion_records` table + indexes
  - [ ] Add 3 columns to `classes` table (sequence_order, next_class_id, is_graduation_level)
  - [ ] Seed progression chain (Playgroup → SSS 3)
  - [ ] Seed current students into `student_enrollments`
- [ ] **Verify migration**
  ```sql
  SELECT 
    (SELECT COUNT(*) FROM student_enrollments) as enrollments,
    (SELECT COUNT(*) FROM classes WHERE sequence_order IS NOT NULL) as progression_classes;
  ```
  Expected: enrollments > 0, progression_classes = 15

### Phase 3: Code Deployment (10 minutes)
- [ ] **Push to main branch** (triggers Render auto-deploy)
  ```bash
  cd /public/Treasure-home-school
  git push origin main
  ```
- [ ] **Monitor Render deployment logs**
  - [ ] Check for `✅ Database indexes: 55 created/verified, 0 errors`
  - [ ] Check for `serving on port 5000`
  - [ ] Verify NO `ETIMEDOUT` or `ECONNABORTED` errors
  - [ ] Verify NO unhandled pool errors
- [ ] **Wait for deployment to complete** (Render shows "Live")

### Phase 4: Smoke Tests (15 minutes)
- [ ] **Test admin login**
  ```bash
  curl -X POST https://ths-portal.onrender.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"identifier":"admin","password":"YOUR_ADMIN_PASSWORD"}' \
    | jq -r .token > /tmp/prod_token.txt
  ```
- [ ] **Test promotion endpoints**
  ```bash
  TOKEN=$(cat /tmp/prod_token.txt)
  curl -s https://ths-portal.onrender.com/api/admin/promotions/history -H "Authorization: Bearer $TOKEN" | jq
  curl -s https://ths-portal.onrender.com/api/admin/promotions/mappings -H "Authorization: Bearer $TOKEN" | jq length
  ```
- [ ] **Test promotion wizard in browser**
  - [ ] Navigate to: `https://ths-portal.onrender.com/portal/admin/students/promotion`
  - [ ] Verify wizard opens with 5 steps
  - [ ] Verify sessions dropdown populated
  - [ ] Verify History tab shows empty state (no batches yet)
- [ ] **Test Academic Sessions page**
  - [ ] Navigate to: `https://ths-portal.onrender.com/portal/admin/academics/terms`
  - [ ] Archive a test session → verify badge updates instantly (no refresh)
  - [ ] Unarchive → verify badge updates instantly
  - [ ] Verify toast notifications appear immediately
- [ ] **Test existing functionality** (regression)
  - [ ] `/api/students` returns student list
  - [ ] `/api/classes` returns class list
  - [ ] `/api/exams` returns exam list
  - [ ] Student login works
  - [ ] Report cards accessible

### Phase 5: First Production Promotion (Low-Traffic Hours Only)
**⚠️ Schedule this during off-peak hours (evening/weekend)**

- [ ] **Create destination session** (if not exists)
  - [ ] Go to Academic Terms page
  - [ ] Create new session (e.g., 2027/2028)
  - [ ] Set status to "upcoming"
- [ ] **Mark current session as completed**
  - [ ] Edit current session (e.g., 2026/2027)
  - [ ] Set status to "completed"
- [ ] **Run promotion wizard**
  - [ ] Select source (completed) and destination (upcoming) sessions
  - [ ] Review preview — verify student counts match expectations
  - [ ] Check class progression mappings
  - [ ] Execute promotion
  - [ ] **Monitor server logs in Render during execution**
- [ ] **Verify promotion results**
  - [ ] Check batch detail in History tab
  - [ ] Verify `promoted_count + repeating_count + graduated_count = total_students`
  - [ ] Verify `failed_count = 0` (if failures, review error messages)
  - [ ] Test promoted student login → verify new class appears
  - [ ] Check subject assignments created in database
  - [ ] Verify `student_enrollments` created for destination session
- [ ] **Activate destination session**
  - [ ] Use rollover-activate endpoint OR
  - [ ] Manually set session status to "active" + create 3 terms
  - [ ] Verify `isCurrent` flags set correctly
- [ ] **Post-promotion verification**
  - [ ] `/api/students` excludes graduated students from active list
  - [ ] Graduated students can still login (is_active=true)
  - [ ] Withdrawn students cannot login (is_active=false)

---

## 🔄 Rollback Procedure (If Issues Arise)

### Database Rollback
```bash
# Drop new tables
psql "postgresql://..." -c "DROP TABLE IF EXISTS promotion_records CASCADE;"
psql "postgresql://..." -c "DROP TABLE IF EXISTS promotion_batches CASCADE;"
psql "postgresql://..." -c "DROP TABLE IF EXISTS student_enrollments CASCADE;"

# Remove columns from classes
psql "postgresql://..." -c "ALTER TABLE classes DROP COLUMN IF EXISTS sequence_order, DROP COLUMN IF EXISTS next_class_id, DROP COLUMN IF EXISTS is_graduation_level;"

# Or restore from backup
psql "postgresql://..." < ths_backup_YYYYMMDD_HHMMSS.sql
```

### Code Rollback
```bash
# Revert to previous commit
git revert ec4188ed..e8098673
git push origin main

# Or use Render manual deploy to previous working version
```

---

## 📊 Post-Deployment Monitoring

### Week 1 (Daily Checks)
- [ ] Monitor Render logs for errors (pool errors, ETIMEDOUT, promotion failures)
- [ ] Verify no student login issues
- [ ] Check `/api/students` response times (<2s)
- [ ] Monitor database connection pool (idle/waiting counts)

### Week 2-4 (Every 3 days)
- [ ] Review promotion batches in History tab
- [ ] Check for orphaned enrollments (students with enrollments but no class_id)
- [ ] Verify graduated students list accurate
- [ ] Monitor disk space on Neon (enrollments table growth)

### Month 1 (Weekly)
- [ ] Review correction records (if any manual corrections needed)
- [ ] Analyze promotion success rate (failed_count / total_students)
- [ ] Gather admin feedback on wizard usability

---

## 🎯 Success Criteria

### Deployment Success
- ✅ All smoke tests pass
- ✅ Academic Sessions page updates instantly (no refresh needed)
- ✅ Promotion wizard accessible and functional
- ✅ No errors in Render logs
- ✅ All existing features working (regression tests pass)

### First Promotion Success
- ✅ Batch status = "completed"
- ✅ Failed count = 0 (or <5% of total with valid reasons)
- ✅ All students moved to correct classes
- ✅ Subject assignments created correctly
- ✅ Student logins working with new classes visible

---

## 🆘 Emergency Contacts

**If deployment fails:**
1. **Database issues**: Check Neon dashboard for connection limits, disk space
2. **Server crashes**: Review Render logs, check memory usage
3. **Promotion errors**: Review batch detail, check failed_count and error_messages
4. **Rollback decision**: If >10% of features broken, execute rollback immediately

**Support Resources:**
- PROMOTION_DEPLOYMENT_GUIDE.md (lines 351-488: troubleshooting section)
- Render deployment logs: https://dashboard.render.com
- Neon dashboard: https://console.neon.tech

---

## 📝 Deployment Log

**Deployment Date**: _______________  
**Deployed By**: _______________  
**Database Backup**: _______________  
**Render Deploy ID**: _______________  
**First Promotion Date**: _______________  
**Students Promoted**: _______________  
**Issues Encountered**: _______________  
**Resolution**: _______________  

---

**Status**: Ready for production deployment ✅  
**Estimated Deployment Time**: 60 minutes (migration + deploy + smoke tests)  
**Recommended Deployment Window**: Low-traffic hours (after 6 PM or weekend)
