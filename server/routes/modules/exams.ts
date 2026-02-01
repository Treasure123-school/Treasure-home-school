import { Router } from "express";
import { storage } from "../../storage";
import { authenticateUser, authorizeRoles, ROLES } from "../middleware";
import { z } from "zod";

const router = Router();

// ==================== EXAM ROUTES ====================

router.get("/", authenticateUser, async (req, res) => {
  try {
    const exams = await storage.getAllExams();
    res.json(exams);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch exams" });
  }
});

router.get("/:id", authenticateUser, async (req, res) => {
  try {
    const exam = await storage.getExamById(parseInt(req.params.id));
    if (!exam) return res.status(404).json({ message: "Exam not found" });
    res.json(exam);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch exam" });
  }
});

export default router;
