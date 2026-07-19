export interface SubjectScore {
  subjectName: string;
  testScore: number | null;
  testMaxScore?: number | null;
  testWeightedScore?: number | null;
  examScore: number | null;
  examMaxScore?: number | null;
  examWeightedScore?: number | null;
  totalMarks?: number;
  obtainedMarks: number;
  grade: string;
  remarks?: string;
  subjectPosition?: number | null;
  classAverage?: number | null;
}

export interface AttendanceSummary {
  timesSchoolOpened: number;
  timesPresent: number;
  timesAbsent: number;
  attendancePercentage?: number;
}

export interface AffectiveTraits {
  punctuality?: number;
  neatness?: number;
  attentiveness?: number;
  teamwork?: number;
  leadership?: number;
  assignments?: number;
  classParticipation?: number;
  honesty?: number;
  politeness?: number;
  selfControl?: number;
  obedience?: number;
  reliability?: number;
  senseOfResponsibility?: number;
  relationshipWithOthers?: number;
}

export interface PsychomotorSkills {
  handlingOfTools?: number;
  drawingPainting?: number;
  handwriting?: number;
  publicSpeaking?: number;
  speechFluency?: number;
  sports?: number;
  musicalSkills?: number;
  creativity?: number;
}

export interface ReportCardData {
  id?: number;
  studentId?: string;
  studentName: string;
  studentPhoto?: string;
  admissionNumber: string;
  className: string;
  classArm?: string;
  department?: string | null;
  isSSS?: boolean;
  termName: string;
  academicSession?: string;
  termYear?: string;
  averagePercentage: number;
  overallGrade: string;
  position: number;
  totalStudentsInClass: number;
  totalScore?: number;
  items?: SubjectScore[];
  subjects?: SubjectScore[];
  teacherRemarks?: string | null;
  principalRemarks?: string | null;
  status?: string;
  generatedAt?: string;
  classStatistics?: {
    highestScore: number;
    lowestScore: number;
    classAverage: number;
    totalStudents: number;
  };
  attendance?: AttendanceSummary;
  affectiveTraits?: AffectiveTraits;
  psychomotorSkills?: PsychomotorSkills;
  dateIssued?: string;
  nextTermBegins?: string;
  teacherName?: string;
  principalName?: string;
  gender?: string;
  dateOfBirth?: string;
  age?: number | string | null;
  height?: string;
  weight?: string;
  club?: string;
  favouriteColor?: string;
  teacherSignatureUrl?: string | null;
  principalSignatureUrl?: string | null;
}

export interface BaileysReportTemplateProps {
  reportCard: ReportCardData;
  testWeight?: number;
  examWeight?: number;
  schoolName?: string;
  schoolAddress?: string;
  schoolPhone?: string;
  schoolEmail?: string;
  schoolMotto?: string;
  schoolLogo?: string;
}
