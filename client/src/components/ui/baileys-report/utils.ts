import type { SubjectScore } from './types';

export const getRemarkFromGrade = (grade: string): string => {
  if (!grade) return '';
  const g = grade.toUpperCase();
  if (g === 'A' || g === 'A+') return 'EXCELLENT';
  if (g === 'B' || g === 'B+') return 'VERY GOOD';
  if (g === 'C' || g === 'C+') return 'GOOD';
  if (g === 'D' || g === 'D+') return 'PASS';
  if (g === 'E') return 'FAIR';
  return 'WEAK';
};

export const formatPosition = (pos: number): string => {
  if (!pos) return '-';
  if (pos >= 11 && pos <= 13) return `${pos}th`;
  switch (pos % 10) {
    case 1: return `${pos}st`;
    case 2: return `${pos}nd`;
    case 3: return `${pos}rd`;
    default: return `${pos}th`;
  }
};

export const getGradeFromScore = (score: number): string => {
  if (score >= 70) return 'A';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C';
  if (score >= 40) return 'D';
  if (score >= 30) return 'E';
  return 'F';
};

export const countGrades = (subjects: SubjectScore[]) => {
  const counts = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  subjects.forEach(s => {
    const g = s.grade?.toUpperCase()?.charAt(0);
    if (g && g in counts) counts[g as keyof typeof counts]++;
  });
  return counts;
};
