import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { authenticateUser, authorizeRoles, ROLES } from "./middleware";
import { z } from "zod";
import { uploadFileToStorage, deleteFileFromStorage } from "../upload-service";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Slug helper ───────────────────────────────────────────────
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 100);
}

// ─── Validation schemas ────────────────────────────────────────
const newsSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  excerpt: z.string().optional(),
  category: z.string().optional().default("general"),
  tags: z.array(z.string()).optional().default([]),
  status: z.enum(["draft", "published"]).default("draft"),
});

const faqSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  category: z.string().optional().default("general"),
  displayOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

const aboutSectionSchema = z.object({
  sectionKey: z.string().min(1).max(100),
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  imageUrl: z.string().optional(),
  displayOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

const enquiryStatusSchema = z.object({
  status: z.enum(["new", "reviewing", "accepted", "rejected", "waitlisted"]),
  notes: z.string().optional(),
});

const galleryUpdateSchema = z.object({
  title: z.string().optional(),
  eventName: z.string().optional(),
  altText: z.string().optional(),
  caption: z.string().optional(),
  categoryId: z.number().int().optional().nullable(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

// ═══════════════════════════════════════════════════════════════
// GALLERY
// ═══════════════════════════════════════════════════════════════

router.get("/api/public/gallery", async (_req: Request, res: Response) => {
  try {
    const images = await storage.getGalleryImages();
    const active = images.filter((i: any) => i.isActive !== false);
    res.json(active);
  } catch {
    res.status(500).json({ message: "Failed to fetch gallery" });
  }
});

router.get("/api/public/gallery/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await storage.getGalleryCategories();
    res.json(categories);
  } catch {
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

router.get("/api/admin/gallery", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
    const images = await storage.getGalleryImages(categoryId);
    res.json(images);
  } catch {
    res.status(500).json({ message: "Failed to fetch gallery" });
  }
});

router.post(
  "/api/admin/gallery",
  authenticateUser,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  upload.single("image"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Image file required" });
      const result = await uploadFileToStorage(req.file.buffer, req.file.originalname, "gallery");
      if (!result.success || !result.url) return res.status(500).json({ message: result.error || "Upload failed" });
      const image = await storage.uploadGalleryImage({
        imageUrl: result.url,
        title: req.body.title || null,
        eventName: req.body.eventName || null,
        altText: req.body.altText || null,
        caption: req.body.caption || null,
        categoryId: req.body.categoryId ? parseInt(req.body.categoryId) : null,
        uploadedBy: (req as any).user?.id || null,
        isActive: true,
        displayOrder: parseInt(req.body.displayOrder || "0"),
      } as any);
      res.status(201).json(image);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Upload failed" });
    }
  }
);

router.put("/api/admin/gallery/:id", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const data = galleryUpdateSchema.parse(req.body);
    const updated = await storage.updateGalleryImage(id, data);
    if (!updated) return res.status(404).json({ message: "Image not found" });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/api/admin/gallery/:id", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const deleted = await storage.deleteGalleryImage(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Image not found" });
    res.json({ message: "Deleted successfully" });
  } catch {
    res.status(500).json({ message: "Delete failed" });
  }
});

router.post("/api/admin/gallery-categories", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: "Name required" });
    const cat = await storage.createGalleryCategory({ name, description });
    res.status(201).json(cat);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/api/admin/gallery-categories/:id", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const deleted = await storage.deleteGalleryCategory(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ message: "Category not found" });
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ message: "Delete failed" });
  }
});

// ═══════════════════════════════════════════════════════════════
// NEWS POSTS
// ═══════════════════════════════════════════════════════════════

router.get("/api/public/news", async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const posts = await storage.getNewsPosts({ status: "published", category });
    res.json(posts);
  } catch {
    res.status(500).json({ message: "Failed to fetch news" });
  }
});

router.get("/api/public/news/:slug", async (req: Request, res: Response) => {
  try {
    const post = await storage.getNewsPostBySlug(req.params.slug);
    if (!post || post.status !== "published") return res.status(404).json({ message: "Not found" });
    res.json(post);
  } catch {
    res.status(500).json({ message: "Failed to fetch post" });
  }
});

router.get("/api/admin/news", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (_req: Request, res: Response) => {
  try {
    const posts = await storage.getNewsPosts({});
    res.json(posts);
  } catch {
    res.status(500).json({ message: "Failed to fetch news" });
  }
});

