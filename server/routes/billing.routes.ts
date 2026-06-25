import { Router, Request, Response } from "express";
import { authenticateUser, requireAdmin } from "./middleware";
import { storage } from "../storage";
import { z } from "zod";

export const billingRouter = Router();

// ─── Billing Items ────────────────────────────────────────────────────────────

billingRouter.get("/items", authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { category, isActive } = req.query;
    const filters: any = {};
    if (category) filters.category = String(category);
    if (isActive !== undefined) filters.isActive = isActive === "true";
    const items = await storage.getBillingItems(filters);
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

billingRouter.get("/items/:id", authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const item = await storage.getBillingItem(Number(req.params.id));
    if (!item) return res.status(404).json({ error: "Billing item not found" });
    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const billingItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  amount: z.number().int().min(0),
  category: z.enum(["general", "exam", "registration", "other"]).default("general"),
  isActive: z.boolean().default(true),
  isRecurring: z.boolean().default(false),
});

billingRouter.post("/items", authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = billingItemSchema.parse(req.body);
    const item = await storage.createBillingItem({ ...data, createdBy: req.user!.id });
    res.status(201).json(item);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

billingRouter.put("/items/:id", authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = billingItemSchema.partial().parse(req.body);
    const item = await storage.updateBillingItem(Number(req.params.id), data);
    if (!item) return res.status(404).json({ error: "Billing item not found" });
    res.json(item);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

billingRouter.delete("/items/:id", authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const ok = await storage.deleteBillingItem(Number(req.params.id));
    if (!ok) return res.status(404).json({ error: "Billing item not found" });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Feature Links ────────────────────────────────────────────────────────────

billingRouter.get("/feature-links", authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const links = await storage.getBillingFeatureLinks();
    res.json(links);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

billingRouter.post("/feature-links", authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { billingItemId, featureKey } = z.object({ billingItemId: z.number().int(), featureKey: z.string().min(1) }).parse(req.body);
    // Remove any existing link for this featureKey first (one feature = one billing item)
    await storage.deleteBillingFeatureLinkByKey(featureKey);
    const link = await storage.createBillingFeatureLink({ billingItemId, featureKey });
    res.status(201).json(link);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

billingRouter.delete("/feature-links/:featureKey", authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    await storage.deleteBillingFeatureLinkByKey(req.params.featureKey);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Billing Payments ─────────────────────────────────────────────────────────

billingRouter.get("/payments", authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { billingItemId, studentId, termId, status } = req.query;
    const filters: any = {};
    if (billingItemId) filters.billingItemId = Number(billingItemId);
    if (studentId) filters.studentId = String(studentId);
    if (termId) filters.termId = Number(termId);
    if (status) filters.status = String(status);
    const payments = await storage.getBillingPayments(filters);

    // Enrich with student + item names
    const items = await storage.getBillingItems();
    const enriched = await Promise.all(payments.map(async (p) => {
      const student = await storage.getStudent(p.studentId);
      const user = student?.userId ? await storage.getUser(student.userId) : null;
      const item = items.find((i) => i.id === p.billingItemId);
      const cls = student?.classId ? await storage.getClass(student.classId) : null;
      return {
        ...p,
        studentName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : p.studentId,
        admissionNumber: student?.admissionNumber || "",
        className: cls?.name || "",
        billingItemName: item?.name || "",
      };
    }));
    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const recordPaymentSchema = z.object({
  billingItemId: z.number().int(),
  studentId: z.string(),
  termId: z.number().int().optional().nullable(),
  amountPaid: z.number().int().min(0),
  paymentMethod: z.string().default("cash"),
  paymentReference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  paidAt: z.string().optional().nullable(),
});

billingRouter.post("/payments", authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = recordPaymentSchema.parse(req.body);
    const payment = await storage.createBillingPayment({
      ...data,
      status: "paid",
      provider: "manual",
      recordedBy: req.user!.id,
      paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
    });
    res.status(201).json(payment);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

billingRouter.post("/payments/bulk", authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { billingItemId, studentIds, termId, amountPaid, paymentMethod } = z.object({
      billingItemId: z.number().int(),
      studentIds: z.array(z.string()),
      termId: z.number().int().optional().nullable(),
      amountPaid: z.number().int().min(0),
      paymentMethod: z.string().default("cash"),
    }).parse(req.body);

    let success = 0, skipped = 0, failed = 0;
    for (const studentId of studentIds) {
      try {
        const existing = await storage.getStudentBillingPayment(studentId, billingItemId, termId ?? undefined);
        if (existing?.status === "paid") { skipped++; continue; }
        await storage.createBillingPayment({
          billingItemId, studentId, termId: termId ?? null,
          amountPaid, paymentMethod, status: "paid", provider: "manual",
          recordedBy: req.user!.id, paidAt: new Date(),
        });
        success++;
      } catch {
        failed++;
      }
    }
    res.json({ success, skipped, failed });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

billingRouter.delete("/payments/:id", authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const ok = await storage.deleteBillingPayment(Number(req.params.id));
    if (!ok) return res.status(404).json({ error: "Payment not found" });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Outstanding Payments ────────────────────────────────────────────────────

billingRouter.get("/outstanding", authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { billingItemId, termId } = req.query;
    const outstanding = await storage.getOutstandingBillingPayments(
      billingItemId ? Number(billingItemId) : undefined,
      termId ? Number(termId) : undefined
    );
    res.json(outstanding);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Financial Summary ────────────────────────────────────────────────────────

billingRouter.get("/summary", authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { termId } = req.query;
    const summary = await storage.getBillingFinancialSummary(termId ? Number(termId) : undefined);
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Student: check payment status for a billing item ────────────────────────

billingRouter.get("/student/status/:billingItemId", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const billingItemId = Number(req.params.billingItemId);
    const termId = req.query.termId ? Number(req.query.termId) : undefined;
    const student = await storage.getStudentByUserId(user.id);
    if (!student) return res.status(404).json({ error: "Student not found" });
    const payment = await storage.getStudentBillingPayment(student.id, billingItemId, termId);
    const item = await storage.getBillingItem(billingItemId);
    res.json({
      hasPaid: payment?.status === "paid",
      payment: payment || null,
      item: item || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
