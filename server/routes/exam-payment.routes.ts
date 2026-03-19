import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { authenticateUser, authorizeRoles, ROLES } from "./middleware";
import { z } from "zod";

const router = Router();

// ─── GET /api/exam-payments/status ─────────────────────────────────────────
// Student: check their own payment status for the current term
router.get("/status", authenticateUser, authorizeRoles(ROLES.STUDENT), async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.id;

    // Get system settings to check if payment is required and the fee amount
    const settings = await storage.getSystemSettings();
    const requirePayment = settings?.requireExamPayment ?? false;
    const feeAmount = settings?.examFeeAmount ?? 0;

    // Get current term
    const terms = await storage.getAcademicTerms();
    const currentTerm = terms.find((t: any) => t.isCurrent);

    if (!currentTerm) {
      return res.json({
        requirePayment,
        feeAmount,
        hasPaid: false,
        currentTerm: null,
        payment: null,
      });
    }

    // Check if student has paid for this term
    const payment = await storage.getExamPayment(studentId, currentTerm.id);

    return res.json({
      requirePayment,
      feeAmount,
      hasPaid: !!payment,
      currentTerm,
      payment: payment || null,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get payment status" });
  }
});

// ─── GET /api/exam-payments ─────────────────────────────────────────────────
// Admin: list all payments (optionally filtered by termId)
router.get("/", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const termId = req.query.termId ? parseInt(req.query.termId as string) : null;

    // Get system settings
    const settings = await storage.getSystemSettings();
    const feeAmount = settings?.examFeeAmount ?? 0;
    const requirePayment = settings?.requireExamPayment ?? false;

    // Get current or specified term
    let term: any = null;
    if (termId) {
      const terms = await storage.getAcademicTerms();
      term = terms.find((t: any) => t.id === termId);
    } else {
      const terms = await storage.getAcademicTerms();
      term = terms.find((t: any) => t.isCurrent);
    }

    if (!term) {
      return res.json({ payments: [], term: null, feeAmount, requirePayment });
    }

    const payments = await storage.getExamPaymentsByTerm(term.id);

    // Enrich with student/user info
    const enriched = await Promise.all(payments.map(async (p: any) => {
      try {
        const studentUser = await storage.getUser(p.studentId);
        const student = await storage.getStudent(p.studentId);
        const recorder = p.recordedBy ? await storage.getUser(p.recordedBy) : null;
        return {
          ...p,
          studentName: studentUser ? `${studentUser.firstName} ${studentUser.lastName}` : "Unknown",
          admissionNumber: student?.admissionNumber || "N/A",
          recordedByName: recorder ? `${recorder.firstName} ${recorder.lastName}` : "Unknown",
        };
      } catch {
        return p;
      }
    }));

    res.json({ payments: enriched, term, feeAmount, requirePayment });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get payments" });
  }
});

// ─── GET /api/exam-payments/students-status ──────────────────────────────────
// Admin: get all students with their payment status for a term
router.get("/students-status", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const termId = req.query.termId ? parseInt(req.query.termId as string) : null;

    const terms = await storage.getAcademicTerms();
    const term = termId
      ? terms.find((t: any) => t.id === termId)
      : terms.find((t: any) => t.isCurrent);

    if (!term) {
      return res.json({ students: [], term: null });
    }

    const payments = await storage.getExamPaymentsByTerm(term.id);
    const paidStudentIds = new Set(payments.map((p: any) => p.studentId));

    // Get all active students
    const allStudents = await storage.getAllStudents();
    const students = await Promise.all(allStudents.map(async (student: any) => {
      try {
        const user = await storage.getUser(student.id);
        const classInfo = student.classId ? await storage.getClass(student.classId) : null;
        const payment = payments.find((p: any) => p.studentId === student.id);
        return {
          studentId: student.id,
          admissionNumber: student.admissionNumber,
          studentName: user ? `${user.firstName} ${user.lastName}` : "Unknown",
          className: classInfo?.name || "Unassigned",
          hasPaid: paidStudentIds.has(student.id),
          paymentId: payment?.id || null,
          paidAt: payment?.paidAt || null,
          paymentMethod: payment?.paymentMethod || null,
          paymentReference: payment?.paymentReference || null,
        };
      } catch {
        return {
          studentId: student.id,
          admissionNumber: student.admissionNumber,
          studentName: "Unknown",
          className: "Unknown",
          hasPaid: false,
          paymentId: null,
          paidAt: null,
        };
      }
    }));

    res.json({ students, term });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get student payment status" });
  }
});

