---
name: Student profile completion system
description: Canonical 7-field set, where the logic lives, and how the pieces must stay in sync.
---

## The canonical 7-field set

phone, address, dateOfBirth, gender, emergencyContact, medicalInfo, profileImageUrl

`recoveryEmail` is explicitly excluded — it is a security feature, not a profile completeness field.

**Why:** Including `recoveryEmail` (which has no UI input in StudentProfile.tsx) hard-caps completion at 7/8 = 88% even when all visible fields are filled.

## Where the set must be kept in sync

All four locations must use the same 7 fields:
1. `client/src/hooks/useProfileCompletion.ts` — client-side hook (drives RequireCompleteProfile gate)
2. `server/routes.ts` `/api/student/profile/status` — always recalculate fresh, persist result, return live value
3. `server/routes.ts` `PATCH /api/students/:id` — recalculate + persist after every profile save
4. `server/routes.ts` `/api/student/profile/setup` — calculate (not hardcode 100%) and return `completionPercentage` + `profileCompleted`

`client/src/lib/profileCompletion.ts` (`computeProfileCompletion`) uses a different 4-field set intentionally — it is for admin-facing badges in StudentManagement/ParentManagement/TeachersManagement only. Do not align it with the student-facing set.

## updateStudent return shape

`storage.updateStudent()` returns `{ user: User, student: Student }`. Access as:
- `result.user.phone`, `result.user.address`, `result.user.dateOfBirth`, `result.user.gender`, `result.user.profileImageUrl`
- `result.student.emergencyContact`, `result.student.medicalInfo`

## Cache invalidation

After any profile save or image remove, always invalidate:
- `['/api/student/profile/status']`
- `['/api/auth/me']`
- `['student', user.id]`

Applies in: StudentProfile.tsx `handleSave`, `handleRemoveImage`; ProfileOnboarding.tsx `onSuccess`.

## Production repair endpoint

`POST /api/admin/repair-profile-completion` (admin/super-admin only) — bulk-recalculates all students and persists corrected values. Run once after deploying the profile completion fixes.

## Stale-stored value anti-pattern

The `/api/student/profile/status` endpoint was returning the DB-stored `profileCompletionPercentage` with `||` fallback to a live calculation. The stored value was never being updated, so it always returned stale results. Fix: always recalculate live from the 7 fields, persist immediately, return the live value.
