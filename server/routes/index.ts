/**
 * Routes Module Structure
 * 
 * This folder contains modular route files organized by domain.
 * Each route module is responsible for a specific feature area.
 * 
 * Current Modules:
 * - middleware.ts: Shared authentication & authorization
 * - ../modules/auth: Login, password management (login/change/forgot/reset)
 * - ../modules/homepage: Homepage content, sections, announcements
 * - health.routes.ts: Health checks, performance monitoring
 * - ../modules/academic-calendar: terms, sessions, calendar
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
export { authRouter } from '../modules/auth';
export { homepageRouter } from '../modules/homepage';
export { default as healthRoutes } from './health.routes';
export { termsRoutes, sessionsRoutes, calendarRoutes } from '../modules/academic-calendar';
export { default as classesRoutes } from './classes.routes';
export { default as subjectsRoutes } from './subjects.routes';
export { default as notificationsRoutes } from './notifications.routes';
export { default as lessonNotesRoutes } from './lesson-notes.routes';
export { default as jobVacancyRoutes } from './job-vacancy.routes';
export { default as settingsRoutes } from './settings.routes';
export { default as reportCardSkillsRoutes } from './report-card-skills.routes';
export { default as questionBankRoutes } from './question-bank.routes';
export { default as uploadRoutes } from './upload.routes';
export { default as messagesRoutes } from './messages.routes';
export { default as aiConfigRoutes } from './ai-config.routes';
export { default as attendanceRoutes } from './attendance.routes';
export { default as gradingRoutes } from './grading.routes';
