/**
 * Routes Module Structure
 * 
 * This folder contains modular route files organized by domain.
 * 
 * Current Structure:
 * - middleware.ts: Shared authentication & authorization middleware
 * - auth.routes.ts: Login, logout, password management
 * - health.routes.ts: Health checks and performance monitoring
 * 
 * Domain categories in legacy routes.ts (to be progressively extracted):
 * - admin: 26 routes -> admin.routes.ts
 * - reports: 23 routes -> reports.routes.ts
 * - teacher: 12 routes -> teacher.routes.ts
 * - students: 12 routes -> students.routes.ts
 * - exams: 9 routes -> exams.routes.ts
 * - terms: 8 routes -> terms.routes.ts
 * - classes: 6 routes -> classes.routes.ts
 * - notifications: 4 routes -> notifications.routes.ts
 */

export * from './middleware';
export { default as authRoutes } from './auth.routes';
export { default as healthRoutes } from './health.routes';
