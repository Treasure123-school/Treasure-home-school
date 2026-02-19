# Treasure-Home School Management System

## Overview
Treasure-Home is a comprehensive school management system designed to streamline administrative and academic processes for educational institutions. It features robust JWT authentication, a PostgreSQL database, and cloud-based file storage. The system supports five distinct role-based access levels (Super Admin, Admin, Teacher, Student, Parent) and offers a wide array of features including an exam system with auto-grading, real-time updates, attendance management, report card generation, and various communication tools. The project's vision is to provide an efficient, scalable, and secure platform.

## Recent Changes
- **Feb 19, 2026**: Migrated project to Replit environment. Created PostgreSQL database, pushed schema via drizzle-kit, fixed syntax error in StudentExams.tsx (removed orphaned duplicate code block). Application starts successfully on port 5000.

## User Preferences
- Username (admission ID format: THS-STU-###, THS-TCH-###) should be displayed prominently as the canonical student identifier
- Grading weights (40% Test, 60% Exam) should be visible in report card interfaces

## System Architecture

### UI/UX Decisions
The frontend is built with React 18, Vite, shadcn/ui (Radix UI + Tailwind CSS) for a modern design. Wouter is used for routing, TanStack Query for data fetching, and React Hook Form with Zod for form management and validation. The system incorporates a "Bailey's Style Traditional Report Card Export" for print-ready formats while maintaining a modern UI for screen viewing, optimized for A4 paper with Treasure-Home School branding and dynamic school header information. Report card comments are role-based and editable, with auto-generated options and admin-managed templates.

### Technical Implementations
The backend is an Express.js application built with Node.js and TypeScript, leveraging Drizzle ORM for database interactions. PostgreSQL (via Neon/Replit) is used for the database. Cloudinary is integrated for cloud-based file storage in production, with a local filesystem fallback for development. JWT authentication is used, and real-time functionalities are powered by Socket.IO with comprehensive event coverage. The architecture supports five role-based access levels with granular permissions. The system includes:
- **Authentication**: JWT tokens, bcrypt hashing, CORS, rate limiting, account lockout, 2FA support, and RBAC.
- **Role-Based Access Control**: Five distinct roles (Super Admin, Admin, Teacher, Student, Parent) with hierarchical user creation rules.
- **Database Schema**: Over 40 tables covering academic and administrative functions.
- **Exam System**: Reliable submission, instant auto-scoring for MCQs, anti-cheat measures, auto-submission, real-time progress saving, teacher-centric exam creation, and exam retake functionality.
- **Report Card System**: Comprehensive auto-generation and score management with weighted scoring, role-based approval workflow, and professional, print-ready components. Includes features for admin comment template management and signature management for principals and teachers.
- **Unified Subject Assignment System**: Centralized subject visibility and assignment configuration for JSS classes and SSS departments with bulk assignment and automatic student subject synchronization.
- **Enhanced Announcement System**: Professional announcement creation with rich content, target audience selection, priority levels, publishing options, expiry dates, attachments, and notification settings.
- **User Recovery System (Recycle Bin)**: Soft-deletes users with a configurable retention period, audit logging, and role-based permission enforcement.
- **School Information Management**: Comprehensive school settings in Super Admin portal for managing school name, address, motto, contact details, logos, and website customization.
- **Modular Backend Routes**: Ongoing refactoring into domain-specific route files and utility modules to improve maintainability and reduce boilerplate.

### System Design Choices
- **Stateless Backend**: Achieved by offloading database to PostgreSQL and file storage to Cloudinary.
- **Drizzle ORM**: Used for type-safe database interactions.
- **Zod**: Utilized for schema validation.
- **Centralized Configuration**: For roles and grading scales.
- **Monorepo Structure**: Organized into `server/`, `client/`, and `shared/` directories.

## Running the Project
- Workflow "Start application" runs `npm run dev` which starts Express backend + Vite frontend on port 5000.
- Database schema is managed via `drizzle-kit push`.

## External Dependencies
- **Database**: PostgreSQL (Replit built-in)
- **Cloud Storage**: Cloudinary CDN (production)
- **Real-time Communication**: Socket.IO