// ─── POST /api/exam-payments ─────────────────────────────────────────────────
// Admin: record a payment for a student
const createPaymentSchema = z.object({
  studentId: z.string().min(1),
  termId: z.number().int().positive(),
  amountPaid: z.number().int().min(0).default(0),
  paymentMethod: z.enum(["cash", "bank_transfer", "online", "other"]).default("cash"),
  paymentReference: z.string().optional(),
  notes: z.string().optional(),
});

router.post("/", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const parsed = createPaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
    }

    const { studentId, termId, amountPaid, paymentMethod, paymentReference, notes } = parsed.data;
    const recordedBy = req.user!.id;

    // Check for duplicate
    const existing = await storage.getExamPayment(studentId, termId);
    if (existing) {
      return res.status(409).json({
        message: "Student has already paid the exam fee for this term",
        payment: existing,
      });
    }

    // Verify student exists
    const student = await storage.getStudent(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const payment = await storage.createExamPayment({
      studentId,
      termId,
      amountPaid,
      paymentMethod,
      paymentReference: paymentReference || null,
      notes: notes || null,
      recordedBy,
      status: "paid",
      paidAt: new Date(),
    });

    // Log audit
    try {
      const studentUser = await storage.getUser(studentId);
      const term = (await storage.getAcademicTerms()).find((t: any) => t.id === termId);
      await storage.createAuditLog({
        userId: recordedBy,
        action: "exam_payment_recorded",
        entityType: "exam_payment",
        entityId: String(payment.id),
        reason: `Exam fee recorded for ${studentUser?.firstName} ${studentUser?.lastName} (${student.admissionNumber}) for ${term?.name} ${term?.year}`,
      });
    } catch { }

    res.status(201).json(payment);
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Student has already paid the exam fee for this term" });
    }
    res.status(500).json({ message: error.message || "Failed to record payment" });
  }
});

// ─── POST /api/exam-payments/bulk ────────────────────────────────────────────
// Admin: bulk-mark multiple students as paid
router.post("/bulk", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const { studentIds, termId, amountPaid = 0, paymentMethod = "cash", notes = "" } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: "studentIds must be a non-empty array" });
    }
    if (!termId) {
      return res.status(400).json({ message: "termId is required" });
    }

    const recordedBy = req.user!.id;
    const results = { success: 0, skipped: 0, failed: 0, errors: [] as string[] };

    for (const studentId of studentIds) {
      try {
        const existing = await storage.getExamPayment(studentId, termId);
        if (existing) {
          results.skipped++;
          continue;
        }
        await storage.createExamPayment({
          studentId,
          termId,
          amountPaid,
          paymentMethod,
          notes: notes || null,
          recordedBy,
          status: "paid",
          paidAt: new Date(),
        });
        results.success++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`${studentId}: ${err.message}`);
      }
    }

    res.json(results);
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Bulk payment failed" });
  }
});

// ─── DELETE /api/exam-payments/:id ───────────────────────────────────────────
// Admin: revoke a payment
router.delete("/:id", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid payment ID" });

    const deleted = await storage.deleteExamPayment(id);
    if (!deleted) return res.status(404).json({ message: "Payment not found" });

    try {
      await storage.createAuditLog({
        userId: req.user!.id,
        action: "exam_payment_revoked",
        entityType: "exam_payment",
        entityId: String(id),
        reason: `Exam payment #${id} revoked by admin`,
      });
    } catch { }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to delete payment" });
  }
});

export default router;
