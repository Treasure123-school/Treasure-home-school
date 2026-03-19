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

## Git Identity

- Global git config: `user.name=Treasure123-school`, `user.email=treasurehomeschool@gmail.com`
- Must match the Vercel team member email to allow deployments

## Database

- Schema managed via `drizzle-kit push` (not migrations)
- Seeds run on startup: academic terms, system settings, roles, test users
- Test accounts created for all 5 roles (superadmin, admin, teacher, student, parent)
