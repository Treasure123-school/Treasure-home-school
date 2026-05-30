import { db } from './db';
import { gradingBoundaries } from '@shared/schema.pg';
import { eq } from 'drizzle-orm';

const WAEC_NECO_SCALE = [
  { grade: 'A1', minScore: 75, maxScore: 100, remark: 'Distinction',  gradePoint: 4 },
  { grade: 'B2', minScore: 70, maxScore: 74,  remark: 'Very Good',    gradePoint: 4 },
  { grade: 'B3', minScore: 65, maxScore: 69,  remark: 'Good',         gradePoint: 3 },
  { grade: 'C4', minScore: 60, maxScore: 64,  remark: 'Credit',       gradePoint: 3 },
  { grade: 'C5', minScore: 55, maxScore: 59,  remark: 'Credit',       gradePoint: 2 },
  { grade: 'C6', minScore: 50, maxScore: 54,  remark: 'Credit',       gradePoint: 2 },
  { grade: 'D7', minScore: 45, maxScore: 49,  remark: 'Pass',         gradePoint: 1 },
  { grade: 'E8', minScore: 40, maxScore: 44,  remark: 'Pass',         gradePoint: 1 },
  { grade: 'F9', minScore: 0,  maxScore: 39,  remark: 'Fail',         gradePoint: 0 },
];

export async function seedGradingBoundaries() {
  const existing = await db
    .select({ id: gradingBoundaries.id })
    .from(gradingBoundaries)
    .where(eq(gradingBoundaries.isDefault, true))
    .limit(1);

  if (existing.length > 0) {
    console.log('ℹ️  Default grading boundaries already exist — skipping seed');
    return;
  }

  await db.insert(gradingBoundaries).values(
    WAEC_NECO_SCALE.map(b => ({
      name: 'Standard',
      grade: b.grade,
      minScore: b.minScore,
      maxScore: b.maxScore,
      remark: b.remark,
      gradePoint: b.gradePoint,
      isDefault: true,
      createdBy: null,
    }))
  );

  console.log(`✅ Seeded ${WAEC_NECO_SCALE.length} default WAEC/NECO grading boundaries`);
}
