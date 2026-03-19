import { Router, type Request, type Response } from "express";
import { storage } from "../storage";
import { authenticateUser, authorizeRoles, ROLES } from "./middleware";
import { z } from "zod";
import crypto from "crypto";

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

// ─── POST /api/exam-payments/initiate ────────────────────────────────────────
// Student: begin checkout — creates a pending payment and returns Paystack init data
router.post("/initiate", authenticateUser, authorizeRoles(ROLES.STUDENT), async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.id;

    const settings = await storage.getSystemSettings();
    const requirePayment = settings?.requireExamPayment ?? false;
    const feeAmount = settings?.examFeeAmount ?? 0;

    if (!requirePayment) {
      return res.status(400).json({ message: "Online exam payment is not required" });
    }

    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      return res.status(503).json({ message: "Payment gateway is not configured. Please contact the administrator." });
    }

    const terms = await storage.getAcademicTerms();
    const currentTerm = terms.find((t: any) => t.isCurrent);
    if (!currentTerm) {
      return res.status(400).json({ message: "No active academic term found" });
    }

    const studentUser = await storage.getUser(studentId);
    if (!studentUser) {
      return res.status(404).json({ message: "Student account not found" });
    }

    // Generate a unique reference tied to this student and term
    const reference = `EP-${studentId.slice(0, 8)}-T${currentTerm.id}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    // Upsert pending record (prevents double-payment)
    await storage.initiatePendingExamPayment(studentId, currentTerm.id, reference, feeAmount);

    // Derive the app's base URL for the Paystack callback
    const origin = req.headers.origin ||
      `${req.protocol}://${req.get("host")}`;
    const callbackUrl = `${origin}/payment/callback`;

    // Paystack requires amount in kobo (integer, no decimals)
    const amountKobo = Math.round(feeAmount * 100);
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: studentUser.email,
        amount: amountKobo,
        currency: "NGN",
        reference,
        callback_url: callbackUrl,
        metadata: {
          studentId,
          termId: currentTerm.id,
          termName: `${currentTerm.name} ${currentTerm.year}`,
          studentName: `${studentUser.firstName} ${studentUser.lastName}`,
        },
      }),
    });

    if (!paystackRes.ok) {
      const errBody = await paystackRes.json().catch(() => ({}));
      console.error("[PAYMENT] Paystack init failed:", errBody);
      return res.status(502).json({ message: "Payment gateway initialization failed. Please try again." });
    }

    const paystackData: any = await paystackRes.json();
    if (!paystackData.status) {
      return res.status(502).json({ message: paystackData.message || "Payment initialization failed" });
    }

    return res.json({
      reference,
      accessCode: paystackData.data.access_code,
      authorizationUrl: paystackData.data.authorization_url,
      publicKey: process.env.PAYSTACK_PUBLIC_KEY || "",
      email: studentUser.email,
      amountKobo,
      currentTerm,
    });
  } catch (error: any) {
    if (error.message === "ALREADY_PAID") {
      return res.status(409).json({ message: "You have already paid the exam fee for this term" });
    }
    console.error("[PAYMENT] Initiate error:", error);
    res.status(500).json({ message: error.message || "Failed to initiate payment" });
  }
});