router.post(
  "/api/admin/news",
  authenticateUser,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  upload.single("coverImage"),
  async (req: Request, res: Response) => {
    try {
      let body = req.body;
      if (typeof body.tags === "string") {
        try { body.tags = JSON.parse(body.tags); } catch { body.tags = []; }
      }
      const data = newsSchema.parse(body);
      let coverImageUrl: string | undefined;
      if (req.file) {
        const result = await uploadFileToStorage(req.file.buffer, req.file.originalname, "news");
        if (result.success && result.url) coverImageUrl = result.url;
      } else if (req.body.coverImageUrl) {
        coverImageUrl = req.body.coverImageUrl;
      }
      const slug = slugify(data.title) + "-" + Date.now().toString(36);
      const post = await storage.createNewsPost({
        ...data,
        slug,
        tags: JSON.stringify(data.tags),
        coverImageUrl: coverImageUrl || null,
        authorId: (req as any).user?.id || null,
        publishedAt: data.status === "published" ? new Date() : null,
      } as any);
      res.status(201).json(post);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  }
);

router.put(
  "/api/admin/news/:id",
  authenticateUser,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  upload.single("coverImage"),
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      let body = req.body;
      if (typeof body.tags === "string") {
        try { body.tags = JSON.parse(body.tags); } catch { body.tags = []; }
      }
      const data = newsSchema.partial().parse(body);
      let coverImageUrl: string | undefined;
      if (req.file) {
        const result = await uploadFileToStorage(req.file.buffer, req.file.originalname, "news");
        if (result.success && result.url) coverImageUrl = result.url;
      }
      const updates: any = { ...data };
      if (data.tags) updates.tags = JSON.stringify(data.tags);
      if (coverImageUrl) updates.coverImageUrl = coverImageUrl;
      const existing = await storage.getNewsPostById(id);
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (data.status === "published" && existing.status !== "published") {
        updates.publishedAt = new Date();
      }
      updates.updatedAt = new Date();
      const updated = await storage.updateNewsPost(id, updates);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  }
);

router.delete("/api/admin/news/:id", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const deleted = await storage.deleteNewsPost(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ message: "Delete failed" });
  }
});

// ═══════════════════════════════════════════════════════════════
// FAQs
// ═══════════════════════════════════════════════════════════════

router.get("/api/public/faq", async (_req: Request, res: Response) => {
  try {
    const faqs = await storage.getFaqs({ isActive: true });
    res.json(faqs);
  } catch {
    res.status(500).json({ message: "Failed to fetch FAQs" });
  }
});

router.get("/api/admin/faq", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (_req: Request, res: Response) => {
  try {
    const faqs = await storage.getFaqs({});
    res.json(faqs);
  } catch {
    res.status(500).json({ message: "Failed to fetch FAQs" });
  }
});

router.post("/api/admin/faq", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const data = faqSchema.parse(req.body);
    const faq = await storage.createFaq(data);
    res.status(201).json(faq);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/api/admin/faq/:id", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const data = faqSchema.partial().parse(req.body);
    const updated = await storage.updateFaq(parseInt(req.params.id), { ...data, updatedAt: new Date() });
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/api/admin/faq/:id", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const deleted = await storage.deleteFaq(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ message: "Delete failed" });
  }
});

// ═══════════════════════════════════════════════════════════════
// ABOUT SECTIONS
// ═══════════════════════════════════════════════════════════════

router.get("/api/public/about-sections", async (_req: Request, res: Response) => {
  try {
    const sections = await storage.getAboutSections({ isActive: true });
    res.json(sections);
  } catch {
    res.status(500).json({ message: "Failed to fetch about sections" });
  }
});

router.get("/api/admin/about-sections", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (_req: Request, res: Response) => {
  try {
    const sections = await storage.getAboutSections({});
    res.json(sections);
  } catch {
    res.status(500).json({ message: "Failed to fetch about sections" });
  }
});

