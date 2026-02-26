import { forwardRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import logoPath from '@assets/school-logo.png';

interface SubjectScore {
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
}

interface AttendanceSummary {
  timesSchoolOpened: number;
  timesPresent: number;
  timesAbsent: number;
  attendancePercentage?: number;
}

interface AffectiveTraits {
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

interface PsychomotorSkills {
  handlingOfTools?: number;
  drawingPainting?: number;
  handwriting?: number;
  publicSpeaking?: number;
  speechFluency?: number;
  sports?: number;
  musicalSkills?: number;
  creativity?: number;
}

interface ReportCardData {
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
  height?: string;
  weight?: string;
  club?: string;
}

interface BaileysReportTemplateProps {
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

const getRemarkFromGrade = (grade: string): string => {
  if (!grade) return '';
  const g = grade.toUpperCase();
  if (g === 'A' || g === 'A+') return 'EXCELLENT';
  if (g === 'B' || g === 'B+') return 'VERY GOOD';
  if (g === 'C' || g === 'C+') return 'GOOD';
  if (g === 'D' || g === 'D+') return 'PASS';
  if (g === 'E') return 'FAIR';
  return 'WEAK';
};

const formatPosition = (pos: number): string => {
  if (!pos) return '-';
  if (pos >= 11 && pos <= 13) return `${pos}th`;
  switch (pos % 10) {
    case 1: return `${pos}st`;
    case 2: return `${pos}nd`;
    case 3: return `${pos}rd`;
    default: return `${pos}th`;
  }
};

const getGradeFromScore = (score: number): string => {
  if (score >= 70) return 'A';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C';
  if (score >= 40) return 'D';
  if (score >= 30) return 'E';
  return 'F';
};

const countGrades = (subjects: SubjectScore[]) => {
  const counts = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
  subjects.forEach(s => {
    const g = s.grade?.toUpperCase()?.charAt(0);
    if (g && g in counts) {
      counts[g as keyof typeof counts]++;
    }
  });
  return counts;
};

export const BaileysReportTemplate = forwardRef<HTMLDivElement, BaileysReportTemplateProps>(({
  reportCard,
  testWeight = 40,
  examWeight = 60,
  schoolName: propSchoolName,
  schoolAddress: propSchoolAddress,
  schoolPhone: propSchoolPhone,
  schoolEmail: propSchoolEmail,
  schoolMotto: propSchoolMotto,
  schoolLogo: customLogo
}, ref) => {
  const { data: settings } = useQuery<any>({
    queryKey: ["/api/public/settings"],
  });

  const schoolName = propSchoolName || settings?.schoolName || "";
  const schoolAddress = propSchoolAddress || settings?.schoolAddress || "";
  const schoolEmails = settings?.schoolEmails || [];
  const schoolPhones = settings?.schoolPhones || [];
  
  const schoolEmail = propSchoolEmail || (Array.isArray(schoolEmails) && schoolEmails.length > 0 ? schoolEmails[0] : "");
  const schoolPhone = propSchoolPhone || (Array.isArray(schoolPhones) && schoolPhones.length > 0 
    ? (typeof schoolPhones[0] === 'object' ? `${schoolPhones[0].countryCode || ''}${schoolPhones[0].number || ''}` : schoolPhones[0])
    : "");
    
  const schoolMotto = propSchoolMotto || settings?.schoolMotto || "";
  const subjects = reportCard.items || reportCard.subjects || [];
  const displayLogo = customLogo || logoPath;
  const totalObtained = subjects.reduce((sum, s) => sum + (s.obtainedMarks || 0), 0);
  const totalMax = subjects.length * 100;
  const avgPercentage = reportCard.averagePercentage || (totalMax > 0 ? Math.round((totalObtained / totalMax) * 100 * 10) / 10 : 0);
  const overallGrade = reportCard.overallGrade || getGradeFromScore(avgPercentage);
  const gradeCounts = countGrades(subjects);
  
  const attendance = reportCard.attendance || {
    timesSchoolOpened: 0,
    timesPresent: 0,
    timesAbsent: 0,
    attendancePercentage: 0
  };

  const affectiveTraits = reportCard.affectiveTraits || {};
  const psychomotorSkills = reportCard.psychomotorSkills || {};

  const affectiveLabels = [
    { key: 'attentiveness', label: 'Attentiveness' },
    { key: 'honesty', label: 'Honesty' },
    { key: 'neatness', label: 'Neatness' },
    { key: 'politeness', label: 'Politeness' },
    { key: 'punctuality', label: 'Punctuality/Assembly' },
    { key: 'selfControl', label: 'Self Control/ Calmness' },
    { key: 'obedience', label: 'Obedience' },
    { key: 'reliability', label: 'Reliability' },
    { key: 'senseOfResponsibility', label: 'Sense Of Responsibility' },
    { key: 'relationshipWithOthers', label: 'Relationship With Others' },
  ];

  const psychomotorLabels = [
    { key: 'handlingOfTools', label: 'Handling Of Tools' },
    { key: 'drawingPainting', label: 'Drawing/ Painting' },
    { key: 'handwriting', label: 'Handwriting' },
    { key: 'publicSpeaking', label: 'Public Speaking' },
    { key: 'speechFluency', label: 'Speech Fluency' },
    { key: 'sports', label: 'Sports & Games' },
  ];

  const RatingCell = ({ value }: { value: number | undefined }) => {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1px' }}>
        {[5, 4, 3, 2, 1].map((n) => (
          <div
            key={n}
            style={{
              width: '14px',
              height: '14px',
              border: '1px solid #6b7280',
              fontSize: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: value && value >= n ? '#1f2937' : '#ffffff',
              color: value && value >= n ? '#ffffff' : '#000000',
            }}
          >
            {n}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div 
      ref={ref}
      style={{ 
        width: '210mm', 
        minHeight: '297mm',
        maxWidth: '210mm',
        margin: '0 auto',
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        color: '#000000',
        padding: '8mm',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '10px',
        lineHeight: '1.3',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      } as React.CSSProperties}
    >
      {/* School Header */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #1f2937', paddingBottom: '8px', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <img 
            src={displayLogo} 
            alt="School Logo" 
            style={{ height: '50px', width: '50px', objectFit: 'contain' }}
            crossOrigin="anonymous"
          />
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '1px', color: '#111827', fontFamily: 'Times New Roman, serif', margin: 0 }}>
              {schoolName}
            </h1>
            <p style={{ fontSize: '9px', color: '#374151', margin: '2px 0' }}>{schoolAddress}</p>
            <p style={{ fontSize: '9px', color: '#4b5563', margin: 0 }}>Contact: {schoolPhone}; Email: {schoolEmail}</p>
          </div>
        </div>
        <div style={{ marginTop: '6px', backgroundColor: '#f3f4f6', padding: '4px 12px', display: 'inline-block' }}>
          <span style={{ fontWeight: 'bold', fontSize: '11px', letterSpacing: '0.5px' }}>
            {reportCard.termName?.toUpperCase() || 'FIRST TERM'} STUDENT'S PERFORMANCE REPORT
          </span>
        </div>
      </div>

      {/* Student Information Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px', fontSize: '9px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 600, minWidth: '50px' }}>NAME:</span>
            <span style={{ textTransform: 'uppercase', borderBottom: '1px solid #9ca3af', flex: 1, paddingBottom: '1px' }}>{reportCard.studentName}</span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '4px', flex: 1, alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600 }}>CLASS:</span>
              <span style={{ borderBottom: '1px solid #9ca3af', flex: 1, paddingBottom: '1px' }}>{reportCard.className}{reportCard.classArm ? ` ${reportCard.classArm}` : ''}</span>
            </div>
            <div style={{ display: 'flex', gap: '4px', flex: 1, alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600 }}>SESSION:</span>
              <span style={{ borderBottom: '1px solid #9ca3af', flex: 1, paddingBottom: '1px' }}>{reportCard.academicSession || reportCard.termYear || '2024/2025'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '4px', flex: 1, alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600 }}>D.O.B:</span>
              <span style={{ borderBottom: '1px solid #9ca3af', flex: 1, paddingBottom: '1px' }}>{reportCard.dateOfBirth || '-'}</span>
            </div>
            <div style={{ display: 'flex', gap: '4px', flex: 1, alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600 }}>AGE:</span>
              <span style={{ borderBottom: '1px solid #9ca3af', flex: 1, paddingBottom: '1px' }}>{'-'}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '4px', flex: 1, alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600 }}>GENDER:</span>
              <span style={{ borderBottom: '1px solid #9ca3af', flex: 1, paddingBottom: '1px' }}>{reportCard.gender || '-'}</span>
            </div>
            <div style={{ display: 'flex', gap: '4px', flex: 1, alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600 }}>ADMISSION NO:</span>
              <span style={{ borderBottom: '1px solid #9ca3af', flex: 1, paddingBottom: '1px' }}>{reportCard.admissionNumber}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '4px', flex: 1, alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600 }}>HT:</span>
              <span style={{ borderBottom: '1px solid #9ca3af', paddingBottom: '1px' }}>{reportCard.height || '-'} cm</span>
            </div>
            <div style={{ display: 'flex', gap: '4px', flex: 1, alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600 }}>WT:</span>
              <span style={{ borderBottom: '1px solid #9ca3af', paddingBottom: '1px' }}>{reportCard.weight || '-'} kg</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 600 }}>CLUB/SOCIETY:</span>
            <span style={{ borderBottom: '1px solid #9ca3af', flex: 1, paddingBottom: '1px' }}>{reportCard.club || '-'}</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {/* Left Column - Cognitive Domain */}
        <div style={{ flex: 1 }}>
          <div style={{ border: '1px solid #1f2937' }}>
            <div style={{ backgroundColor: '#e5e7eb', textAlign: 'center', padding: '3px', fontWeight: 'bold', borderBottom: '1px solid #1f2937', fontSize: '9px' }}>
              COGNITIVE DOMAIN
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  <th style={{ border: '1px solid #9ca3af', padding: '3px', textAlign: 'left', fontWeight: 600 }}>SUBJECTS</th>
                  <th style={{ border: '1px solid #9ca3af', padding: '3px', textAlign: 'center', fontWeight: 600, width: '28px' }}>C.A</th>
                  <th style={{ border: '1px solid #9ca3af', padding: '3px', textAlign: 'center', fontWeight: 600, width: '28px' }}>EXAM</th>
                  <th style={{ border: '1px solid #9ca3af', padding: '3px', textAlign: 'center', fontWeight: 600, width: '32px' }}>TOTAL</th>
                  <th style={{ border: '1px solid #9ca3af', padding: '3px', textAlign: 'center', fontWeight: 600, width: '32px' }}>GRADE</th>
                  <th style={{ border: '1px solid #9ca3af', padding: '3px', textAlign: 'center', fontWeight: 600, width: '28px' }}>POS</th>
                  <th style={{ border: '1px solid #9ca3af', padding: '3px', textAlign: 'center', fontWeight: 600 }}>REMARKS</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject, idx) => {
                  const testScore = subject.testScore ?? subject.testWeightedScore ?? 0;
                  const examScore = subject.examScore ?? subject.examWeightedScore ?? 0;
                  const total = subject.obtainedMarks || (Number(testScore) + Number(examScore));
                  return (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                      <td style={{ border: '1px solid #9ca3af', padding: '3px', fontWeight: 500, textTransform: 'uppercase' }}>{subject.subjectName}</td>
                      <td style={{ border: '1px solid #9ca3af', padding: '3px', textAlign: 'center' }}>{testScore}</td>
                      <td style={{ border: '1px solid #9ca3af', padding: '3px', textAlign: 'center' }}>{examScore}</td>
                      <td style={{ border: '1px solid #9ca3af', padding: '3px', textAlign: 'center', fontWeight: 600 }}>{total}</td>
                      <td style={{ border: '1px solid #9ca3af', padding: '3px', textAlign: 'center', fontWeight: 600 }}>{subject.grade || '-'}</td>
                      <td style={{ border: '1px solid #9ca3af', padding: '3px', textAlign: 'center' }}>{subject.subjectPosition || '-'}</td>
                      <td style={{ border: '1px solid #9ca3af', padding: '3px', textAlign: 'center', fontSize: '7px' }}>{subject.remarks || getRemarkFromGrade(subject.grade)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Performance Summary */}
          <div style={{ border: '1px solid #1f2937', marginTop: '6px' }}>
            <div style={{ backgroundColor: '#e5e7eb', textAlign: 'center', padding: '3px', fontWeight: 'bold', borderBottom: '1px solid #1f2937', fontSize: '9px' }}>
              PERFORMANCE SUMMARY
            </div>
            <div style={{ padding: '6px', fontSize: '9px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Obtained:</span>
                <span style={{ fontWeight: 'bold' }}>{totalObtained}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>%AGE:</span>
                <span style={{ fontWeight: 'bold' }}>{avgPercentage}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Obtainable:</span>
                <span style={{ fontWeight: 'bold' }}>{totalMax}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>GRADE:</span>
                <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{overallGrade}</span>
              </div>
            </div>
            <div style={{ borderTop: '1px solid #9ca3af', padding: '4px', textAlign: 'center' }}>
              <span style={{ fontWeight: 'bold', fontSize: '10px' }}>{getRemarkFromGrade(overallGrade)}</span>
            </div>
          </div>

          {/* Grade Scale */}
          <div style={{ border: '1px solid #1f2937', marginTop: '6px' }}>
            <div style={{ backgroundColor: '#e5e7eb', textAlign: 'center', padding: '3px', fontWeight: 'bold', borderBottom: '1px solid #1f2937', fontSize: '8px' }}>
              GRADE SCALE
            </div>
            <div style={{ padding: '4px', fontSize: '7px', textAlign: 'center' }}>
              70-100%=A(EXCELLENT) 60-69%=B(VERY GOOD) 50-59%=C(GOOD) 40-49%=D(PASS) 30-39%=E(FAIR) 0-29%=F(WEAK)
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ width: '170px', flexShrink: 0 }}>
          {/* Student Photo Placeholder */}
          <div style={{ border: '1px solid #1f2937', height: '70px', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
            {reportCard.studentPhoto ? (
              <img 
                src={reportCard.studentPhoto} 
                alt={reportCard.studentName}
                style={{ height: '100%', width: '100%', objectFit: 'cover' }}
                crossOrigin="anonymous"
              />
            ) : (
              <span style={{ color: '#9ca3af', fontSize: '9px' }}>Photo</span>
            )}
          </div>

          {/* Attendance Summary */}
          <div style={{ border: '1px solid #1f2937', marginBottom: '6px' }}>
            <div style={{ backgroundColor: '#e5e7eb', textAlign: 'center', padding: '3px', fontWeight: 'bold', borderBottom: '1px solid #1f2937', fontSize: '8px' }}>
              ATTENDANCE SUMMARY
            </div>
            <div style={{ fontSize: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px', borderBottom: '1px solid #d1d5db' }}>
                <span>No of Times School Opened</span>
                <span style={{ fontWeight: 'bold' }}>{attendance.timesSchoolOpened}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px', borderBottom: '1px solid #d1d5db' }}>
                <span>No of Times Present</span>
                <span style={{ fontWeight: 'bold' }}>{attendance.timesPresent}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px', borderBottom: '1px solid #d1d5db' }}>
                <span>No of Times Absent</span>
                <span style={{ fontWeight: 'bold' }}>{attendance.timesAbsent}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px' }}>
                <span>Attendance %</span>
                <span style={{ fontWeight: 'bold' }}>{attendance.attendancePercentage || (attendance.timesSchoolOpened > 0 ? Math.round((attendance.timesPresent / attendance.timesSchoolOpened) * 100) : 0)}%</span>
              </div>
            </div>
          </div>

          {/* Affective Domain */}
          <div style={{ border: '1px solid #1f2937', marginBottom: '6px' }}>
            <div style={{ backgroundColor: '#e5e7eb', textAlign: 'center', padding: '3px', fontWeight: 'bold', borderBottom: '1px solid #1f2937', fontSize: '8px' }}>
              AFFECTIVE DOMAIN
            </div>
            <table style={{ width: '100%', fontSize: '7px', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: '1px solid #d1d5db', padding: '2px', textAlign: 'left' }}></th>
                  <th style={{ borderBottom: '1px solid #d1d5db', padding: '2px', textAlign: 'center' }}>5 4 3 2 1</th>
                </tr>
              </thead>
              <tbody>
                {affectiveLabels.map(({ key, label }) => (
                  <tr key={key}>
                    <td style={{ padding: '2px', borderBottom: '1px solid #e5e7eb', fontSize: '7px' }}>{label}</td>
                    <td style={{ padding: '2px', borderBottom: '1px solid #e5e7eb' }}>
                      <RatingCell value={affectiveTraits[key as keyof AffectiveTraits]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Psychomotor Domain */}
          <div style={{ border: '1px solid #1f2937', marginBottom: '6px' }}>
            <div style={{ backgroundColor: '#e5e7eb', textAlign: 'center', padding: '3px', fontWeight: 'bold', borderBottom: '1px solid #1f2937', fontSize: '8px' }}>
              PSYCHOMOTOR DOMAIN
            </div>
            <table style={{ width: '100%', fontSize: '7px', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: '1px solid #d1d5db', padding: '2px', textAlign: 'left' }}></th>
                  <th style={{ borderBottom: '1px solid #d1d5db', padding: '2px', textAlign: 'center' }}>5 4 3 2 1</th>
                </tr>
              </thead>
              <tbody>
                {psychomotorLabels.map(({ key, label }) => (
                  <tr key={key}>
                    <td style={{ padding: '2px', borderBottom: '1px solid #e5e7eb', fontSize: '7px' }}>{label}</td>
                    <td style={{ padding: '2px', borderBottom: '1px solid #e5e7eb' }}>
                      <RatingCell value={psychomotorSkills[key as keyof PsychomotorSkills]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Rating Indices */}
          <div style={{ border: '1px solid #1f2937', marginBottom: '6px', fontSize: '6px', padding: '4px' }}>
            <div style={{ fontWeight: 'bold', textAlign: 'center', borderBottom: '1px solid #d1d5db', paddingBottom: '2px', marginBottom: '2px' }}>Rating Indices</div>
            <div>5 - Maintains an Excellent degree of Observable traits.</div>
            <div>4 - Maintains a High level of Observable traits.</div>
            <div>3 - Acceptable level of Observable traits.</div>
            <div>2 - Shows Minimal regard for Observable traits.</div>
            <div>1 - Has No regard for Observable traits.</div>
          </div>

          {/* Grade Analysis */}
          <div style={{ border: '1px solid #1f2937' }}>
            <div style={{ backgroundColor: '#e5e7eb', textAlign: 'center', padding: '3px', fontWeight: 'bold', borderBottom: '1px solid #1f2937', fontSize: '8px' }}>
              GRADE ANALYSIS
            </div>
            <table style={{ width: '100%', fontSize: '8px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  <th style={{ border: '1px solid #d1d5db', padding: '2px' }}>GRADE</th>
                  <th style={{ border: '1px solid #d1d5db', padding: '2px' }}>A</th>
                  <th style={{ border: '1px solid #d1d5db', padding: '2px' }}>B</th>
                  <th style={{ border: '1px solid #d1d5db', padding: '2px' }}>C</th>
                  <th style={{ border: '1px solid #d1d5db', padding: '2px' }}>D</th>
                  <th style={{ border: '1px solid #d1d5db', padding: '2px' }}>E</th>
                  <th style={{ border: '1px solid #d1d5db', padding: '2px' }}>F</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #d1d5db', padding: '2px', textAlign: 'center', fontWeight: 600 }}>No.</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '2px', textAlign: 'center' }}>{gradeCounts.A}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '2px', textAlign: 'center' }}>{gradeCounts.B}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '2px', textAlign: 'center' }}>{gradeCounts.C}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '2px', textAlign: 'center' }}>{gradeCounts.D}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '2px', textAlign: 'center' }}>{gradeCounts.E}</td>
                  <td style={{ border: '1px solid #d1d5db', padding: '2px', textAlign: 'center' }}>{gradeCounts.F}</td>
                </tr>
              </tbody>
            </table>
            <div style={{ textAlign: 'center', padding: '3px', borderTop: '1px solid #d1d5db', fontWeight: 600, fontSize: '8px' }}>
              TOTAL SUBJECTS OFFERED: {subjects.length}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section - Remarks and Signatures */}
      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {/* Teacher's Remark */}
        <div style={{ border: '1px solid #1f2937' }}>
          <div style={{ display: 'flex' }}>
            <div style={{ backgroundColor: '#e5e7eb', padding: '4px', fontWeight: 'bold', fontSize: '9px', width: '80px', borderRight: '1px solid #1f2937', flexShrink: 0 }}>Teacher's Remark:</div>
            <div style={{ padding: '4px', flex: 1, minHeight: '20px', fontSize: '9px', fontStyle: 'italic' }}>
              {reportCard.teacherRemarks || 'A bright, diligent and studious student. Always inquisitive and ready to learn.'}
            </div>
          </div>
        </div>

        {/* Teacher's Signature */}
        <div style={{ display: 'flex', gap: '12px', fontSize: '9px', alignItems: 'baseline' }}>
          <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
            <span style={{ fontWeight: 600 }}>Teacher's Name:</span>
            <span style={{ borderBottom: '1px solid #9ca3af', flex: 1, textTransform: 'uppercase' }}>{reportCard.teacherName || ''}</span>
          </div>
          <div style={{ display: 'flex', gap: '4px', width: '100px' }}>
            <span style={{ fontWeight: 600 }}>Sign:</span>
            <span style={{ borderBottom: '1px solid #9ca3af', flex: 1 }}></span>
          </div>
        </div>

        {/* Principal's Remark */}
        <div style={{ border: '1px solid #1f2937' }}>
          <div style={{ display: 'flex' }}>
            <div style={{ backgroundColor: '#e5e7eb', padding: '4px', fontWeight: 'bold', fontSize: '9px', width: '80px', borderRight: '1px solid #1f2937', flexShrink: 0 }}>Principal's Remark:</div>
            <div style={{ padding: '4px', flex: 1, minHeight: '20px', fontSize: '9px', fontStyle: 'italic' }}>
              {reportCard.principalRemarks || 'An outstanding result!! You should keep it up'}
            </div>
          </div>
        </div>

        {/* Principal's Signature */}
        <div style={{ display: 'flex', gap: '12px', fontSize: '9px', alignItems: 'baseline' }}>
          <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
            <span style={{ fontWeight: 600 }}>Principal's Name:</span>
            <span style={{ borderBottom: '1px solid #9ca3af', flex: 1, textTransform: 'uppercase' }}>{reportCard.principalName || ''}</span>
          </div>
          <div style={{ display: 'flex', gap: '4px', width: '100px' }}>
            <span style={{ fontWeight: 600 }}>Sign:</span>
            <span style={{ borderBottom: '1px solid #9ca3af', flex: 1 }}></span>
          </div>
        </div>

        {/* Next Term and Date */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', borderTop: '1px solid #9ca3af', paddingTop: '6px', marginTop: '4px' }}>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 600 }}>Next Term Begins:</span>
            <span style={{ borderBottom: '1px solid #9ca3af', minWidth: '80px' }}>{reportCard.nextTermBegins || ''}</span>
          </div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 600 }}>Date:</span>
            <span style={{ borderBottom: '1px solid #9ca3af', minWidth: '80px' }}>{reportCard.dateIssued || new Date().toLocaleDateString()}</span>
          </div>
        </div>

        {/* Position Summary */}
        <div style={{ textAlign: 'center', border: '1px solid #1f2937', padding: '6px', backgroundColor: '#f9fafb', marginTop: '4px' }}>
          <span style={{ fontWeight: 'bold', fontSize: '11px' }}>
            CLASS POSITION: {formatPosition(reportCard.position)} out of {reportCard.totalStudentsInClass} Students
          </span>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: '7px', color: '#6b7280', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #d1d5db' }}>
          <p style={{ fontStyle: 'italic', margin: 0 }}>"{schoolMotto}"</p>
          <p style={{ margin: '2px 0 0 0' }}>{schoolName} - {schoolAddress}</p>
        </div>
      </div>
    </div>
  );
});

BaileysReportTemplate.displayName = 'BaileysReportTemplate';

export default BaileysReportTemplate;
