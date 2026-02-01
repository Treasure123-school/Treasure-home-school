import { Router } from "express";
import { storage } from "../../storage";
import { authenticateUser, authorizeRoles, ROLES } from "../middleware";

const router = Router();

// ==================== ACADEMIC SETTINGS ROUTES ====================

router.get("/classes", authenticateUser, async (req, res) => {
  try {
    const classes = await storage.getClasses();
    res.json(classes);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch classes" });
  }
});

router.get("/subjects", authenticateUser, async (req, res) => {
  try {
    const subjects = await storage.getSubjects();
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch subjects" });
  }
});

router.get("/terms", authenticateUser, async (req, res) => {
  try {
    const terms = await storage.getAcademicTerms();
    res.json(terms);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch academic terms" });
  }
});

export default router;
