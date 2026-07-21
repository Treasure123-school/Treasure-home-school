/**
 * Shared type definitions for the report card feature.
 * All interfaces live here to avoid duplication across section components.
 */

export interface SubjectScore {
  id: number;
  subjectId: number;
  subjectName: string;
  subjectCode?: string;
  testScore: number | null;
  testMaxScore: number | null;
  testWeightedScore: number | null;
  examScore: number | null;
  examMaxScore: number | null;
  examWeightedScore: number | null;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade: string;
  remarks: string;
  teacherRemarks?: string | null;
  subjectPosition?: number | null;
  isOverridden?: boolean;
  canEditTest?: boolean;
  canEditExam?: boolean;
  canEditRemarks?: boolean;
}

export interface ClassStatistics {
  highestScore: number;
  lowestScore: number;
  classAverage: number;
  totalStudents: number;
}

export interface AttendanceSummary {
  timesSchoolOpened: number;
  timesPresent: number;
  timesAbsent: number;
  attendancePercentage: number;
}

export interface AffectiveTraits {
  punctuality: number; neatness: number; attentiveness: number;
  teamwork: number; leadership: number; assignments: number;
  classParticipation: number; honesty?: number; politeness?: number;
  selfControl?: number; obedience?: number; reliability?: number;
  senseOfResponsibility?: number; relationshipWithOthers?: number;
}

export interface PsychomotorSkills {
  sports: number; handwriting: number; musicalSkills: number; creativity: number;
  handlingOfTools?: number; drawingPainting?: number;
  publicSpeaking?: number; speechFluency?: number;
}

export interface ReportCardData {
  id: number;
  studentId: string;
  studentName: string;
  studentPhoto?: string;
  admissionNumber: string;
  className: string;
  classArm?: string;
  department?: string | null;
  isSSS?: boolean;
  termName: string;
  academicSession?: string;
  dateOfBirth?: string;
  gender?: string;
  averagePercentage: number;
  overallGrade: string;
  position: number;
  totalStudentsInClass: number;
  totalScore?: number;
  items: SubjectScore[];
  teacherRemarks?: string | null;
  principalRemarks?: string | null;
  status: string;
  generatedAt?: string;
  classStatistics?: ClassStatistics;
  attendance?: AttendanceSummary;
  affectiveTraits?: AffectiveTraits;
  psychomotorSkills?: PsychomotorSkills;
  dateIssued?: string;
  teacherSignatureUrl?: string | null;
  teacherSignedAt?: string | null;
  teacherSignedBy?: string | null;
  teacherName?: string | null;
  principalSignatureUrl?: string | null;
  principalSignedAt?: string | null;
  principalSignedBy?: string | null;
  principalName?: string | null;
}

export interface ProfessionalReportCardProps {
  reportCard: ReportCardData;
  testWeight: number;
  examWeight: number;
  onEditSubject?: (item: SubjectScore) => void;
  onSaveRemarks?: (teacherRemarks: string, principalRemarks: string) => void;
  onSaveSkills?: (skills: any) => Promise<void>;
  canEditRemarks?: boolean;
  canEditTeacherRemarks?: boolean;
  canEditPrincipalRemarks?: boolean;
  canEditSkills?: boolean;
  onGenerateDefaultComments?: () => Promise<{ teacherComment: string; principalComment: string }>;
  isLoading?: boolean;
  isFullReportReady?: boolean;
  hideActionButtons?: boolean;
}