// ─── POST /api/exam-payments/verify ──────────────────────────────────────────
// Student: verify their payment from the backend after Paystack callback
router.post("/verify", authenticateUser, authorizeRoles(ROLES.STUDENT), async (req: Request, res: Response) => {
  try {
    const { reference } = req.body;
    if (!reference || typeof reference !== "string") {
      return res.status(400).json({ message: "Payment reference is required" });
    }

    const studentId = req.user!.id;
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      return res.status(503).json({ message: "Payment gateway is not configured" });
    }

    // Look up pending record — must belong to this student
    const payment = await storage.getExamPaymentByReference(reference);
    if (!payment) {
      return res.status(404).json({ message: "Payment record not found for this reference" });
    }
    if (payment.studentId !== studentId) {
      return res.status(403).json({ message: "This payment reference does not belong to your account" });
    }
    if (payment.status === "paid") {
      return res.json({ success: true, alreadyPaid: true, payment });
    }

    // Verify with Paystack backend-to-backend
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${paystackSecretKey}` },
    });
    const verifyData: any = await verifyRes.json();

    if (!verifyData.status || verifyData.data?.status !== "success") {
      const gatewayStatus = verifyData.data?.status || "failed";
      await storage.updateExamPayment(payment.id, {
        status: gatewayStatus === "abandoned" ? "pending" : "failed",
        gatewayResponse: JSON.stringify(verifyData.data || {}),
      });
      return res.status(402).json({
        message: `Payment not confirmed. Gateway status: ${gatewayStatus}`,
        gatewayStatus,
      });
    }

    // Confirmed — mark as paid
    const updatedPayment = await storage.updateExamPayment(payment.id, {
      status: "paid",
      amountPaid: Math.floor(verifyData.data.amount / 100),
      paymentMethod: "online",
      gatewayResponse: JSON.stringify(verifyData.data),
      paidAt: new Date(),
    });

    // Audit log
    try {
      await storage.createAuditLog({
        userId: studentId,
        action: "exam_payment_online_verified",
        entityType: "exam_payment",
        entityId: String(payment.id),
        reason: `Online exam fee payment verified via Paystack. Reference: ${reference}`,
      });
    } catch { }

    return res.json({ success: true, alreadyPaid: false, payment: updatedPayment });
  } catch (error: any) {
    console.error("[PAYMENT] Verify error:", error);
    res.status(500).json({ message: error.message || "Failed to verify payment" });
  }
});

// ─── POST /api/exam-payments/recover ──────────────────────────────────────────
// Student: called automatically on page load — if there is a pending/failed
// payment record with a reference, we re-verify with Paystack.
// This handles: logout mid-flow, browser crash, redirect to wrong page, etc.
router.post("/recover", authenticateUser, authorizeRoles(ROLES.STUDENT), async (req: Request, res: Response) => {
  try {
    const studentId = req.user!.id;
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      return res.json({ recovered: false, reason: "gateway_not_configured" });
    }

    const terms = await storage.getAcademicTerms();
    const currentTerm = terms.find((t: any) => t.isCurrent);
    if (!currentTerm) {
      return res.json({ recovered: false, reason: "no_active_term" });
    }

    // Is there already a confirmed paid record? Nothing to recover.
    const paidPayment = await storage.getExamPayment(studentId, currentTerm.id);
    if (paidPayment) {
      return res.json({ recovered: true, alreadyPaid: true, payment: paidPayment });
    }

    // Look for a pending/failed record with a reference we can re-check
    const pending = await storage.getPendingExamPayment(studentId, currentTerm.id);
    if (!pending || !pending.paymentReference) {
      return res.json({ recovered: false, reason: "no_pending_payment" });
    }

    // Verify with Paystack
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(pending.paymentReference)}`,
      { headers: { Authorization: `Bearer ${paystackSecretKey}` } },
    );
    const verifyData: any = await verifyRes.json();

    if (!verifyData.status || verifyData.data?.status !== "success") {
      // Payment was not completed on Paystack — still pending, leave record as-is
      return res.json({ recovered: false, reason: "not_paid_on_gateway", gatewayStatus: verifyData.data?.status });
    }

    // Paystack confirms it was paid — mark as paid in our DB
    const updatedPayment = await storage.updateExamPayment(pending.id, {
      status: "paid",
      amountPaid: Math.floor(verifyData.data.amount / 100),
      paymentMethod: "online",
      gatewayResponse: JSON.stringify(verifyData.data),
      paidAt: new Date(),
    });

    try {
      await storage.createAuditLog({
        userId: studentId,
        action: "exam_payment_auto_recovered",
        entityType: "exam_payment",
        entityId: String(pending.id),
        reason: `Exam fee auto-recovered on login. Reference: ${pending.paymentReference}`,
      });
    } catch { }

    console.log(`[PAYMENT] Auto-recovered payment for student ${studentId}, ref: ${pending.paymentReference}`);
    return res.json({ recovered: true, alreadyPaid: false, payment: updatedPayment });
  } catch (error: any) {
    console.error("[PAYMENT] Recover error:", error);
    // Never fail — just report nothing was recovered
    return res.json({ recovered: false, reason: "error" });
  }
});

// ─── POST /api/exam-payments/webhook ─────────────────────────────────────────
// Paystack webhook — no auth, HMAC-verified using raw body
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) return res.sendStatus(200);

    // req.body is a raw Buffer (set by express.raw middleware in index.ts)
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
    const hash = crypto.createHmac("sha512", paystackSecretKey)
      .update(rawBody)
      .digest("hex");
    const signature = req.headers["x-paystack-signature"] as string;
    if (!signature || hash !== signature) {
      return res.sendStatus(400);
    }

    const event = JSON.parse(rawBody.toString("utf8"));
    if (event.event !== "charge.success") {
      return res.sendStatus(200); // Acknowledge other events but do nothing
    }

    const { reference, status, amount } = event.data;
    if (status !== "success" || !reference) return res.sendStatus(200);

    const payment = await storage.getExamPaymentByReference(reference);
    if (!payment || payment.status === "paid") return res.sendStatus(200);

    await storage.updateExamPayment(payment.id, {
      status: "paid",
      amountPaid: Math.floor(amount / 100),
      paymentMethod: "online",
      gatewayResponse: JSON.stringify(event.data),
      paidAt: new Date(),
    });

    try {
      await storage.createAuditLog({
        userId: payment.studentId,
        action: "exam_payment_webhook_confirmed",
        entityType: "exam_payment",
        entityId: String(payment.id),
        reason: `Exam fee confirmed via Paystack webhook. Reference: ${reference}`,
      });
    } catch { }

    return res.sendStatus(200);
  } catch (error) {
    console.error("[PAYMENT] Webhook error:", error);
    return res.sendStatus(200); // Always 200 to Paystack
  }
});

// ─── GET /api/exam-payments/settings ─────────────────────────────────────────
// Admin & Super Admin: get exam payment configuration
router.get("/settings", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const settings = await storage.getSystemSettings();
    res.json({
      requireExamPayment: settings?.requireExamPayment ?? false,
      examFeeAmount: settings?.examFeeAmount ?? 0,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get payment settings" });
  }
});

// ─── PUT /api/exam-payments/settings ──────────────────────────────────────────
// Admin & Super Admin: update exam fee amount and requirement flag
const updateSettingsSchema = z.object({
  requireExamPayment: z.boolean(),
  examFeeAmount: z.number().int().min(0),
});

router.put("/settings", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid data", errors: parsed.error.flatten() });
    }
    const { requireExamPayment, examFeeAmount } = parsed.data;
    const settings = await storage.updateSystemSettings({ requireExamPayment, examFeeAmount });

    try {
      await storage.createAuditLog({
        userId: req.user!.id,
        action: "exam_payment_settings_updated",
        entityType: "system_settings",
        entityId: String(settings.id),
        reason: `Exam payment settings updated: requirePayment=${requireExamPayment}, feeAmount=${examFeeAmount}`,
      });
    } catch { }

    res.json({
      requireExamPayment: settings.requireExamPayment,
      examFeeAmount: settings.examFeeAmount,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to update payment settings" });
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
