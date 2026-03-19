export type { GradeRange, GradingConfig, WeightedScoreResult } from '../shared/grading-utils';

export {
  STANDARD_GRADING_SCALE,
  GRADING_SCALES,
  getGradingConfig,
  calculateGradeFromPercentage as calculateGrade,
  calculateWeightedScore,
  calculateClassPosition,
  calculateGPA,
  getOrdinalSuffix,
  formatPosition,
  getGradeColor,
  getGradeBgColor
} from '../shared/grading-utils';

import type { GradingConfig } from '../shared/grading-utils';
import { 
  getGradingConfig as getConfig, 
  calculateGradeFromPercentage,
  calculateWeightedScore as calcWeightedScore,
} from '../shared/grading-utils';

export function aggregateScores(
  scores: number[],
  mode: 'last' | 'best' | 'average'
): number {
  if (scores.length === 0) return 0;
  
  switch (mode) {
    case 'last':
      return scores[scores.length - 1];
    case 'best':
      return Math.max(...scores);
    case 'average':
      return scores.reduce((sum, score) => sum + score, 0) / scores.length;
    default:
      return scores[scores.length - 1];
  }
}

export function getOverallGrade(averagePercentage: number, scaleName: string = 'standard'): string {
  const gradeInfo = calculateGradeFromPercentage(averagePercentage, scaleName);
  return gradeInfo.grade;
}

export function calculateWeightedScoreByScale(
  testScore: number | null, 
  testMaxScore: number | null,
  examScore: number | null,
  examMaxScore: number | null,
  scaleName: string = 'standard'
): { weightedScore: number; percentage: number; testWeighted: number; examWeighted: number } {
  const config = getConfig(scaleName);
  const result = calcWeightedScore(testScore, testMaxScore, examScore, examMaxScore, config);
  return {
    weightedScore: result.weightedScore,
    percentage: result.percentage,
    testWeighted: result.testWeighted,
    examWeighted: result.examWeighted
  };
}
