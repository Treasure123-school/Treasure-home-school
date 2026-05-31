/**
 * Curriculum Template Library Routes
 *
 * Super Admin — full CRUD on templates + topics, publish/unpublish
 * Admin       — browse published templates, preview, import into school scheme
 * Teacher     — read-only view of published templates
 */

import { Router, Request, Response } from "express";
import { db } from "../storage";
import { curriculumTemplates, curriculumTemplateTopics, syllabusTopics, academicTerms, classes, subjects } from "@shared/schema.pg";
import { eq, and, ilike, or, inArray, asc, desc } from "drizzle-orm";
import { authenticateUser, authorizeRoles, ROLES } from "./middleware";
import {
  sendSuccess, sendCreated, sendBadRequest, sendNotFound, sendForbidden,
  handleRouteError, parseIntParam
} from "../utils/response-helpers";
import { z } from "zod";

const router = Router();

const SUPER_ADMIN_ONLY = [ROLES.SUPER_ADMIN];
const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN];
const STAFF_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TEACHER];

// ─── Validation schemas ───────────────────────────────────────────────────────

const createTemplateSchema = z.object({
  title: z.string().min(2).max(255),
  level: z.enum(["primary", "jss", "ss", "custom"]),
  className: z.string().min(1).max(100),
  subjectName: z.string().min(1).max(150),
  description: z.string().optional(),
});

const updateTemplateSchema = createTemplateSchema.partial();

