import { Router, Request, Response } from 'express';
import { db } from './db';
import { gradeScales, gradingBoundaries } from '@shared/schema.pg';
import { eq, and, desc } from 'drizzle-orm';
import { invalidateGradeScaleCache } from './grade-scale-service';
import { authenticateUser, authorizeRoles, ROLES } from './routes/middleware';
import { z } from 'zod';

const router = Router();
const requireAdmin = [authenticateUser, authorizeRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN)];

const scaleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(255).optional(),
});

const boundarySchema = z.object({
  grade: z.string().min(1).max(10),
  minScore: z.number().int().min(0).max(100),
  maxScore: z.number().int().min(0).max(100),
  remark: z.string().max(100).optional(),
  gradePoint: z.number().optional(),
});

router.get('/api/grade-scales', requireAdmin, async (req: Request, res: Response) => {
  try {
    const scales = await db.select().from(gradeScales).orderBy(desc(gradeScales.isActive), gradeScales.createdAt);
    const boundaryRows = await db.select().from(gradingBoundaries).orderBy(desc(gradingBoundaries.minScore));

    const result = scales.map(s => ({
      ...s,
      boundaries: boundaryRows.filter(b => b.scaleId === s.id),
    }));

    res.json(result);
  } catch (err) {
    console.error('Error fetching grade scales:', err);
    res.status(500).json({ message: 'Failed to fetch grade scales' });
  }
});

router.get('/api/grade-scales/active', requireAdmin, async (req: Request, res: Response) => {
  try {
    const [scale] = await db.select().from(gradeScales).where(eq(gradeScales.isActive, true)).limit(1);
    if (!scale) return res.json(null);
    const boundaries = await db.select().from(gradingBoundaries)
      .where(eq(gradingBoundaries.scaleId, scale.id))
      .orderBy(desc(gradingBoundaries.minScore));
    res.json({ ...scale, boundaries });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch active grade scale' });
  }
});

router.post('/api/grade-scales', requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { name, description, copyFromId } = req.body;
    const parsed = scaleSchema.parse({ name, description });

    const [newScale] = await db.insert(gradeScales).values({
      name: parsed.name,
      description: parsed.description ?? null,
      isActive: false,
      isBuiltIn: false,
      createdBy: user.id,
    }).returning();

    if (copyFromId) {
      const sourceBoundaries = await db.select().from(gradingBoundaries)
        .where(eq(gradingBoundaries.scaleId, parseInt(copyFromId)));
      if (sourceBoundaries.length > 0) {
        await db.insert(gradingBoundaries).values(
          sourceBoundaries.map(b => ({
            scaleId: newScale.id,
            name: parsed.name,
            grade: b.grade,
            minScore: b.minScore,
            maxScore: b.maxScore,
            remark: b.remark,
            gradePoint: b.gradePoint,
            isDefault: false,
            createdBy: user.id,
          }))
        );
      }
    }

    const boundaries = await db.select().from(gradingBoundaries)
      .where(eq(gradingBoundaries.scaleId, newScale.id))
      .orderBy(desc(gradingBoundaries.minScore));

    res.status(201).json({ ...newScale, boundaries });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: err.errors });
    console.error('Error creating grade scale:', err);
    res.status(500).json({ message: 'Failed to create grade scale' });
  }
});

router.patch('/api/grade-scales/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' });
    const parsed = scaleSchema.parse(req.body);
    const [updated] = await db.update(gradeScales)
      .set({ name: parsed.name, description: parsed.description ?? null, updatedAt: new Date() })
      .where(eq(gradeScales.id, id))
      .returning();
    if (!updated) return res.status(404).json({ message: 'Grade scale not found' });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: err.errors });
    res.status(500).json({ message: 'Failed to update grade scale' });
  }
});

router.post('/api/grade-scales/:id/activate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid ID' });

    await db.update(gradeScales).set({ isActive: false, updatedAt: new Date() });
    const [activated] = await db.update(gradeScales)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(gradeScales.id, id))
      .returning();

    if (!activated) return res.status(404).json({ message: 'Grade scale not found' });

    invalidateGradeScaleCache();
    res.json(activated);
  } catch (err) {
    console.error('Error activating grade scale:', err);
    res.status(500).json({ message: 'Failed to activate grade scale' });
  }
});

