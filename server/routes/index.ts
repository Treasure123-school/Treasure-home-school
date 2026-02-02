/**
 * Routes Module Structure
 * 
 * This folder contains modular route files organized by domain.
 * Each route module is responsible for a specific feature area.
 * 
 * Current Modules:
 * - middleware.ts: Shared authentication & authorization
 * - auth.routes.ts: Login, logout, password management
 * - health.routes.ts: Health checks, performance monitoring
 * - terms.routes.ts: Academic terms/semesters CRUD
 * - classes.routes.ts: School classes CRUD
 * - subjects.routes.ts: School subjects CRUD
 * - notifications.routes.ts: User notifications
 * 
 * Remaining in legacy routes.ts (to be extracted):
 * - admin routes (26 endpoints)
 * - reports routes (23 endpoints)
 * - teacher routes (12 endpoints)
 * - student routes (12 endpoints)
 * - exam routes (9 endpoints)
 */

export * from './middleware';
export { default as authRoutes } from './auth.routes';
export { default as healthRoutes } from './health.routes';
export { default as termsRoutes } from './terms.routes';
export { default as classesRoutes } from './classes.routes';
export { default as subjectsRoutes } from './subjects.routes';
export { default as notificationsRoutes } from './notifications.routes';