const createTopicSchema = z.object({
  term: z.enum(["first", "second", "third"]),
  weekNumber: z.number().int().min(1).max(16),
  orderNumber: z.number().int().min(0).optional(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

const bulkTopicsSchema = z.object({
  topics: z.array(createTopicSchema).min(1).max(200),
});

const importSchema = z.object({
  classId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  termIds: z.record(z.string(), z.number().int().positive()), // { first: termId, second: termId, third: termId }
  terms: z.array(z.enum(["first", "second", "third"])).min(1),
  publishOnImport: z.boolean().optional().default(false),
});

// ─── Super Admin: Template CRUD ───────────────────────────────────────────────

// GET /api/curriculum-templates  — list all (super admin sees all; admin/teacher sees published only)
router.get("/api/curriculum-templates", authenticateUser, authorizeRoles(...STAFF_ROLES), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isSuperAdmin = user?.roleId === ROLES.SUPER_ADMIN;

    const level = req.query.level as string | undefined;
    const search = req.query.search as string | undefined;
    const className = req.query.className as string | undefined;
    const subjectName = req.query.subjectName as string | undefined;

    let query = db.select().from(curriculumTemplates) as any;

    const conditions: any[] = [];

    if (!isSuperAdmin) {
      conditions.push(eq(curriculumTemplates.isPublished, true));
    }
    if (level) conditions.push(eq(curriculumTemplates.level, level));
    if (className) conditions.push(ilike(curriculumTemplates.className, `%${className}%`));
    if (subjectName) conditions.push(ilike(curriculumTemplates.subjectName, `%${subjectName}%`));
    if (search) {
      conditions.push(
        or(
          ilike(curriculumTemplates.title, `%${search}%`),
          ilike(curriculumTemplates.subjectName, `%${search}%`),
          ilike(curriculumTemplates.className, `%${search}%`)
        )
      );
    }

    const templates = conditions.length > 0
      ? await db.select().from(curriculumTemplates).where(and(...conditions)).orderBy(asc(curriculumTemplates.level), asc(curriculumTemplates.className), asc(curriculumTemplates.subjectName))
      : await db.select().from(curriculumTemplates).orderBy(asc(curriculumTemplates.level), asc(curriculumTemplates.className), asc(curriculumTemplates.subjectName));

    // Attach topic counts
    const ids = templates.map((t: any) => t.id);
    let topicCounts: Record<number, number> = {};
    if (ids.length > 0) {
      const counts = await db.select().from(curriculumTemplateTopics).where(inArray(curriculumTemplateTopics.templateId, ids));
      for (const t of counts) {
        topicCounts[t.templateId] = (topicCounts[t.templateId] || 0) + 1;
      }
    }

    const enriched = templates.map((t: any) => ({ ...t, topicCount: topicCounts[t.id] || 0 }));
    sendSuccess(res, enriched);
  } catch (err) { handleRouteError(res, err, "curriculum-templates.list"); }
});

// GET /api/curriculum-templates/stats
router.get("/api/curriculum-templates/stats", authenticateUser, authorizeRoles(...SUPER_ADMIN_ONLY), async (_req: Request, res: Response) => {
  try {
    const all = await db.select().from(curriculumTemplates);
    const topics = await db.select().from(curriculumTemplateTopics);
    const published = all.filter((t: any) => t.isPublished).length;
    const levels = [...new Set(all.map((t: any) => t.level))];
    sendSuccess(res, {
      total: all.length,
      published,
      draft: all.length - published,
      totalTopics: topics.length,
      levels,
    });
  } catch (err) { handleRouteError(res, err, "curriculum-templates.stats"); }
});

// GET /api/curriculum-templates/:id — full template with all topics
router.get("/api/curriculum-templates/:id", authenticateUser, authorizeRoles(...STAFF_ROLES), async (req: Request, res: Response) => {
  try {
    const id = parseIntParam(req.params.id);
    if (!id) return sendBadRequest(res, "Invalid template id");

    const user = (req as any).user;
    const isSuperAdmin = user?.roleId === ROLES.SUPER_ADMIN;

    const [template] = await db.select().from(curriculumTemplates).where(eq(curriculumTemplates.id, id));
    if (!template) return sendNotFound(res, "Template not found");
    if (!isSuperAdmin && !template.isPublished) return sendForbidden(res, "Template is not published");

    const topics = await db.select().from(curriculumTemplateTopics)
      .where(eq(curriculumTemplateTopics.templateId, id))
      .orderBy(asc(curriculumTemplateTopics.term), asc(curriculumTemplateTopics.weekNumber), asc(curriculumTemplateTopics.orderNumber));

    // Group by term
    const grouped: Record<string, typeof topics> = { first: [], second: [], third: [] };
    for (const t of topics) {
      if (grouped[t.term]) grouped[t.term].push(t);
    }

    sendSuccess(res, { ...template, topics, grouped });
  } catch (err) { handleRouteError(res, err, "curriculum-templates.get"); }
});

// POST /api/curriculum-templates — create template (super admin only)
router.post("/api/curriculum-templates", authenticateUser, authorizeRoles(...SUPER_ADMIN_ONLY), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const body = createTemplateSchema.parse(req.body);
    const [template] = await db.insert(curriculumTemplates).values({
      ...body,
      createdBy: user.id,
    }).returning();
    sendCreated(res, template);
  } catch (err) { handleRouteError(res, err, "curriculum-templates.create"); }
});

// PUT /api/curriculum-templates/:id — update template (super admin only)
router.put("/api/curriculum-templates/:id", authenticateUser, authorizeRoles(...SUPER_ADMIN_ONLY), async (req: Request, res: Response) => {
  try {
    const id = parseIntParam(req.params.id);
    if (!id) return sendBadRequest(res, "Invalid template id");
    const body = updateTemplateSchema.parse(req.body);
    const [updated] = await db.update(curriculumTemplates)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(curriculumTemplates.id, id))
      .returning();
    if (!updated) return sendNotFound(res, "Template not found");
    sendSuccess(res, updated);
  } catch (err) { handleRouteError(res, err, "curriculum-templates.update"); }
});

// PATCH /api/curriculum-templates/:id/publish — toggle publish status
router.patch("/api/curriculum-templates/:id/publish", authenticateUser, authorizeRoles(...SUPER_ADMIN_ONLY), async (req: Request, res: Response) => {
  try {
    const id = parseIntParam(req.params.id);
    if (!id) return sendBadRequest(res, "Invalid template id");
    const { isPublished } = z.object({ isPublished: z.boolean() }).parse(req.body);
    const [updated] = await db.update(curriculumTemplates)
      .set({ isPublished, updatedAt: new Date() })
      .where(eq(curriculumTemplates.id, id))
      .returning();
    if (!updated) return sendNotFound(res, "Template not found");
    sendSuccess(res, updated);
  } catch (err) { handleRouteError(res, err, "curriculum-templates.publish"); }
});

