# Treasure-Home School Management System

## Overview
Treasure-Home is a comprehensive school management system designed to streamline administrative and academic processes for educational institutions. It features robust JWT authentication, a PostgreSQL database, and cloud-based file storage. The system supports five distinct role-based access levels (Super Admin, Admin, Teacher, Student, Parent) and offers a wide array of features including an exam system with auto-grading, real-time updates, attendance management, report card generation, and various communication tools. The project's vision is to provide an efficient, scalable, and secure platform.

## User Preferences
- Username (admission ID format: THS-STU-###, THS-TCH-###) should be displayed prominently as the canonical student identifier
- Grading weights (40% Test, 60% Exam) should be visible in report card interfaces

## System Architecture

### UI/UX Decisions
The frontend is built with React 18, Vite, shadcn/ui (Radix UI + Tailwind CSS) for a modern design. Wouter is used for routing, TanStack Query for data fetching, and React Hook Form with Zod for form management and validation.

### Technical Implementations
The backend is an Express.js application built with Node.js and TypeScript, leveraging Drizzle ORM for database interactions. A dual-database strategy uses PostgreSQL (via Neon) for all environments. Cloudinary is integrated for cloud-based file storage in production, with a local filesystem fallback for development. JWT authentication is used, and real-time functionalities are powered by Socket.IO with comprehensive event coverage. The architecture supports five role-based access levels with granular permissions.

### Feature Specifications
- **Authentication**: JWT tokens, bcrypt hashing, CORS, rate limiting, account lockout, 2FA support, and RBAC.
- **Role-Based Access Control**: Five distinct roles (Super Admin, Admin, Teacher, Student, Parent) with hierarchical user creation rules.
- **Database Schema**: Over 40 tables covering academic and administrative functions.
- **Exam System**: Features reliable submission, instant auto-scoring for MCQs, anti-cheat measures, auto-submission, and real-time progress saving. Exam creation is teacher-centric with strong validation.
- **Report Card System**: Comprehensive auto-generation and score management with weighted scoring (40% test, 60% exam), teacher-specific editing permissions, auto-recalculation, max score handling, and status workflow (Draft → Finalized → Published). Includes a Role-Based Approval Workflow where teachers finalize and admins publish. Features a professional, print-ready component with detailed student info, subject performance, traits, attendance, class statistics, and editable remarks.
- **Bailey's Style Traditional Report Card Export**:
  - Traditional academic report card format specifically for PDF/print/image exports
  - Maintains modern UI for on-screen viewing while providing classic print format
  - A4 paper-optimized layout with Treasure-Home School branding
  - Features: school logo header, student photo section, bordered data tables, affective traits ratings, psychomotor skills assessment, attendance summary, and signature areas
  - Export options available on StudentReportCard, TeacherReportCards, and AdminResultPublishing pages
  - Uses html2canvas and jsPDF for high-quality rendering
  - Hidden template approach ensures exports use traditional format without affecting screen display
- **Visible School Header on Report Cards**:
  - Screen display now shows Nigeria-style school header with complete school details
  - School Name: TREASURE HOME SCHOOL
  - Address: Seriki-Soyinka, Ifo, Ogun State, Nigeria
  - Contact: Tel: 080-1734-5676 | Email: info@treasurehomeschool.com
  - Motto: "Honesty and Success"
  - Dynamic term name and academic session display
  - Consistent header across student, teacher, and admin report card views
- **Report Card Comments Access Control**: Role-based permission system for comments:
  - Class Teacher's Comment: Only the assigned class teacher (or admins) can edit
  - Principal's Comment: Only admins can edit
  - Auto-generated encouraging comments based on student performance (Excellent/Very Good/Good/Fair/Needs Improvement)
  - Comments use lastName instead of firstName as per school convention
- **Admin Comment Template Management**: 
  - Admin-only page at `/portal/admin/comment-templates` for managing default comment templates
  - Separate templates for teacher and principal comments
  - Templates organized by performance level (Excellent, Very Good, Good, Fair, Needs Improvement) with percentage ranges
  - Uses `{lastName}` placeholder for dynamic student name insertion
  - Active/inactive status toggle for templates
  - **Backfill Comments Feature**: Admin UI to apply default comments to existing report cards based on student performance, with options to preserve or overwrite existing comments
- **Signature Management**: 
  - Admin (Principal) profile includes digital signature setup for report card signing
  - Teacher profiles include digital signature setup for class teacher signing
  - SuperAdmin portal does not have principal signature (reserved for Admin role)
- **Refactored Code Structure**:
  - Centralized `PortalShell` component in `client/src/components/layout/PortalShells.tsx` to handle role-based routing using a common shell component, reducing code duplication by ~60% across student, teacher, admin, and parent portals.
  - Optimized `PortalLayout` navigation with a unified `handleNavigation` helper.
  - Cleaned up `shared/schema.ts` by removing duplicate `enableSmsNotifications` and `enableEmailNotifications` property definitions in `systemSettings`.
  - **Backend Route Modularization** (In Progress):
    - Created `server/routes/` folder with modular route files organized by domain
    - Route modules created:
      - `auth.routes.ts`: Login, logout, password change, auth/me (4 endpoints)
      - `health.routes.ts`: Health check and performance monitoring (3 endpoints)
      - `terms.routes.ts`: Academic terms CRUD (8 endpoints)
      - `classes.routes.ts`: School classes CRUD (4 endpoints)
      - `subjects.routes.ts`: School subjects CRUD (5 endpoints)
      - `notifications.routes.ts`: User notifications (4 endpoints)
      - `middleware.ts`: Shared auth & authorization middleware
    - Utility modules created:
      - `server/utils/comment-generators.ts`: Report card comment generation
      - `server/utils/cache-helpers.ts`: Centralized cache invalidation
      - `server/utils/exam-scoring.ts`: Theory answer scoring algorithm
      - `server/utils/response-helpers.ts`: HTTP response helpers with asyncHandler
    - Added `asyncHandler` utility to reduce try/catch boilerplate
    - Removed deprecated `getSqliteConnection()` function
    - Legacy `routes.ts` (13,400+ lines) to be progressively decomposed into domain modules
- **File Management**: Unified upload interface with Cloudinary CDN.
- **Enhanced Announcement System**: Professional announcement creation with comprehensive features:
  - Title and rich content body (supports paragraphs and bullet points)
  - Target audience selection: All users, Students, Teachers, Parents, Admin, or specific classes
  - Priority levels: Normal, Important (amber tag), Urgent (red tag - shows at top)
  - Announcement types: General, Academic, Examination, Event, Emergency
  - Publishing options: Publish immediately or schedule for later (date & time picker)
  - Expiry date for automatic visibility removal
  - Attachments support (PDF, Word, Excel, Images) and optional cover image
  - Notification settings: In-app notifications, Email, SMS (toggleable)
  - Advanced options: Allow comments, Allow edit after publishing
  - Preview mode before publishing
  - Action buttons: Cancel, Save as Draft, Publish/Schedule Announcement
  - View count tracking and analytics
  - Tabbed interface (Content, Audience, Schedule, Settings) for organized form filling
- **Unified Subject Assignment System**: Centralized subject visibility and assignment configuration, serving as the single source of truth for all subject-related operations. Supports JSS classes and SSS departments with bulk assignment capabilities.
- **Automatic Student Subject Sync**: Modifying subject assignments automatically synchronizes `student_subject_assignments` for affected students.
- **Quick Student Creation**: Optimized modal with essential fields.
- **Teacher-Class-Subject Assignment Module**: Manages teacher assignments with validation.
- **Exam Visibility System**: Centralized logic using `class_subject_mappings` as the single source of truth; students and parents only see exams for assigned subjects.
- **Exam Results Persistence**: Results persist once submitted and are only removed if the exam is deleted.
- **Strict Exam Result Matching**: Ensures accurate retrieval of specific exam results.
- **Exam Retake System**: Allows flagging students for retakes, archiving previous submissions.
- **Report Card Unpublish Feature**: Admins can unpublish single or bulk published report cards, reverting status to 'finalized'.
- **User Recovery System (Recycle Bin)**: Soft-delete users instead of permanent deletion, with configurable retention period (7-90 days). Features include:
  - Admins can view/restore/delete Teachers, Students, and Parents
  - Super Admins can view/restore/delete all users including Admins
  - Configurable retention period in Super Admin Settings
  - Automatic daily cleanup at 2:00 AM removes expired deleted users
  - Full audit logging of recovery actions
  - Role-based permission enforcement to prevent privilege escalation
- **School Information Management**: Comprehensive school settings in Super Admin portal:
  - School name, short name/abbreviation, address, and motto
  - Multiple phone numbers with country code support (20+ countries, Nigeria +234 default)
  - Multiple email addresses for different departments
  - School logo and favicon uploads with independent management
  - Website title and footer text customization
  - All fields are editable and persist across sessions
  - Phone numbers stored as JSON array with {countryCode, number} structure
  - Emails stored as JSON string array

### System Design Choices
- **Stateless Backend**: Achieved by offloading database to Neon PostgreSQL and file storage to Cloudinary.
- **Drizzle ORM**: Used for type-safe database interactions.
- **Zod**: Utilized for schema validation.
- **Centralized Configuration**: For roles and grading scales.
- **Monorepo Structure**: Organized into `server/`, `client/`, and `shared/` directories.

## External Dependencies
- **Database**: Neon (PostgreSQL) with connection pooling
- **Cloud Storage**: Cloudinary CDN
- **Deployment**: Render (Backend), Vercel (Frontend)
- **Real-time Communication**: Socket.IO with optimization layer
- **Caching**: In-memory (L1) + Redis-ready (L2)

## Recent Code Cleanup (January 2026)
Removed unused/duplicate backend files following DRY principles:
- `server/validate-env.ts` - Duplicate of env-validation.ts (unused)
- `server/seed-classes.ts` - Unused seeding file
- `server/seed-production.ts` - Unused production seeding file
- `server/backup-database.ts` - Unused backup utility

### Routes Modularization (In Progress)
Started modularizing the large routes.ts file (~13,500 lines):
- Created `server/routes/middleware.ts` - Shared authentication & authorization middleware
- Created `server/routes/index.ts` - Module documentation and exports
- Updated routes.ts to import from shared middleware (removed ~100 lines of duplicate code)
- Future work: Continue extracting route handlers into domain-specific modules

### Utility Modules (January 2026)
Created reusable utility modules following DRY principles:
- `server/utils/response-helpers.ts` - Standardized HTTP response functions (sendSuccess, sendBadRequest, sendNotFound, sendServerError, handleRouteError)
- `server/utils/auth-messages.ts` - Centralized authentication messages (suspension messages by role, rate limit messages, credential error messages)
- `server/utils/rate-limiter.ts` - Rate limiting class for login attempts with violation tracking and automatic cleanup
- `server/utils/index.ts` - Barrel export for all utilities

These utilities can be imported to replace repetitive patterns across routes:
- 256 occurrences of `res.status(500).json` can use `sendServerError()`
- 153 occurrences of `res.status(400).json` can use `sendBadRequest()`
- 119 occurrences of `res.status(404).json` can use `sendNotFound()`
- Duplicate suspension messages can use `getSuspensionMessage(roleName)`

### Code Consolidation (January 31, 2026)
Applied DRY principles to reduce code duplication:

**Centralized Role Constants:**
- Added `ROLE_CODES` and `ROLE_CODE_NAMES` to `shared/role-constants.ts`
- Updated `server/auth-utils.ts` to import from centralized constants (removed duplicate ROLE_CODES)
- Updated `server/username-generator.ts` to import ROLE_IDS from centralized constants (removed duplicate definitions)

**Removed Unused Code:**
- Removed unused `apiRateLimiter`, `loginRateLimiter`, and `heavyOperationLimiter` exports from `server/query-optimizer.ts` (dead code)

**Files Kept for Future Use:**
- `server/scalability-config.ts` - Redis/horizontal scaling configuration (not yet integrated but valuable for future)
- `server/load-test-harness.ts` - Standalone load testing tool