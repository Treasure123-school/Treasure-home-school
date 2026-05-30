import { db } from './db';
import { gradeScales, gradingBoundaries } from '@shared/schema.pg';
import { eq, desc } from 'drizzle-orm';
import { STANDARD_GRADING_SCALE, type GradingConfig } from '../shared/grading-utils';

let _cache: { config: GradingConfig; expiresAt: number } | null = null;

export function invalidateGradeScaleCache() {
  _cache = null;
}

export async function getActiveGradingConfig(): Promise<GradingConfig> {
  if (_cache && Date.now() < _cache.expiresAt) return _cache.config;

  const [activeScale] = await db
    .select()
    .from(gradeScales)
    .where(eq(gradeScales.isActive, true))
    .limit(1);

  if (!activeScale) return STANDARD_GRADING_SCALE;

  const boundaries = await db
    .select()
    .from(gradingBoundaries)
    .where(eq(gradingBoundaries.scaleId, activeScale.id))
    .orderBy(desc(gradingBoundaries.minScore));

  if (boundaries.length === 0) return STANDARD_GRADING_SCALE;

  const config: GradingConfig = {
    name: activeScale.name,
    scoreAggregationMode: 'last',
    testWeight: 40,
    examWeight: 60,
    ranges: boundaries.map(b => ({
      min: b.minScore,
      max: b.maxScore,
      grade: b.grade,
      points: b.gradePoint ?? 0,
      remarks: b.remark ?? '',
    })),
  };

  _cache = { config, expiresAt: Date.now() + 5 * 60 * 1000 };
  return config;
}

export function gradeFromBoundaries(
  score: number,
  boundaries: { minScore: number; maxScore: number; grade: string; remark: string | null; gradePoint: number | null }[]
) {
  const sorted = [...boundaries].sort((a, b) => b.minScore - a.minScore);
  const match = sorted.find(b => score >= b.minScore && score <= b.maxScore);
  return match ?? sorted[sorted.length - 1] ?? null;
}
