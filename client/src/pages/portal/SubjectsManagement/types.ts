// ─── Types shared across the Subjects Management page ─────────────────────────

export interface SubjectAudit {
  classLinks: number;
  studentAssignments: number;
  exams: number;
  assignments: number;
  lessonNotes: number;
  syllabusTopics: number;
  questionBanks: number;
  reportCardItems: number;
  continuousAssessments: number;
  timetableEntries: number;
  studyResources: number;
  teacherAssignments: number;
  isClean: boolean;
}

export type SubjectAction = 'archive' | 'restore' | 'delete';
