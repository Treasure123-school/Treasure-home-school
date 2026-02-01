import { Router } from "express";
import { storage } from "../../storage";
import { authenticateUser, authorizeRoles, ROLES } from "../middleware";

const router = Router();

// ==================== TEACHER ROUTES ====================

router.get("/", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req, res) => {
  try {
    const allUsers = await storage.getAllUsers();
    const teachers = allUsers.filter((u: any) => u.roleId === ROLES.TEACHER);
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch teachers" });
  }
});

export default router;
