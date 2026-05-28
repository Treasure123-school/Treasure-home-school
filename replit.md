# Project Overview

A school management web application (Vite + React frontend, Express backend, PostgreSQL via Neon).

## Architecture

- **Frontend**: React + Vite (client/), served via Express in dev (Vite middleware) and as static files in production
- **Backend**: Express (server/index.ts), TypeScript, runs on port 5000
- **Database**: PostgreSQL (Neon serverless) via Drizzle ORM
- **Auth**: Passport.js + express-session with JWT support
- **Realtime**: Socket.IO
- **Storage**: Local filesystem in dev (server/uploads/), Cloudinary in production

## Key Files

- `server/index.ts` — Express app entry point, sets up middleware, routes, Vite dev server
- `server/routes.ts` — All API route registrations
- `server/storage.ts` — Database access layer
- `server/db.ts` — Database connection (pg/postgres + Drizzle)
- `client/src/` — React frontend source
- `shared/` — Shared types/schemas between client and server
- `vite.config.ts` — Vite config (root: client/, outDir: dist/public/)
- `drizzle.config.ts` — Drizzle ORM config
- `.env` — Environment variables (do not modify structure)

## Running the Project

```bash
npm run dev      # Development server on port 5000
npm run build    # Build for production
npm run start    # Run production build
npm run db:push  # Push schema changes to database
```

## Environment Variables (.env)

- `DATABASE_URL` — Neon PostgreSQL connection string
- `JWT_SECRET` — JWT signing secret
- `SESSION_SECRET` — Express session secret
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — Cloudinary (used in production)
- `PAYSTACK_SECRET_KEY` — Paystack secret key (server-side only, for payment init & verification)
- `PAYSTACK_PUBLIC_KEY` — Paystack public key (returned to client for Paystack popup)
- `RESEND_API_KEY` — Resend API key for sending email notifications (optional; emails skipped if absent)
- `EMAIL_FROM` — Email sender address e.g. `THS Portal <noreply@yourdomain.com>` (optional, defaults to resend.dev)
- `TWILIO_ACCOUNT_SID` — Twilio Account SID for SMS notifications (optional)
- `TWILIO_AUTH_TOKEN` — Twilio Auth Token (optional)
- `TWILIO_PHONE_NUMBER` — Twilio sender phone number, e.g. `+1234567890` (optional)

## Online Exam Payment System

Implemented a secure end-to-end online exam fee payment flow using Paystack:

### Flow
1. **Initiate** (`POST /api/exam-payments/initiate` — student only): Backend creates a `pending` payment record with a unique server-generated reference tied to the authenticated student + current term. Calls Paystack API to initialize the transaction. Returns access_code, reference, and public key to the client.
2. **Checkout**: Frontend loads Paystack inline JS popup from CDN. Student pays via card/bank transfer. No payment data touches our server.
3. **Verify** (`POST /api/exam-payments/verify` — student only): After Paystack popup success, frontend sends the reference back. Backend verifies server-to-server with Paystack API (`GET /transaction/verify/:ref`). If confirmed, marks payment as `paid` and sets `paidAt` timestamp.
4. **Webhook** (`POST /api/exam-payments/webhook` — public): Paystack sends a `charge.success` event signed with HMAC-SHA512. Backend verifies the signature and marks payment as `paid` as a secondary confirmation layer.

### Security Properties
- Reference is generated server-side; student cannot influence it
- Student identity comes from the authenticated session (not user input)
- Duplicate payments blocked by unique index on `(studentId, termId)` — paid records cannot be overwritten
- Webhook HMAC verification prevents spoofing
- Secret key never leaves the server

### Key Files
- `server/routes/exam-payment.routes.ts` — initiate, verify, webhook, admin CRUD
- `client/src/pages/portal/ExamFeePayment.tsx` — student payment page with Paystack popup
- `client/src/pages/portal/StudentExams.tsx` — locked exam card with "Pay Now" button
- `client/src/pages/portal/SuperAdminIntegrations.tsx` — setup guide for Paystack keys