router.post('/api/grade-scales/:id/duplicate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const user = req.user as any;

    const [source] = await db.select().from(gradeScales).where(eq(gradeScales.id, id)).limit(1);
    if (!source) return res.status(404).json({ message: 'Grade scale not found' });

    const [copy] = await db.insert(gradeScales).values({
      name: `${source.name} (Copy)`,
      description: source.description,
      isActive: false,
      isBuiltIn: false,
      createdBy: user.id,
    }).returning();

    const sourceBoundaries = await db.select().from(gradingBoundaries)
      .where(eq(gradingBoundaries.scaleId, id));

    if (sourceBoundaries.length > 0) {
      await db.insert(gradingBoundaries).values(
        sourceBoundaries.map(b => ({
          scaleId: copy.id,
          name: copy.name,
          grade: b.grade,
          minScore: b.minScore,
          maxScore: b.maxScore,
          remark: b.remark,
          gradePoint: b.gradePoint,
          isDefault: false,
          createdBy: user.id,
        }))
      );
    }

    const boundaries = await db.select().from(gradingBoundaries)
      .where(eq(gradingBoundaries.scaleId, copy.id))
      .orderBy(desc(gradingBoundaries.minScore));

    res.status(201).json({ ...copy, boundaries });
  } catch (err) {
    console.error('Error duplicating grade scale:', err);
    res.status(500).json({ message: 'Failed to duplicate grade scale' });
  }
});

router.delete('/api/grade-scales/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [scale] = await db.select().from(gradeScales).where(eq(gradeScales.id, id)).limit(1);
    if (!scale) return res.status(404).json({ message: 'Grade scale not found' });
    if (scale.isActive) return res.status(400).json({ message: 'Cannot delete the active grade scale. Activate another scale first.' });

    await db.delete(gradeScales).where(eq(gradeScales.id, id));
    res.json({ message: 'Grade scale deleted' });
  } catch (err) {
    console.error('Error deleting grade scale:', err);
    res.status(500).json({ message: 'Failed to delete grade scale' });
  }
});

router.post('/api/grade-scales/:id/boundaries', requireAdmin, async (req: Request, res: Response) => {
  try {
    const scaleId = parseInt(req.params.id);
    const user = req.user as any;
    const parsed = boundarySchema.parse(req.body);

    if (parsed.minScore > parsed.maxScore)
      return res.status(400).json({ message: 'Min score cannot be greater than max score' });

    const [scale] = await db.select().from(gradeScales).where(eq(gradeScales.id, scaleId)).limit(1);
    if (!scale) return res.status(404).json({ message: 'Grade scale not found' });

    const [created] = await db.insert(gradingBoundaries).values({
      scaleId,
      name: scale.name,
      grade: parsed.grade,
      minScore: parsed.minScore,
      maxScore: parsed.maxScore,
      remark: parsed.remark ?? null,
      gradePoint: parsed.gradePoint != null ? Math.round(parsed.gradePoint) : null,
      isDefault: scale.isActive,
      createdBy: user.id,
    }).returning();

    if (scale.isActive) invalidateGradeScaleCache();
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: err.errors });
    res.status(500).json({ message: 'Failed to add boundary' });
  }
});

router.patch('/api/grade-scales/:scaleId/boundaries/:boundaryId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const boundaryId = parseInt(req.params.boundaryId);
    const scaleId = parseInt(req.params.scaleId);
    const parsed = boundarySchema.parse(req.body);

    if (parsed.minScore > parsed.maxScore)
      return res.status(400).json({ message: 'Min score cannot be greater than max score' });

    const [updated] = await db.update(gradingBoundaries)
      .set({
        grade: parsed.grade,
        minScore: parsed.minScore,
        maxScore: parsed.maxScore,
        remark: parsed.remark ?? null,
        gradePoint: parsed.gradePoint != null ? Math.round(parsed.gradePoint) : null,
        updatedAt: new Date(),
      })
      .where(and(eq(gradingBoundaries.id, boundaryId), eq(gradingBoundaries.scaleId, scaleId)))
      .returning();

    if (!updated) return res.status(404).json({ message: 'Boundary not found' });

    const [scale] = await db.select().from(gradeScales).where(eq(gradeScales.id, scaleId)).limit(1);
    if (scale?.isActive) invalidateGradeScaleCache();

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: 'Validation error', errors: err.errors });
    res.status(500).json({ message: 'Failed to update boundary' });
  }
});

router.delete('/api/grade-scales/:scaleId/boundaries/:boundaryId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const boundaryId = parseInt(req.params.boundaryId);
    const scaleId = parseInt(req.params.scaleId);
    await db.delete(gradingBoundaries)
      .where(and(eq(gradingBoundaries.id, boundaryId), eq(gradingBoundaries.scaleId, scaleId)));

    const [scale] = await db.select().from(gradeScales).where(eq(gradeScales.id, scaleId)).limit(1);
    if (scale?.isActive) invalidateGradeScaleCache();

    res.json({ message: 'Boundary deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete boundary' });
  }
});

export default router;
