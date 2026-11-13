/**
 * Academic Calendar Module
 *
 * Owns everything about the school's academic calendar:
 * - Academic sessions (school years, e.g. "2024/2025")
 * - Academic terms (First/Second/Third Term within a session)
 * - Auto-transition logic (activating/completing terms by date)
 *
 * Public API (import from this barrel, not from inner files):
 * - Service:  getActiveTerm, getActiveSession, getUpcomingTerm,
 *             getCalendarCurrentState, checkAndTransition,
 *             checkAndTransitionIfEnabled, checkTermOverlap,
 *             checkSessionOverlap, detectCurrentFromDates
 * - Routers:  termsRoutes    → mounted at /api/terms
 *             sessionsRoutes → mounted at /api/sessions
 *             calendarRoutes → mounted at /api/academic-calendar
 */

export * from './academic-calendar.service';

export { default as termsRoutes } from './terms.routes';
export { default as sessionsRoutes } from './sessions.routes';
export { default as calendarRoutes } from './calendar.routes';