## Payment Notifications (Email + SMS)

After any successful exam fee payment, the system sends a confirmation email and/or SMS to the student containing their Paystack reference as proof. This covers all payment paths:

- **Webhook** (`charge.success` event from Paystack)
- **Verify** (student callback after Paystack popup)
- **Verify-by-ref** (restore modal — student provides their reference manually)
- **Recover** (auto-recovery on page load if payment completed but redirect failed)

### Email
- Uses Resend (`RESEND_API_KEY` env var). If not configured, emails are skipped with a log warning.
- Sender configured via `EMAIL_FROM` env var (default: `THS Portal <noreply@resend.dev>`)
- Template in `server/email-service.ts` → `getPaymentConfirmationEmailHTML()`

### SMS
- Uses Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` env vars)
- If any Twilio env var is missing, SMS is silently skipped
- Nigerian phone numbers (07xx, 08xx, 09xx) are auto-normalized to +234 format
- Template in `server/sms-service.ts` → `getPaymentConfirmationSms()`

### Notification Service
- `server/payment-notifications.ts` — `sendPaymentConfirmationNotifications()` centralizes both email + SMS
- Reads `enableEmailNotifications` and `enableSmsNotifications` from system settings
- Fire-and-forget (never blocks or crashes the payment confirmation response)

### DB Insert Failure Fix
- `createExamPayment()` now gracefully handles unique constraint violations (error code 23505)
- If a record already exists for the same student+term, it updates the existing record instead of failing
- This prevents the "Failed query: insert into exam_payments" error in the restore modal

### Cross-Student Reference Theft Prevention (Security Fix)
- **Vulnerability**: A student could enter another student's Paystack reference in the restore modal and get exam access, especially if the payment record didn't exist in the local DB (e.g. from a previous server environment).
- **Root cause**: The old DB-only collision check (`getExamPaymentByReference`) only worked if the reference was already stored in the current DB. If not, the check was bypassed entirely.
- **Fix**: Two-layer ownership verification in `verify-by-ref`:
  1. **Primary (metadata-based)**: After Paystack verifies the transaction, extract `metadata.studentId` and `metadata.termId` from Paystack's response. These are embedded by our server at initiation time and stored by Paystack — they cannot be forged. If `metaStudentId ≠ logged-in student`, return HTTP 403.
  2. **Secondary (DB-based)**: Belt-and-suspenders — if a DB record exists for that reference belonging to a different student, return HTTP 403.
- Security violations are logged with `[PAYMENT SECURITY]` prefix for admin visibility.

## Replit Configuration

- **Workflow**: "Start application" runs `npm run dev` on port 5000 (webview)
- `NODE_ENV=development` is set in the dev script to ensure correct CORS and Vite dev middleware
- CORS allows all `*.replit.dev` origins in development automatically

## Report Card: Exam Subject Change Sync Fix

- **Problem**: When a teacher changed an exam's subject (e.g. "Language" → "English Language"), student scores disappeared from the report card entirely.
- **Root Cause 1**: `syncReportCardItemsOnExamSubjectChange` used `updatedAt: new Date()` in all `.set()` calls, but `reportCardItems` has no `updatedAt` column — causing Drizzle ORM to fail silently on each item.
- **Root Cause 2**: The MERGE case conditioned the score copy on `!existingNewItem.examExamId`. If the target item already had a score, the moved score was never copied, but the source item was still cleared — complete score loss.
- **Fix** (`server/storage.ts`, `syncReportCardItemsOnExamSubjectChange`):
  - Removed all `updatedAt: new Date()` from `.set()` calls on `reportCardItems`.
  - Changed merge to always force-overwrite the target item with the moved exam's score, regardless of existing values.
  - Fixed the `Object.keys > 1` check to `> 0` (was off-by-one due to the removed `updatedAt` key).

## Student Block/Unblock

- **Route**: `PATCH /api/students/:id/block` (Admin/Super Admin only)
- **Body**: `{ isActive: boolean }` — `false` to block, `true` to unblock
- **Effect**: Updates both `users.isActive` (UI display) and `users.status` ('suspended'/'active'), ensuring blocked students cannot log in
- **Frontend**: Already wired with `blockStudentMutation` + `handleBlockToggle` in `StudentManagement.tsx`; block/unblock buttons rendered in both mobile and desktop table views

## Report Card: Duplicate Subject Fix (SSS Classes)

- **Problem**: SSS class report cards showed duplicate subject entries (e.g., "English Language" appearing twice).
- **Root Cause**: Race condition in `addMissingSubjectsToReportCards` — concurrent calls could both pass the "subject missing" check and both insert the same subject within milliseconds.
- **Fix**:
  - Added `UNIQUE INDEX` on `report_card_items(report_card_id, subject_id)` at the database level — prevents duplicates absolutely.
  - Added `.onConflictDoNothing()` to all 5 `reportCardItems` INSERT statements so concurrent calls silently skip duplicates instead of crashing.
  - Added deduplication safety net in `getReportCardWithItems` so the UI never shows duplicate subjects even if any slip past.
  - Cleaned 21 pre-existing duplicate rows from the database (kept lowest-id item per reportCardId+subjectId).

## Student Assignments Page

- **Route**: `/portal/student/assignments` (accessible via "Assignments" in the student sidebar under Academic)
- **Page**: `client/src/pages/portal/StudentAssignments.tsx`
- **DB Tables**: `assignments`, `assignment_submissions` (new — added to `shared/schema.pg.ts`, pushed via `db:push`)
- **APIs**:
  - `GET /api/student/assignments` — list all class assignments with submission status (joined)
  - `GET /api/student/assignments/:id` — full assignment detail with submission
  - `POST /api/student/assignments/:id/submit` — multipart form submit (text + file, upserts submission)
- **Features**:
  - Filter tabs: All, Pending, Submitted, Late — with counts per filter
  - Assignment cards: subject, teacher, due date, status badge (Pending/Submitted/Late/Graded), urgency alert (due within 24 h)
  - Detail dialog with two tabs: Details (instructions, attachments, score, feedback) and Submit/My Submission
  - File upload: PDF, DOC, DOCX, image — max 10 MB via the existing upload service
  - Text answer field with optional file attachment
  - Edit before deadline, locked after grading
  - Displays teacher feedback and score after grading
  - Empty states per filter

## Student Class Schedule Page

- **Route**: `/portal/student/timetable` (accessible via "Class Schedule" in the student sidebar under Academic)
- **Page**: `client/src/pages/portal/StudentClassSchedule.tsx`
- **API**: `GET /api/student/timetable` (student-only, returns timetable entries joined with subject and teacher names)
- **Features**:
  - Live header with student class name, current date, and a ticking clock
  - Countdown banner showing time until next class
  - Today View: lists all classes for the current weekday with automatic status detection (Ongoing / Upcoming / Completed)
  - Ongoing class highlighted with a pulsing LIVE badge and a "Join Class" button
  - Weekly View: Monday–Friday day tabs, each showing that day's schedule
  - Class detail dialog: shows subject, teacher, time, day, location, topic (placeholder), and meeting link (placeholder)
  - Empty state when no classes are scheduled
  - Fully mobile-responsive with card-based layout and color-coded subjects

## Student Library Page

- **Route**: `/portal/student/library` (accessible via "Library" in the student sidebar)
- **Page**: `client/src/pages/portal/StudentLibrary.tsx`
- **API**: Uses existing `/api/study-resources` + `/api/subjects`
- **Features**:
  - Gradient header with total resource count
  - Search bar + subject filter + type filter with "Clear" button
  - Resource grid (1–3 columns responsive) with styled cards per type (PDF, video, audio, image, past paper, study guide, notes)
  - Each card: gradient icon header, title, subject badge, description, upload date, view/download action
  - Recently Viewed section (stored in localStorage, shows last 5 viewed resources as mini-cards)
  - Resource Viewer Dialog: PDF iframe preview, video/audio/image native players, download + external link buttons
  - Related Resources section inside viewer (same subject, up to 4 results)
  - Resource metadata panel (upload date, downloads, file size)
  - Empty state with filter-aware messaging and "Clear Filters" button
  - Skeleton loading state (6-card grid)

## Student Help & Support Page

- **Route**: `/portal/student/help` (accessible via "Help & Support" in the student sidebar)
- **Page**: `client/src/pages/portal/StudentHelp.tsx`
- **API**: Uses `/api/public/settings` for school contact info; `POST /api/contact` for support form (contactSchema extended with optional `subject` field)
- **Features**:
  - Gradient header
  - Quick Help Guides section: 6 colour-coded guide cards (join class, unlock exam, download materials, etc.)
  - FAQ accordion grouped by category (Exams, Assignments, Payments, Login & Account) — expand/collapse per question
  - Contact options panel: Email, Phone, WhatsApp — dynamically pulled from school settings
  - Contact support form: name (pre-filled from auth), email, subject, message — submits to `/api/contact`
  - Success state after submission with option to send another message
  - Mobile-responsive 2-column layout (contact info + form side-by-side on desktop)

## Git Identity

- Global git config: `user.name=Treasure123-school`, `user.email=treasurehomeschool@gmail.com`
- Must match the Vercel team member email to allow deployments

## Attendance Management (Admin)

- **Route**: `/portal/admin/attendance`
- **Page**: `client/src/pages/portal/AttendanceManagement.tsx`
- **APIs added**:
  - `GET /api/attendance/overview?date=YYYY-MM-DD` — School-wide stats: total students, present, absent, late, excused, percentage, per-class breakdown with teacher accountability (Admin/SuperAdmin)
  - `GET /api/attendance/trends?view=daily|weekly|monthly&classId=` — Aggregated trend data with period labels (Admin/SuperAdmin/Teacher)
- **Features**:
  - 4 stat cards: Total Students, Present, Absent, Attendance Rate
  - 4 tabs: Summary (class table), Details (student-level), Trends (Recharts bar chart), Alerts (low-attendance + unrecorded classes)
  - Class summary table with color-coded attendance bars, teacher accountability (who recorded, when)
  - Per-student detail view: select class + date → student list with status badges, edit/override modal
  - Trend chart: daily/weekly/monthly toggle with per-class or school-wide filter, color-coded bars, period breakdown table
  - Alerts tab: classes below 80%, classes with no attendance recorded for the day
  - CSV export for both summary and detail views
  - Date picker applies across all tabs
  - Mobile-responsive layout

## Teacher Portal: Messages & Announcements

- **Messages page**: `/portal/teacher/messages` — `client/src/pages/portal/TeacherMessages.tsx`
  - Chat-style UI: conversation sidebar + chat window with bubbles
  - New message dialog with student recipient selector
  - Real-time read status (✓ sent, ✓✓ read), 15-second polling
  - Mobile: tap conversation → full-screen chat, back arrow to return
- **Announcements page**: `/portal/teacher/announcements` — `client/src/pages/portal/TeacherAnnouncements.tsx`
  - Create/edit/delete announcements (uses `/api/admin/announcements` + `POST/PUT/DELETE /api/announcements/:id`)
  - Priority (Normal/Important/Urgent), Type, Target audience (role + class toggles)
  - Pin/unpin locally, expand/collapse content, search, filters
  - PUT/DELETE announcement routes now allow TEACHER role (not just Admin)
- **Navigation**: Teacher sidebar "Announcements" now uses Megaphone icon; Admin sidebar "Attendance" now links to the real page

## Parent Management (Admin)

- **Route**: `/portal/admin/parents`
- **Page**: `client/src/pages/portal/ParentManagement.tsx`
- **Nav**: Admin sidebar "Parent Linking" now links to the real page (was coming-soon)
- **APIs added**:
  - `GET /api/parents` — List all parent users enriched with linked students + class info (Admin/SuperAdmin)
  - `POST /api/parents` — Create parent user; auto-generates username (THS-PAR-###) + temp password; links selected students; returns credentials (Admin/SuperAdmin)
  - `PUT /api/parents/:id` — Update parent name/email/phone (Admin/SuperAdmin)
  - `POST /api/parents/:id/link-students` — Link additional students to an existing parent (Admin/SuperAdmin)
  - `DELETE /api/parents/:id/unlink/:studentId` — Unlink a student from a parent (Admin/SuperAdmin)
  - `GET /api/students/search?q=` — Autocomplete student search by name/username/admission number (Admin/SuperAdmin/Teacher)
- **Features**:
  - Card grid layout with parent avatar (initials), name, username, contact info, linked students preview
  - Search bar (name/phone/email/username) + class filter dropdown
  - Add Parent dialog: name, phone, email + smart student autocomplete (type-to-search, chip selection)
  - Credentials display modal after creation (username + temp password with copy buttons)
  - Parent detail dialog: full info, all linked students list with per-student unlink button
  - Edit parent dialog: update name/email/phone
  - Link more students dialog: search and add additional students to existing parent
  - Activate/Deactivate toggle (uses suspend/unsuspend endpoints)
  - Delete with confirmation dialog
  - Empty state with prompt to add first parent

## Parent Portal

Fully functional parent-facing portal at `/portal/parent`.

### Pages
- **Dashboard** (`/portal/parent`) — `ParentDashboard.tsx` — Real-time overview: children stats, attendance summary, recent grades, school announcements. All data from live APIs (no mock data).
- **My Children** (`/portal/parent/children`) — `ParentChildren.tsx` — Per-child profile cards with attendance stats and avg score, quick-links to grades/attendance/reports.
- **Report Cards** (`/portal/parent/reports`) — `ParentReportCards.tsx` — Published report cards with subject breakdown table and PDF download. Real-time via Socket.IO.
- **Attendance** (`/portal/parent/attendance`) — `ParentAttendance.tsx` — Attendance records per child: summary (present/absent/late/excused), rate banner, full history list.
- **Grades** (`/portal/parent/grades`) — `ParentGrades.tsx` — All exam results per child with subject filter, avg score stat, score/percentage table, grade badges.
- **Profile** (`/portal/parent/profile`) — `ParentProfile.tsx` — Account info and linked children summary.
- **Calendar** / **Events** — shared pages.

### Backend APIs (parent-scoped)
All require authentication as a Parent (or Admin/SuperAdmin for admin access):
- `GET /api/parent/children` — Parent's linked children enriched with user info + class name
- `GET /api/parent/child-reports/:childId` — Published report cards for a specific child (with subject items + term info)
- `GET /api/parent/attendance/:childId` — Attendance records + summary (total/present/absent/late/excused/rate)
- `GET /api/parent/grades/:childId` — Exam results enriched with exam name, subject name, type, date, percentage
- `GET /api/parent/profile` — Parent's own user + profile data
- `PUT /api/parent/profile` — Update parent's own profile

### Sidebar Navigation
My Children · Report Cards · Attendance · Grades · School Calendar · Events · Messages · Profile

## Designated Principal

- `system_settings.designated_principal_id` — nullable FK to `users.id`; identifies which admin is the official school principal
- **Super Admin settings page** → "Designate School Principal" card: dropdown of all admin users, save with Confirm button, shows current designation with green badge
- **API**: `GET/PUT /api/superadmin/principal` (Super Admin only)
- **Resolution priority** (used everywhere report cards show principal info):
  1. Designated principal from system settings
  2. Admin who signed that specific report card
  3. First admin with a saved signature
  4. Any admin (no signature)
  - **Never** falls back to superadmin — principal is always an admin
- `resolveDesignatedPrincipal(db, storage, signedById?)` helper in `server/routes.ts` — single source of truth used by all three principal-resolution blocks
- `storage.ts` `getReportCardWithDetails` also updated to use the same priority order

## Database

- Schema managed via `drizzle-kit push` (not migrations)
- Seeds run on startup: academic terms, system settings, roles, test users
- Test accounts created for all 5 roles (superadmin, admin, teacher, student, parent)