// DELETE /api/curriculum-templates/:id — delete template and all its topics (cascade)
router.delete("/api/curriculum-templates/:id", authenticateUser, authorizeRoles(...SUPER_ADMIN_ONLY), async (req: Request, res: Response) => {
  try {
    const id = parseIntParam(req.params.id);
    if (!id) return sendBadRequest(res, "Invalid template id");
    const [deleted] = await db.delete(curriculumTemplates).where(eq(curriculumTemplates.id, id)).returning();
    if (!deleted) return sendNotFound(res, "Template not found");
    sendSuccess(res, { message: "Template deleted" });
  } catch (err) { handleRouteError(res, err, "curriculum-templates.delete"); }
});

// ─── Template Topics ──────────────────────────────────────────────────────────

// POST /api/curriculum-templates/:id/topics — add single topic
router.post("/api/curriculum-templates/:id/topics", authenticateUser, authorizeRoles(...SUPER_ADMIN_ONLY), async (req: Request, res: Response) => {
  try {
    const templateId = parseIntParam(req.params.id);
    if (!templateId) return sendBadRequest(res, "Invalid template id");

    const [template] = await db.select().from(curriculumTemplates).where(eq(curriculumTemplates.id, templateId));
    if (!template) return sendNotFound(res, "Template not found");

    const body = createTopicSchema.parse(req.body);

    // Auto-assign orderNumber if not provided
    const existingTopics = await db.select().from(curriculumTemplateTopics)
      .where(and(eq(curriculumTemplateTopics.templateId, templateId), eq(curriculumTemplateTopics.term, body.term)));
    const orderNumber = body.orderNumber ?? existingTopics.length;

    const [topic] = await db.insert(curriculumTemplateTopics).values({
      templateId,
      ...body,
      orderNumber,
    }).returning();
    sendCreated(res, topic);
  } catch (err) { handleRouteError(res, err, "curriculum-templates.topics.add"); }
});

// POST /api/curriculum-templates/:id/topics/bulk — bulk add topics
router.post("/api/curriculum-templates/:id/topics/bulk", authenticateUser, authorizeRoles(...SUPER_ADMIN_ONLY), async (req: Request, res: Response) => {
  try {
    const templateId = parseIntParam(req.params.id);
    if (!templateId) return sendBadRequest(res, "Invalid template id");

    const [template] = await db.select().from(curriculumTemplates).where(eq(curriculumTemplates.id, templateId));
    if (!template) return sendNotFound(res, "Template not found");

    const { topics } = bulkTopicsSchema.parse(req.body);
    const rows = topics.map((t, i) => ({ templateId, ...t, orderNumber: t.orderNumber ?? i }));
    const inserted = await db.insert(curriculumTemplateTopics).values(rows).returning();
    sendCreated(res, { created: inserted.length, topics: inserted });
  } catch (err) { handleRouteError(res, err, "curriculum-templates.topics.bulk"); }
});

// PUT /api/curriculum-templates/topics/:topicId — update topic
router.put("/api/curriculum-templates/topics/:topicId", authenticateUser, authorizeRoles(...SUPER_ADMIN_ONLY), async (req: Request, res: Response) => {
  try {
    const topicId = parseIntParam(req.params.topicId);
    if (!topicId) return sendBadRequest(res, "Invalid topic id");
    const body = createTopicSchema.partial().parse(req.body);
    const [updated] = await db.update(curriculumTemplateTopics)
      .set(body)
      .where(eq(curriculumTemplateTopics.id, topicId))
      .returning();
    if (!updated) return sendNotFound(res, "Topic not found");
    sendSuccess(res, updated);
  } catch (err) { handleRouteError(res, err, "curriculum-templates.topics.update"); }
});

