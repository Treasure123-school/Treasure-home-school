import { db } from './db';
import { gradeScales, gradingBoundaries } from '@shared/schema.pg';
import { eq } from 'drizzle-orm';

const SCALES = [
  {
    name: 'WAEC / NECO',
    description: 'Standard Nigerian secondary school grading (WAEC/NECO)',
    isActive: true,
    boundaries: [
      { grade: 'A1', minScore: 75, maxScore: 100, remark: 'Distinction', gradePoint: 4 },
      { grade: 'B2', minScore: 70, maxScore: 74,  remark: 'Very Good',   gradePoint: 4 },
      { grade: 'B3', minScore: 65, maxScore: 69,  remark: 'Good',        gradePoint: 3 },
      { grade: 'C4', minScore: 60, maxScore: 64,  remark: 'Credit',      gradePoint: 3 },
      { grade: 'C5', minScore: 55, maxScore: 59,  remark: 'Credit',      gradePoint: 2 },
      { grade: 'C6', minScore: 50, maxScore: 54,  remark: 'Credit',      gradePoint: 2 },
      { grade: 'D7', minScore: 45, maxScore: 49,  remark: 'Pass',        gradePoint: 1 },
      { grade: 'E8', minScore: 40, maxScore: 44,  remark: 'Pass',        gradePoint: 1 },
      { grade: 'F9', minScore: 0,  maxScore: 39,  remark: 'Fail',        gradePoint: 0 },
    ],
  },
  {
    name: 'Standard A–F',
    description: 'Classic letter-grade scale used in many Nigerian private schools',
    isActive: false,
    boundaries: [
      { grade: 'A',  minScore: 70, maxScore: 100, remark: 'Excellent', gradePoint: 4 },
      { grade: 'B',  minScore: 60, maxScore: 69,  remark: 'Very Good', gradePoint: 3 },
      { grade: 'C',  minScore: 50, maxScore: 59,  remark: 'Good',      gradePoint: 2 },
      { grade: 'D',  minScore: 40, maxScore: 49,  remark: 'Pass',      gradePoint: 1 },
      { grade: 'E',  minScore: 30, maxScore: 39,  remark: 'Fair',      gradePoint: 1 },
      { grade: 'F',  minScore: 0,  maxScore: 29,  remark: 'Fail',      gradePoint: 0 },
    ],
  },
  {
    name: 'Percentage Scale',
    description: 'Percentage-range bands displayed directly as grades',
    isActive: false,
    boundaries: [
      { grade: '90–100%', minScore: 90, maxScore: 100, remark: 'Outstanding', gradePoint: 4 },
      { grade: '80–89%',  minScore: 80, maxScore: 89,  remark: 'Excellent',   gradePoint: 4 },
      { grade: '70–79%',  minScore: 70, maxScore: 79,  remark: 'Very Good',   gradePoint: 3 },
      { grade: '60–69%',  minScore: 60, maxScore: 69,  remark: 'Good',        gradePoint: 3 },
      { grade: '50–59%',  minScore: 50, maxScore: 59,  remark: 'Fair',        gradePoint: 2 },
      { grade: '40–49%',  minScore: 40, maxScore: 49,  remark: 'Pass',        gradePoint: 1 },
      { grade: '0–39%',   minScore: 0,  maxScore: 39,  remark: 'Fail',        gradePoint: 0 },
    ],
  },
  {
    name: 'Point-Based Scale',
    description: '5-point GPA scale (common in tertiary bridging / junior college)',
    isActive: false,
    boundaries: [
      { grade: 'A (5.0)', minScore: 70, maxScore: 100, remark: 'Excellent', gradePoint: 5 },
      { grade: 'B (4.0)', minScore: 60, maxScore: 69,  remark: 'Very Good', gradePoint: 4 },
      { grade: 'C (3.0)', minScore: 50, maxScore: 59,  remark: 'Good',      gradePoint: 3 },
      { grade: 'D (2.0)', minScore: 45, maxScore: 49,  remark: 'Pass',      gradePoint: 2 },
      { grade: 'E (1.0)', minScore: 40, maxScore: 44,  remark: 'Weak',      gradePoint: 1 },
      { grade: 'F (0.0)', minScore: 0,  maxScore: 39,  remark: 'Fail',      gradePoint: 0 },
    ],
  },
];

export async function seedGradingBoundaries() {
  const existingScales = await db.select({ id: gradeScales.id }).from(gradeScales).limit(1);
  if (existingScales.length > 0) {
    console.log('ℹ️  Grade scales already exist — skipping seed');
    return;
  }

  // Clear any orphaned boundaries from the old seed
  await db.delete(gradingBoundaries);

  for (const scale of SCALES) {
    const [newScale] = await db.insert(gradeScales).values({
      name: scale.name,
      description: scale.description,
      isActive: scale.isActive,
      isBuiltIn: true,
      createdBy: null,
    }).returning();

    await db.insert(gradingBoundaries).values(
      scale.boundaries.map(b => ({
        scaleId: newScale.id,
        name: scale.name,
        grade: b.grade,
        minScore: b.minScore,
        maxScore: b.maxScore,
        remark: b.remark,
        gradePoint: b.gradePoint,
        isDefault: scale.isActive,
        createdBy: null,
      }))
    );
  }

  console.log(`✅ Seeded ${SCALES.length} grade scales with boundaries`);
}
