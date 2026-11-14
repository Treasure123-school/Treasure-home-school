/**
 * Academic Terms Routes (Refactored)
 * 
 * Route definitions for term operations
 * Uses controller pattern for separation of concerns
 */

import { Router } from "express";
import { authenticateUser, authorizeRoles, ROLES } from "../../routes/middleware";
import * as termController from "./controllers/term.controller";

const router = Router();

// Public routes (authenticated users)
router.get("/", authenticateUser, termController.listTerms);
router.get("/active", authenticateUser, termController.getActiveTerm);
router.get("/:id", authenticateUser, termController.getTermById);

// Admin routes
router.post(
  "/",
  authenticateUser,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  termController.createTerm
);

router.put(
  "/:id",
  authenticateUser,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  termController.updateTerm
);

router.put(
  "/:id/status",
  authenticateUser,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  termController.updateTermStatus
);

router.delete(
  "/:id",
  authenticateUser,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  termController.deleteTerm
);

router.put(
  "/:id/deactivate",
  authenticateUser,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  termController.deactivateTerm
);

router.put(
  "/:id/mark-current",
  authenticateUser,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  termController.markTermAsCurrent
);

export default router;