// DELETE /api/curriculum-templates/topics/:topicId — delete topic
router.delete("/api/curriculum-templates/topics/:topicId", authenticateUser, authorizeRoles(...SUPER_ADMIN_ONLY), async (req: Request, res: Response) => {
  try {
    const topicId = parseIntParam(req.params.topicId);
    if (!topicId) return sendBadRequest(res, "Invalid topic id");
    const [deleted] = await db.delete(curriculumTemplateTopics).where(eq(curriculumTemplateTopics.id, topicId)).returning();
    if (!deleted) return sendNotFound(res, "Topic not found");
    sendSuccess(res, { message: "Topic deleted" });
  } catch (err) { handleRouteError(res, err, "curriculum-templates.topics.delete"); }
});

// ─── Admin: Import Template ────────────────────────────────────────────────────

/**
 * POST /api/curriculum-templates/:id/import
 * Imports template topics into the school's syllabus_topics table.
 * Creates school-owned copies — editing them won't affect the global template.
 * Skips duplicates (same class/subject/term/name) and reports them.
 */
router.post("/api/curriculum-templates/:id/import", authenticateUser, authorizeRoles(...ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const templateId = parseIntParam(req.params.id);
    if (!templateId) return sendBadRequest(res, "Invalid template id");

    const user = (req as any).user;

    const [template] = await db.select().from(curriculumTemplates).where(eq(curriculumTemplates.id, templateId));
    if (!template) return sendNotFound(res, "Template not found");
    if (!template.isPublished && user?.roleId !== ROLES.SUPER_ADMIN) {
      return sendForbidden(res, "This template is not published yet");
    }

    const body = importSchema.parse(req.body);

    // Verify class and subject exist
    const [cls] = await db.select().from(classes).where(eq(classes.id, body.classId));
    if (!cls) return sendBadRequest(res, "Class not found");

    const [subj] = await db.select().from(subjects).where(eq(subjects.id, body.subjectId));
    if (!subj) return sendBadRequest(res, "Subject not found");

    // Get all topics for the selected terms
    const allTopics = await db.select().from(curriculumTemplateTopics)
      .where(
        and(
          eq(curriculumTemplateTopics.templateId, templateId),
          inArray(curriculumTemplateTopics.term, body.terms as any[])
        )
      )
      .orderBy(asc(curriculumTemplateTopics.term), asc(curriculumTemplateTopics.weekNumber), asc(curriculumTemplateTopics.orderNumber));

    if (allTopics.length === 0) {
      return sendBadRequest(res, "No topics found for the selected terms");
    }

    let created = 0;
    let skipped = 0;
    const skippedNames: string[] = [];
    const errors: string[] = [];

    for (const topic of allTopics) {
      const termId = body.termIds[topic.term];
      if (!termId) {
        skipped++;
        skippedNames.push(`${topic.name} (no term ID for "${topic.term}")`);
        continue;
      }

      try {
        // Check for duplicate
        const existing = await db.select().from(syllabusTopics).where(
          and(
            eq(syllabusTopics.classId, body.classId),
            eq(syllabusTopics.subjectId, body.subjectId),
            eq(syllabusTopics.termId, termId),
            eq(syllabusTopics.name, topic.name)
          )
        );

        if (existing.length > 0) {
          skipped++;
          skippedNames.push(topic.name);
          continue;
        }

        await db.insert(syllabusTopics).values({
          classId: body.classId,
          subjectId: body.subjectId,
          termId,
          name: topic.name,
          description: topic.description ?? null,
          orderNumber: topic.orderNumber,
          isPublished: body.publishOnImport,
          createdBy: user.id,
        });
        created++;
      } catch (err: any) {
        if (err?.code === "23505") {
          skipped++;
          skippedNames.push(topic.name);
        } else {
          errors.push(`"${topic.name}": ${err?.message ?? "unknown error"}`);
        }
      }
    }

    sendSuccess(res, {
      message: `Import complete. ${created} topic(s) added, ${skipped} skipped (duplicates).`,
      created,
      skipped,
      skippedNames,
      errors,
    });
  } catch (err) { handleRouteError(res, err, "curriculum-templates.import"); }
});

export default router;
