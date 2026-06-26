import { Router, Request, Response } from "express";
import { authenticateUser, authorizeRoles, ROLES } from "./middleware";
import { storage } from "../storage";
import { z } from "zod";

const requireAdmin = authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN);

export const billingRouter = Router();

// ─── Billing Items ────────────────────────────────────────────────────────────

billingRouter.get("/items", authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { category, isActive, termId } = req.query;
    const filters: any = {};
    if (category) filters.category = String(category);
    if (isActive !== undefined) filters.isActive = isActive === "true";
    if (termId) filters.termId = Number(termId);
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

const BILLING_CATEGORIES = [
  "general", "exam", "registration", "resources", "cbt",
  "result_checker", "library", "excursion", "uniform", "pta", "other",
] as const;

const billingItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  amount: z.number().int().min(0),
  category: z.enum(BILLING_CATEGORIES).default("general"),
  isActive: z.boolean().default(true),
  isRecurring: z.boolean().default(false),
  paymentType: z.enum(["one_time", "recurring"]).default("one_time"),
  classLevels: z.string().optional().nullable(),
  termId: z.number().int().optional().nullable(),
  session: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  lateFee: z.number().int().min(0).optional().nullable(),
  discount: z.number().int().min(0).optional().nullable(),
});

billingRouter.post("/items", authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = billingItemSchema.parse(req.body);
    const item = await storage.createBillingItem({
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      createdBy: req.user!.id,
    });
    res.status(201).json(item);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

billingRouter.put("/items/:id", authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = billingItemSchema.partial().parse(req.body);
    const item = await storage.updateBillingItem(Number(req.params.id), {
      ...data,
      dueDate: data.dueDate != null ? new Date(data.dueDate) : null,
    });
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

    const items = await storage.getBillingItems();
    const enriched = await Promise.all(payments.map(async (p) => {
      const student = await storage.getStudent(p.studentId) as any;
      const user = student?.userId ? await storage.getUser(student.userId) : null;
      const item = items.find((i) => i.id === p.billingItemId);
      const cls = student?.classId ? await storage.getClass(student.classId) : null;
      return {
        ...p,
        studentName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : p.studentId,
        admissionNumber: student?.admissionNumber || "",
        className: cls?.name || "",
        billingItemName: item?.name || "",
        billingItemCategory: item?.category || "",
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

// ─── Financial Reports ────────────────────────────────────────────────────────

billingRouter.get("/reports", authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { termId, session } = req.query;

    const payments = await storage.getBillingPayments(
      termId ? { termId: Number(termId), status: "paid" } :
      { status: "paid" }
    );
    const items = await storage.getBillingItems();

    const totalRevenue = payments.reduce((s, p) => s + (p.amountPaid || 0), 0);
    const totalPayments = payments.length;

    // By billing item
    const byItem: Record<number, { name: string; category: string; count: number; total: number }> = {};
    for (const p of payments) {
      if (!byItem[p.billingItemId]) {
        const item = items.find((i) => i.id === p.billingItemId);
        byItem[p.billingItemId] = { name: item?.name || "Unknown", category: item?.category || "", count: 0, total: 0 };
      }
      byItem[p.billingItemId].count++;
      byItem[p.billingItemId].total += p.amountPaid || 0;
    }

    // By payment method
    const byMethod: Record<string, { count: number; total: number }> = {};
    for (const p of payments) {
      const method = p.paymentMethod || "unknown";
      if (!byMethod[method]) byMethod[method] = { count: 0, total: 0 };
      byMethod[method].count++;
      byMethod[method].total += p.amountPaid || 0;
    }

    // By category
    const byCategory: Record<string, { count: number; total: number }> = {};
    for (const p of payments) {
      const item = items.find((i) => i.id === p.billingItemId);
      const cat = item?.category || "other";
      if (!byCategory[cat]) byCategory[cat] = { count: 0, total: 0 };
      byCategory[cat].count++;
      byCategory[cat].total += p.amountPaid || 0;
    }

    // Monthly trend (last 12 months)
    const monthlyTrend: Record<string, { count: number; total: number }> = {};
    for (const p of payments) {
      const date = p.paidAt || p.createdAt;
      if (!date) continue;
      const d = new Date(date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyTrend[key]) monthlyTrend[key] = { count: 0, total: 0 };
      monthlyTrend[key].count++;
      monthlyTrend[key].total += p.amountPaid || 0;
    }

    res.json({
      totalRevenue,
      totalPayments,
      byItem: Object.entries(byItem).map(([id, v]) => ({ billingItemId: Number(id), ...v })),
      byMethod: Object.entries(byMethod).map(([method, v]) => ({ method, ...v })),
      byCategory: Object.entries(byCategory).map(([category, v]) => ({ category, ...v })),
      monthlyTrend: Object.entries(monthlyTrend)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, v]) => ({ month, ...v })),
    });
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

// ─── Public: feature access check for a student ───────────────────────────────

billingRouter.get("/feature-access/:featureKey", authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { featureKey } = req.params;
    const termId = req.query.termId ? Number(req.query.termId) : undefined;

    const link = await storage.getBillingFeatureLink(featureKey);
    if (!link) return res.json({ hasAccess: true, required: false });

    const item = await storage.getBillingItem(link.billingItemId);
    if (!item || !item.isActive) return res.json({ hasAccess: true, required: false });

    const student = await storage.getStudentByUserId(user.id);
    if (!student) return res.json({ hasAccess: false, required: true, item });

    const payment = await storage.getStudentBillingPayment(student.id, link.billingItemId, termId);
    res.json({
      hasAccess: payment?.status === "paid",
      required: true,
      item,
      payment: payment || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
