/**
 * Academic Calendar Routes
 *
 * Provides the unified current-state view of the academic calendar,
 * combining active session, current term, and upcoming terms.
 */

import { Router, Request, Response } from "express";
import { authenticateUser } from "./middleware";
import { sendSuccess, handleRouteError } from "../utils/response-helpers";
import { getCalendarCurrentState, checkAndTransition } from "../academic-calendar-service";
import { authorizeRoles, ROLES } from "./middleware";
import { getPgPool } from "../db";

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
    const result = await checkAndTransition();
    sendSuccess(res, result);
  } catch (error) {
    handleRouteError(res, error, "calendar.runTransitions");
  }
});

// GET /api/academic-calendar/settings — get calendar-specific settings (admin only)
router.get("/settings", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
  try {
    const pool = getPgPool();
    const { rows } = await pool.query(
      "SELECT academic_auto_detect FROM system_settings ORDER BY id LIMIT 1"
    );
    const autoDetect = rows.length > 0 ? rows[0].academic_auto_detect : true;
    sendSuccess(res, { academicAutoDetect: autoDetect });
  } catch (error) {
    // Column may not exist yet — return default
    sendSuccess(res, { academicAutoDetect: true });
  }
});

// PUT /api/academic-calendar/settings — update calendar-specific settings (admin only)
router.put("/settings", authenticateUser, authorizeRoles(ROLES.ADMIN), async (req: any, res: Response) => {
  try {
    const { academicAutoDetect } = req.body;
    if (typeof academicAutoDetect !== "boolean") {
      res.status(400).json({ message: "academicAutoDetect must be a boolean" });
      return;
    }
    const pool = getPgPool();
    await pool.query(
      "UPDATE system_settings SET academic_auto_detect = $1 WHERE id = (SELECT id FROM system_settings ORDER BY id LIMIT 1)",
      [academicAutoDetect]
    );
    sendSuccess(res, { academicAutoDetect });
  } catch (error) {
    handleRouteError(res, error, "calendar.updateSettings");
  }
});

export default router;
