/**
 * Academic Calendar Routes
 *
 * Provides the unified current-state view of the academic calendar,
 * combining active session, current term, and upcoming terms.
 */

import { Router, Request, Response } from "express";
import { authenticateUser } from "./middleware";
import { sendSuccess, handleRouteError } from "../utils/response-helpers";
import { getCalendarCurrentState, runTermTransitions } from "../academic-calendar-service";
import { authorizeRoles, ROLES } from "./middleware";

const router = Router();

// GET /api/academic-calendar/current — unified calendar state
router.get("/current", authenticateUser, async (req: Request, res: Response) => {
  try {
    const state = await getCalendarCurrentState();
    sendSuccess(res, state);
  } catch (error) {
    handleRouteError(res, error, "calendar.current");
  }
});

// POST /api/academic-calendar/run-transitions — manually trigger transitions (admin only)
router.post("/run-transitions", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
  try {
    const result = await runTermTransitions();
    sendSuccess(res, result);
  } catch (error) {
    handleRouteError(res, error, "calendar.runTransitions");
  }
});

export default router;
