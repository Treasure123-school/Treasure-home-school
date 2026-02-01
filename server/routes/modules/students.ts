import { Router } from "express";
import { storage } from "../../storage";
import { authenticateUser, authorizeRoles, ROLES } from "../middleware";

const router = Router();

// ==================== STUDENT ROUTES ====================

router.get("/", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req, res) => {
  try {
    const students = await storage.getAllStudents();
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch students" });
  }
});

router.get("/:id", authenticateUser, async (req, res) => {
  try {
    const student = await storage.getUser(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch student" });
  }
});

export default router;
