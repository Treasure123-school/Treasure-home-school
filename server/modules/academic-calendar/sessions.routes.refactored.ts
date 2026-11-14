/**
 * Academic Sessions Routes (Refactored)
 * 
 * Route definitions for session operations
 * Uses controller pattern for separation of concerns
 */

import { Router } from "express";
import { authenticateUser, authorizeRoles, ROLES } from "../../routes/middleware";
import * as sessionController from "./controllers/session.controller";

const router = Router();

// Public routes (authenticated users)
router.get("/", authenticateUser, sessionController.listSessions);
router.get("/active", authenticateUser, sessionController.getActiveSession);
router.get("/:id", authenticateUser, sessionController.getSessionById);

// Admin routes
router.post(
  "/",
  authenticateUser,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  sessionController.createSession
);

router.put(
  "/:id",
  authenticateUser,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  sessionController.updateSession
);

router.delete(
  "/:id",
  authenticateUser,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  sessionController.deleteSession
);

router.put(
  "/:id/deactivate",
  authenticateUser,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  sessionController.deactivateSession
);

router.put(
  "/:id/mark-current",
  authenticateUser,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  sessionController.markSessionAsCurrent
);

export default router;