router.post(
  "/api/admin/about-sections",
  authenticateUser,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  upload.single("image"),
  async (req: Request, res: Response) => {
    try {
      const data = aboutSectionSchema.parse(req.body);
      let imageUrl: string | undefined;
      if (req.file) {
        const result = await uploadFileToStorage(req.file.buffer, req.file.originalname, "about");
        if (result.success && result.url) imageUrl = result.url;
      } else if (req.body.imageUrl) {
        imageUrl = req.body.imageUrl;
      }
      const section = await storage.createAboutSection({ ...data, imageUrl: imageUrl || null } as any);
      res.status(201).json(section);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  }
);

router.put(
  "/api/admin/about-sections/:id",
  authenticateUser,
  authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  upload.single("image"),
  async (req: Request, res: Response) => {
    try {
      const data = aboutSectionSchema.partial().parse(req.body);
      let imageUrl: string | undefined;
      if (req.file) {
        const result = await uploadFileToStorage(req.file.buffer, req.file.originalname, "about");
        if (result.success && result.url) imageUrl = result.url;
      }
      const updates: any = { ...data, updatedAt: new Date() };
      if (imageUrl) updates.imageUrl = imageUrl;
      const updated = await storage.updateAboutSection(parseInt(req.params.id), updates);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  }
);

router.delete("/api/admin/about-sections/:id", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const deleted = await storage.deleteAboutSection(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ message: "Delete failed" });
  }
});

// ═══════════════════════════════════════════════════════════════
// CONTACT MESSAGES (Admin Inbox)
// ═══════════════════════════════════════════════════════════════

router.get("/api/admin/contact-messages", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (_req: Request, res: Response) => {
  try {
    const messages = await storage.getContactMessages();
    res.json(messages);
  } catch {
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

router.patch("/api/admin/contact-messages/:id/read", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    await storage.markContactMessageAsRead(parseInt(req.params.id));
    res.json({ message: "Marked as read" });
  } catch {
    res.status(500).json({ message: "Failed to update" });
  }
});

router.post("/api/admin/contact-messages/:id/respond", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const { response } = req.body;
    if (!response) return res.status(400).json({ message: "Response text required" });
    const updated = await storage.respondToContactMessage(parseInt(req.params.id), response, (req as any).user.id);
    if (!updated) return res.status(404).json({ message: "Message not found" });
    res.json(updated);
  } catch {
    res.status(500).json({ message: "Failed to respond" });
  }
});

router.delete("/api/admin/contact-messages/:id", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const deleted = await storage.deleteContactMessage(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ message: "Delete failed" });
  }
});

// ═══════════════════════════════════════════════════════════════
// PUBLIC: Admissions form submission
// ═══════════════════════════════════════════════════════════════

const admissionsFormSchema = z.object({
  studentName: z.string().min(1),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  classApplying: z.string().optional(),
  parentName: z.string().min(1),
  parentEmail: z.string().email(),
  parentPhone: z.string().min(1),
  address: z.string().optional(),
  previousSchool: z.string().optional(),
  medicalInfo: z.string().optional(),
  additionalInfo: z.string().optional(),
});

router.post("/api/admissions", async (req: Request, res: Response) => {
  try {
    const data = admissionsFormSchema.parse(req.body);
    const enquiry = await storage.createAdmissionsEnquiry({
      studentName: data.studentName,
      dateOfBirth: data.dateOfBirth || null,
      gender: data.gender || null,
      classApplying: data.classApplying || null,
      parentName: data.parentName,
      parentEmail: data.parentEmail,
      parentPhone: data.parentPhone,
      address: data.address || null,
      previousSchool: data.previousSchool || null,
      medicalInfo: data.medicalInfo || null,
      additionalInfo: data.additionalInfo || null,
      status: "new",
    } as any);
    res.status(201).json({ message: "Application submitted successfully", id: enquiry.id });
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Submission failed" });
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMISSIONS ENQUIRIES (Admin)
// ═══════════════════════════════════════════════════════════════

router.get("/api/admin/admissions-enquiries", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const enquiries = await storage.getAdmissionsEnquiries(status);
    res.json(enquiries);
  } catch {
    res.status(500).json({ message: "Failed to fetch enquiries" });
  }
});

router.patch("/api/admin/admissions-enquiries/:id/status", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const data = enquiryStatusSchema.parse(req.body);
    const updated = await storage.updateAdmissionsEnquiry(parseInt(req.params.id), {
      ...data,
      reviewedBy: (req as any).user.id,
      reviewedAt: new Date(),
    } as any);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/api/admin/admissions-enquiries/:id", authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const deleted = await storage.deleteAdmissionsEnquiry(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ message: "Delete failed" });
  }
});

export default router;
