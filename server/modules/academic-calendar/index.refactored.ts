/**
 * Academic Calendar Module Index (Refactored)
 * 
 * Exports all controllers, services, validators, and routes
 */

// Controllers
export * as sessionController from './controllers/session.controller';
export * as termController from './controllers/term.controller';

// Services
export * as sessionService from './services/session.service';
export * as termService from './services/term.service';

// Validators
export * as sessionValidator from './validators/session.validator';
export * as termValidator from './validators/term.validator';

// Routes
export { default as sessionsRoutes } from './sessions.routes.refactored';
export { default as termsRoutes } from './terms.routes.refactored';
export { default as calendarRoutes } from './calendar.routes';
