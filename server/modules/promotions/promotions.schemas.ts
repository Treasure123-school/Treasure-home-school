/** Promotion request validation schemas + outcome constants — extracted
 *  from promotions.service.ts. */
import { z } from 'zod';

export const PROMOTION_OUTCOMES = ['promoted', 'repeating', 'graduated', 'withdrawn', 'deferred'] as const;
export type PromotionOutcome = typeof PROMOTION_OUTCOMES[number];

// ==================== Zod validation ====================

export const previewSchema = z.object({
  sourceSessionId: z.coerce.number().int().positive().optional(),
  destinationSessionId: z.coerce.number().int().positive(),
});

export const mappingsUpdateSchema = z.object({
  mappings: z.array(z.object({
    classId: z.coerce.number().int().positive(),
    sequenceOrder: z.coerce.number().int().nullable().optional(),
    nextClassId: z.coerce.number().int().nullable().optional(),
    isGraduationLevel: z.coerce.boolean().optional(),
  })).min(1),
});

export const executeSchema = z.object({
  sourceSessionId: z.coerce.number().int().positive(),
  destinationSessionId: z.coerce.number().int().positive(),
  students: z.array(z.object({
    studentId: z.string().min(30).max(40),
    outcome: z.enum(PROMOTION_OUTCOMES),
    toClassId: z.coerce.number().int().positive().nullable().optional(),
    reason: z.string().max(1000).optional(),
  })).min(1).max(2000),
});

export const rolloverSchema = z.object({
  sourceSessionId: z.coerce.number().int().positive().optional(),
  destinationSessionId: z.coerce.number().int().positive(),
});

export const correctRecordSchema = z.object({
  outcome: z.enum(PROMOTION_OUTCOMES),
  toClassId: z.coerce.number().int().positive().nullable().optional(),
  reason: z.string().max(1000).optional(),
});

export type Tx = any; // drizzle transaction type (matches existing codebase convention)

// ==================== Helpers ====================
