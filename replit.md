# Treasure-Home School Management System

## Overview
Treasure-Home is a comprehensive school management system designed to streamline administrative and academic processes for educational institutions. It features robust JWT authentication, a PostgreSQL database, and cloud-based file storage. The system supports five distinct role-based access levels (Super Admin, Admin, Teacher, Student, Parent) and offers a wide array of features including an exam system with auto-grading, real-time updates, attendance management, report card generation, and various communication tools. The project's vision is to provide an efficient, scalable, and secure platform.

## User Preferences
- Username (admission ID format: THS-STU-###, THS-TCH-###) should be displayed prominently as the canonical student identifier
- Grading weights (40% Test, 60% Exam) should be visible in report card interfaces

## System Architecture

### UI/UX Decisions
The frontend is built with React 18, Vite, shadcn/ui (Radix UI + Tailwind CSS) for a modern design. Wouter is used for routing, TanStack Query for data fetching, and React Hook Form with Zod for form management and validation. The system incorporates a "Bailey's Style Traditional Report Card Export" for print-ready formats while maintaining a modern UI for screen viewing, optimized for A4 paper with Treasure-Home School branding and dynamic school header information. Report card comments are role-based and editable, with auto-generated options and admin-managed templates.

### Technical Implementations
The backend is an Express.js application built with Node.js and TypeScript, leveraging Drizzle ORM for database interactions. A modular routing system is implemented under `server/routes/modules/` to ensure maintainability and high code quality.
- **Modular Routes**: Domain-specific logic is split into `auth.ts`, `admin.ts`, `academic.ts`, `exams.ts`, `students.ts`, `teachers.ts`, and `reports.ts`.
- **DRY Principles**: Shared middleware and centralized storage interfaces prevent code duplication.
- **Type Safety**: Fully synchronized TypeScript build process ensures production stability.

### System Design Choices
- **Stateless Backend**: Achieved by offloading database to Neon PostgreSQL and file storage to Cloudinary.
- **Drizzle ORM**: Used for type-safe database interactions.
- **Zod**: Utilized for schema validation.
- **Centralized Configuration**: For roles and grading scales.
- **Monorepo Structure**: Organized into `server/`, `client/`, and `shared/` directories.

## External Dependencies
- **Database**: Neon (PostgreSQL)
- **Cloud Storage**: Cloudinary CDN
- **Deployment**: Render (Backend), Vercel (Frontend)
- **Real-time Communication**: Socket.IO