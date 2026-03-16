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

## Replit Configuration

- **Workflow**: "Start application" runs `npm run dev` on port 5000 (webview)
- `NODE_ENV=development` is set in the dev script to ensure correct CORS and Vite dev middleware
- CORS allows all `*.replit.dev` origins in development automatically

## Database

- Schema managed via `drizzle-kit push` (not migrations)
- Seeds run on startup: academic terms, system settings, roles, test users
- Test accounts created for all 5 roles (superadmin, admin, teacher, student, parent)
