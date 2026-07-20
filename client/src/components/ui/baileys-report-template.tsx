import { forwardRef, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ContactUtils } from '@shared/contact-utils';
import { imageUrlToBase64 } from '@/lib/report-export-utils';

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
  classAverage?: number | null;
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
  age?: number | string | null;
  height?: string;
  weight?: string;
  club?: string;
  favouriteColor?: string;
  teacherSignatureUrl?: string | null;
  principalSignatureUrl?: string | null;
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

// ─── Utility functions ───
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
    if (g && g in counts) counts[g as keyof typeof counts]++;
  });
  return counts;
};

// ─── Layout constants ───
const B = '1px solid #000';
const BL = '1px solid #555';
const FONT = '"Arial Narrow", Arial, Helvetica, sans-serif';
const MIN_ROWS = 20;
const GAP = 5;

// ─── Shared inline styles (no flexbox — html2canvas compatible) ───
const sectionHeader: React.CSSProperties = {
  backgroundColor: '#ddd', textAlign: 'center', padding: '4px 0',
  fontWeight: 'bold', fontSize: 9, borderBottom: B, letterSpacing: 1,
};

/* Label cell: grey background, bordered */
const labelCell: React.CSSProperties = {
  padding: '3px 6px', fontSize: 9, fontWeight: 700,
  verticalAlign: 'middle', whiteSpace: 'nowrap',
  backgroundColor: '#f0f0f0', border: BL,
};

/* Value cell: white background, bordered */
const valueCell: React.CSSProperties = {
  padding: '3px 6px', fontSize: 9, fontWeight: 500,
  verticalAlign: 'middle', border: BL,
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
  const primaryPhone = ContactUtils.getFormattedPrimaryPhone(settings);
  const primaryEmail = ContactUtils.getPrimaryEmail(settings);
  const phonesList = ContactUtils.getPhones(settings);
  const allPhones = phonesList.length > 0
    ? phonesList.map(p => `${p.countryCode}${p.number}`).join(', ') : "";
  const schoolEmail = propSchoolEmail || primaryEmail;
  const schoolPhone = propSchoolPhone || (phonesList.length > 1 ? allPhones : primaryPhone);
  const schoolMotto = propSchoolMotto || settings?.schoolMotto || "";
  const displayLogo = customLogo || settings?.schoolLogo || "";

  // Pre-convert photo, logo, and signatures to base64 so they render correctly in
  // html-to-image exports, PDF captures, and print windows (all of which
  // cannot resolve relative URLs once the DOM is serialised / captured).
  const [photoSrc, setPhotoSrc] = useState<string>('');
  const [logoSrc, setLogoSrc] = useState<string>('');
  const [teacherSigSrc, setTeacherSigSrc] = useState<string>('');
  const [principalSigSrc, setPrincipalSigSrc] = useState<string>('');

  useEffect(() => {
    if (reportCard.studentPhoto) {
      imageUrlToBase64(reportCard.studentPhoto).then(setPhotoSrc);
    } else {
      setPhotoSrc('');
    }
  }, [reportCard.studentPhoto]);

  useEffect(() => {
    if (displayLogo) {
      imageUrlToBase64(displayLogo).then(setLogoSrc);
    } else {
      setLogoSrc('');
    }
  }, [displayLogo]);

  useEffect(() => {
    if (reportCard.teacherSignatureUrl) {
      imageUrlToBase64(reportCard.teacherSignatureUrl).then(setTeacherSigSrc);
    } else {
      setTeacherSigSrc('');
    }
  }, [reportCard.teacherSignatureUrl]);

  useEffect(() => {
    if (reportCard.principalSignatureUrl) {
      imageUrlToBase64(reportCard.principalSignatureUrl).then(setPrincipalSigSrc);
    } else {
      setPrincipalSigSrc('');
    }
  }, [reportCard.principalSignatureUrl]);

  const subjects = reportCard.items || reportCard.subjects || [];
  const totalObtained = subjects.reduce((sum, s) => sum + (s.obtainedMarks || 0), 0);
  const totalMax = subjects.length * 100;
  const avgPct = reportCard.averagePercentage ||
    (totalMax > 0 ? Math.round((totalObtained / totalMax) * 1000) / 10 : 0);
  const overallGrade = reportCard.overallGrade || getGradeFromScore(avgPct);
  const gradeCounts = countGrades(subjects);

  const att = reportCard.attendance || { timesSchoolOpened: 0, timesPresent: 0, timesAbsent: 0, attendancePercentage: 0 };
  const attPct = att.attendancePercentage ||
    (att.timesSchoolOpened > 0 ? Math.round((att.timesPresent / att.timesSchoolOpened) * 1000) / 10 : 0);

  const aff = reportCard.affectiveTraits || {};
  const psy = reportCard.psychomotorSkills || {};

  const affLabels = [
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

  const psyLabels = [
    { key: 'handlingOfTools', label: 'Handling Of Tools' },
    { key: 'drawingPainting', label: 'Drawing/ Painting' },
    { key: 'handwriting', label: 'Handwriting' },
    { key: 'publicSpeaking', label: 'Public Speaking' },
    { key: 'speechFluency', label: 'Speech Fluency' },
    { key: 'sports', label: 'Sports & Games' },
  ];

  const emptyRows = Array.from({ length: Math.max(0, MIN_ROWS - subjects.length) });

  /* ── Rating cell — inline-block boxes (NO flexbox) ── */
  const ratingBoxes = (value: number | undefined) => (
    <td style={{ border: BL, padding: '1px 2px', textAlign: 'center', verticalAlign: 'middle' }}>
      {[5, 4, 3, 2, 1].map(n => (
        <span key={n} style={{
          display: 'inline-block', width: 12, height: 12, border: '1px solid #333',
          fontSize: 7, textAlign: 'center', lineHeight: '12px',
          backgroundColor: value && value >= n ? '#222' : '#fff',
          color: value && value >= n ? '#fff' : '#333',
          fontWeight: 700, verticalAlign: 'middle',
        }}>
          {n}
        </span>
      ))}
    </td>
  );

  return (
    <div ref={ref} style={{
      width: '210mm', minHeight: '297mm', maxWidth: '210mm',
      margin: '0 auto', boxSizing: 'border-box',
      backgroundColor: '#fff', color: '#000',
      padding: '5mm 7mm',
      fontFamily: FONT, fontSize: 9, lineHeight: 1.3,
      WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
    } as React.CSSProperties}>

      {/* ═══════════ HEADER ═══════════ */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 6 }}>
        <tbody><tr>
          <td style={{ verticalAlign: 'middle', paddingRight: 10 }}>
            <div style={{ fontFamily: '"Times New Roman", Georgia, serif', fontSize: 24, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', lineHeight: 1.15, marginBottom: 4 }}>
              {schoolName}
            </div>
            <div style={{ fontSize: 10, marginBottom: 3, fontStyle: 'italic', color: '#222' }}>{schoolAddress}</div>
            <div style={{ fontSize: 9, color: '#333' }}>
              TEL: {schoolPhone}{schoolEmail ? `  |  Email: ${schoolEmail}` : ''}
            </div>
          </td>
          <td style={{ width: 70, verticalAlign: 'middle', textAlign: 'right' }}>
            {logoSrc && (
              <img src={logoSrc} alt="Logo" style={{ height: 65, width: 65, objectFit: 'contain' }} />
            )}
          </td>
        </tr></tbody>
      </table>
      <div style={{ borderBottom: '2.5px solid #000', marginBottom: 6 }} />

      {/* Term title */}
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 12, letterSpacing: 0.5, marginBottom: 8 }}>
        {(reportCard.termName || 'FIRST TERM').toUpperCase()} STUDENT'S PERFORMANCE REPORT
      </div>

      {/* ═══════════ STUDENT INFO — bordered grid ═══════════ */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: GAP, border: B }}>
        <tbody><tr>
          {/* Student fields (left) */}
          <td style={{ padding: 0, verticalAlign: 'top' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '15%' }} />
                <col style={{ width: '35%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '35%' }} />
              </colgroup>
              <tbody>
                {/* Row 1: NAME | value | GENDER | value */}
                <tr>
                  <td style={labelCell}>NAME:</td>
                  <td style={{ ...valueCell, textTransform: 'uppercase', fontWeight: 600 }} colSpan={1}>
                    {reportCard.studentName.toUpperCase()}
                  </td>
                  <td style={labelCell}>GENDER:</td>
                  <td style={valueCell}>{(reportCard.gender || '-').toUpperCase()}</td>
                </tr>
                {/* Row 2: CLASS | value | SESSION | value */}
                <tr>
                  <td style={labelCell}>CLASS:</td>
                  <td style={valueCell}>{reportCard.className}{reportCard.classArm ? ' ' + reportCard.classArm : ''}</td>
                  <td style={labelCell}>SESSION:</td>
                  <td style={valueCell}>{reportCard.academicSession || reportCard.termYear || '2024/2025'}</td>
                </tr>
                {/* Row 3: ADMISSION NO | value (spans 3 cols) */}
                <tr>
                  <td style={labelCell}>ADMISSION NO:</td>
                  <td style={valueCell} colSpan={3}>{reportCard.admissionNumber}</td>
                </tr>
              </tbody>
            </table>
            {/* Row 4: D.O.B | AGE | HT | WT — 8 columns */}
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '10%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '22%' }} />
              </colgroup>
              <tbody><tr>
                <td style={labelCell}>D.O.B.:</td>
                <td style={valueCell}>{reportCard.dateOfBirth || '-'}</td>
                <td style={labelCell}>AGE:</td>
                <td style={valueCell}>{reportCard.age != null ? `${reportCard.age} yrs` : '-'}</td>
                <td style={labelCell}>HT:</td>
                <td style={valueCell}>{reportCard.height || '-'}</td>
                <td style={labelCell}>WT:</td>
                <td style={valueCell}>{reportCard.weight || '-'}</td>
              </tr></tbody>
            </table>
            {/* Row 5: CLUB/SOCIETY | FAV. COL */}
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '15%' }} />
                <col style={{ width: '35%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '35%' }} />
              </colgroup>
              <tbody><tr>
                <td style={labelCell}>CLUB/SOCIETY:</td>
                <td style={valueCell}>{reportCard.club || '-'}</td>
                <td style={labelCell}>FAV. COL:</td>
                <td style={valueCell}>{reportCard.favouriteColor || '-'}</td>
              </tr></tbody>
            </table>
          </td>
          {/* Photo (right) */}
          <td style={{ width: 75, verticalAlign: 'top', padding: 5, borderLeft: B }}>
            <div style={{ width: 64, height: 76, border: B, overflow: 'hidden', backgroundColor: '#f8f8f8', textAlign: 'center', lineHeight: '76px' }}>
              {photoSrc ? (
                <img src={photoSrc} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover', verticalAlign: 'middle' }} />
              ) : (
                <span style={{ color: '#aaa', fontSize: 8, lineHeight: '76px' }}>Photo</span>
              )}
            </div>
          </td>
        </tr></tbody>
      </table>

      {/* ═══════════ MAIN 2‑COLUMN LAYOUT ═══════════ */}
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '73%' }} />
          <col style={{ width: '27%' }} />
        </colgroup>
        <tbody><tr>
          {/* ────── LEFT: Cognitive Domain ────── */}
          <td style={{ verticalAlign: 'top', paddingRight: 5 }}>

            <table style={{ width: '100%', borderCollapse: 'collapse', border: B, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '27%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '9%' }} />
              </colgroup>
              <thead>
                <tr><th colSpan={9} style={sectionHeader}>COGNITIVE DOMAIN</th></tr>
                <tr style={{ backgroundColor: '#eee' }}>
                  <th rowSpan={2} style={{ border: B, padding: '3px 4px', textAlign: 'left', fontWeight: 700, fontSize: 8 }}>SUBJECTS</th>
                  <th style={{ border: B, padding: '2px', textAlign: 'center', fontWeight: 700, fontSize: 8, borderBottom: 'none' }}>C.A</th>
                  <th style={{ border: B, padding: '2px', textAlign: 'center', fontWeight: 700, fontSize: 8, borderBottom: 'none' }}>EXAM</th>
                  <th style={{ border: B, padding: '2px', textAlign: 'center', fontWeight: 700, fontSize: 8, borderBottom: 'none' }}>TOTAL</th>
                  <th rowSpan={2} style={{ border: B, padding: '2px', textAlign: 'center', fontWeight: 700, fontSize: 8 }}>GRADE</th>
                  <th rowSpan={2} style={{ border: B, padding: '2px', textAlign: 'center', fontWeight: 700, fontSize: 7 }}>POSITION</th>
                  <th rowSpan={2} style={{ border: B, padding: '2px', textAlign: 'center', fontWeight: 700, fontSize: 7 }}>REMARKS</th>
                  <th rowSpan={2} style={{ border: B, padding: '2px', textAlign: 'center', fontWeight: 700, fontSize: 7 }}>CLASS AVG</th>
                  <th rowSpan={2} style={{ border: B, padding: '2px', textAlign: 'center', fontWeight: 700, fontSize: 7 }}>1st Term</th>
                </tr>
                <tr style={{ backgroundColor: '#eee' }}>
                  <th style={{ border: B, padding: '1px', textAlign: 'center', fontWeight: 600, fontSize: 7, borderTop: 'none' }}>{testWeight}</th>
                  <th style={{ border: B, padding: '1px', textAlign: 'center', fontWeight: 600, fontSize: 7, borderTop: 'none' }}>{examWeight}</th>
                  <th style={{ border: B, padding: '1px', textAlign: 'center', fontWeight: 600, fontSize: 7, borderTop: 'none' }}>100</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s, i) => {
                  const t = s.testWeightedScore ?? s.testScore ?? null;
                  const e = s.examWeightedScore ?? s.examScore ?? null;
                  const tot = s.obtainedMarks || ((Number(t) || 0) + (Number(e) || 0));
                  return (
                    <tr key={i}>
                      <td style={{ border: BL, padding: '3px 4px', fontSize: 8, fontWeight: 500, textTransform: 'uppercase', height: 18, verticalAlign: 'middle', wordBreak: 'break-word', lineHeight: 1.1 }}>{s.subjectName}</td>
                      <td style={{ border: BL, padding: '2px', fontSize: 8, textAlign: 'center', verticalAlign: 'middle' }}>{t !== null ? t : ''}</td>
                      <td style={{ border: BL, padding: '2px', fontSize: 8, textAlign: 'center', verticalAlign: 'middle' }}>{e !== null ? e : ''}</td>
                      <td style={{ border: BL, padding: '2px', fontSize: 8, textAlign: 'center', fontWeight: 700, verticalAlign: 'middle' }}>{tot || ''}</td>
                      <td style={{ border: BL, padding: '2px', fontSize: 8, textAlign: 'center', fontWeight: 700, verticalAlign: 'middle' }}>{s.grade || ''}</td>
                      <td style={{ border: BL, padding: '2px', fontSize: 8, textAlign: 'center', verticalAlign: 'middle' }}>{s.subjectPosition || ''}</td>
                      <td style={{ border: BL, padding: '2px', fontSize: 7, textAlign: 'center', fontStyle: 'italic', verticalAlign: 'middle', wordBreak: 'break-word', lineHeight: 1.1 }}>{s.remarks || getRemarkFromGrade(s.grade)}</td>
                      <td style={{ border: BL, padding: '2px', fontSize: 8, textAlign: 'center', verticalAlign: 'middle' }}>{s.classAverage != null ? s.classAverage : ''}</td>
                      <td style={{ border: BL, padding: '2px', fontSize: 8, textAlign: 'center', verticalAlign: 'middle' }}></td>
                    </tr>
                  );
                })}
                {emptyRows.map((_, i) => (
                  <tr key={`e${i}`}>
                    <td style={{ border: BL, height: 18 }}>&nbsp;</td>
                    <td style={{ border: BL }}>&nbsp;</td>
                    <td style={{ border: BL }}>&nbsp;</td>
                    <td style={{ border: BL }}>&nbsp;</td>
                    <td style={{ border: BL }}>&nbsp;</td>
                    <td style={{ border: BL }}>&nbsp;</td>
                    <td style={{ border: BL }}>&nbsp;</td>
                    <td style={{ border: BL }}>&nbsp;</td>
                    <td style={{ border: BL }}>&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── PERFORMANCE SUMMARY ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: B, marginTop: GAP, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '28%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '44%' }} />
              </colgroup>
              <thead>
                <tr><th colSpan={4} style={sectionHeader}>PERFORMANCE SUMMARY</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '4px 6px', fontSize: 9, borderRight: BL, verticalAlign: 'middle' }}>Total Obtained:</td>
                  <td style={{ padding: '4px 4px', fontSize: 10, fontWeight: 700, borderRight: BL, verticalAlign: 'middle' }}>{totalObtained}</td>
                  <td style={{ padding: '4px 4px', fontSize: 9, borderRight: BL, verticalAlign: 'middle' }}>%TAGE:</td>
                  <td rowSpan={2} style={{ padding: '4px', fontSize: 22, fontWeight: 900, textAlign: 'center', verticalAlign: 'middle', lineHeight: 1 }}>
                    {avgPct}%
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 6px', fontSize: 9, borderRight: BL, borderTop: BL, verticalAlign: 'middle' }}>Total Obtainable:</td>
                  <td style={{ padding: '4px 4px', fontSize: 10, fontWeight: 700, borderRight: BL, borderTop: BL, verticalAlign: 'middle' }}>{totalMax}</td>
                  <td style={{ padding: '4px 4px', fontSize: 9, borderRight: BL, borderTop: BL, verticalAlign: 'middle' }}>GRADE:</td>
                </tr>
                <tr>
                  <td colSpan={3} style={{ borderTop: B }}></td>
                  <td style={{ padding: '3px 4px', fontSize: 22, fontWeight: 900, textAlign: 'center', borderTop: B, lineHeight: 1, verticalAlign: 'middle' }}>
                    {overallGrade}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '5px 0', borderTop: B, fontWeight: 700, fontSize: 10, letterSpacing: 0.5, verticalAlign: 'middle' }}>
                    {getRemarkFromGrade(overallGrade)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── GRADE SCALE ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: B, marginTop: GAP }}>
              <thead><tr><th style={sectionHeader}>GRADE SCALE</th></tr></thead>
              <tbody><tr>
                <td style={{ padding: '4px 6px', fontSize: 7, textAlign: 'center', lineHeight: 1.5 }}>
                  70-100%=A(EXCELLENT)&ensp;60-69.9%=B(VERY GOOD)&ensp;50-59.9%=C(GOOD)&ensp;40-49.9%=D(PASS)&ensp;30-39.9%=E(FAIR)&ensp;0-29.9%=F(WEAK)
                </td>
              </tr></tbody>
            </table>
          </td>

          {/* ────── RIGHT COLUMN ────── */}
          <td style={{ verticalAlign: 'top' }}>
            {/* ── ATTENDANCE SUMMARY ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: B, marginBottom: GAP, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '68%' }} />
                <col style={{ width: '32%' }} />
              </colgroup>
              <thead><tr><th colSpan={2} style={sectionHeader}>ATTENDANCE SUMMARY</th></tr></thead>
              <tbody>
                <tr>
                  <td style={{ padding: '3px 4px', fontSize: 8, borderBottom: BL, verticalAlign: 'middle' }}>No of Times School Opened</td>
                  <td style={{ padding: '3px 4px', fontSize: 8, textAlign: 'right', fontWeight: 700, borderBottom: BL, verticalAlign: 'middle' }}>{att.timesSchoolOpened}</td>
                </tr>
                <tr>
                  <td style={{ padding: '3px 4px', fontSize: 8, borderBottom: BL, verticalAlign: 'middle' }}>No of Times Present</td>
                  <td style={{ padding: '3px 4px', fontSize: 8, textAlign: 'right', fontWeight: 700, borderBottom: BL, verticalAlign: 'middle' }}>
                    {att.timesPresent}&ensp;<span style={{ fontSize: 7, fontWeight: 400 }}>({attPct}%)</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '3px 4px', fontSize: 8, verticalAlign: 'middle' }}>No of Times Absent</td>
                  <td style={{ padding: '3px 4px', fontSize: 8, textAlign: 'right', fontWeight: 700, verticalAlign: 'middle' }}>{att.timesAbsent}</td>
                </tr>
              </tbody>
            </table>

            {/* ── AFFECTIVE DOMAIN ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: B, marginBottom: GAP, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '53%' }} />
                <col style={{ width: '47%' }} />
              </colgroup>
              <thead>
                <tr><th colSpan={2} style={sectionHeader}>AFFECTIVE DOMAIN</th></tr>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ border: BL, padding: 2, textAlign: 'left', fontSize: 7 }}></th>
                  <th style={{ border: BL, padding: 2, fontSize: 7, textAlign: 'center' }}>
                    {[5, 4, 3, 2, 1].map(n =>
                      <span key={n} style={{ display: 'inline-block', width: 12, textAlign: 'center', fontWeight: 700 }}>{n}</span>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {affLabels.map(({ key, label }) => (
                  <tr key={key}>
                    <td style={{ border: BL, padding: '2px 4px', fontSize: 7, verticalAlign: 'middle', lineHeight: 1.2 }}>{label}</td>
                    {ratingBoxes(aff[key as keyof AffectiveTraits])}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── PSYCHOMOTOR DOMAIN ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: B, marginBottom: GAP, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '53%' }} />
                <col style={{ width: '47%' }} />
              </colgroup>
              <thead>
                <tr><th colSpan={2} style={sectionHeader}>PSYCHOMOTOR DOMAIN</th></tr>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ border: BL, padding: 2, textAlign: 'left', fontSize: 7 }}></th>
                  <th style={{ border: BL, padding: 2, fontSize: 7, textAlign: 'center' }}>
                    {[5, 4, 3, 2, 1].map(n =>
                      <span key={n} style={{ display: 'inline-block', width: 12, textAlign: 'center', fontWeight: 700 }}>{n}</span>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {psyLabels.map(({ key, label }) => (
                  <tr key={key}>
                    <td style={{ border: BL, padding: '2px 4px', fontSize: 7, verticalAlign: 'middle', lineHeight: 1.2 }}>{label}</td>
                    {ratingBoxes(psy[key as keyof PsychomotorSkills])}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── RATING INDICES ── */}
            <div style={{ border: B, padding: '4px 5px', marginBottom: GAP, fontSize: 7, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, textAlign: 'center', borderBottom: BL, paddingBottom: 2, marginBottom: 2, fontSize: 8 }}>Rating Indices</div>
              <div>5 - Maintains an Excellent degree of Observable traits.</div>
              <div>4 - Maintains a High level of Observable traits.</div>
              <div>3 - Acceptable level of Observable traits.</div>
              <div>2 - Shows Minimal regard for Observable traits.</div>
              <div>1 - Has No regard for Observable traits.</div>
            </div>

            {/* ── GRADE ANALYSIS ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', border: B, tableLayout: 'fixed' }}>
              <thead>
                <tr><th colSpan={7} style={sectionHeader}>GRADE ANALYSIS</th></tr>
                <tr style={{ backgroundColor: '#eee' }}>
                  {['GRADE', 'A', 'B', 'C', 'D', 'E', 'F'].map(g => (
                    <th key={g} style={{ border: B, padding: 2, fontSize: 8, fontWeight: 700, textAlign: 'center', verticalAlign: 'middle' }}>{g}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: B, padding: 2, fontSize: 8, textAlign: 'center', fontWeight: 600, verticalAlign: 'middle' }}>No.</td>
                  {(['A', 'B', 'C', 'D', 'E', 'F'] as const).map(g => (
                    <td key={g} style={{ border: B, padding: 2, fontSize: 8, textAlign: 'center', verticalAlign: 'middle' }}>{gradeCounts[g]}</td>
                  ))}
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3px 0', borderTop: B, fontWeight: 700, fontSize: 8, letterSpacing: 0.3 }}>
                    TOTAL SUBJECTS OFFERED: {subjects.length}
                  </td>
                </tr>
              </tfoot>
            </table>
          </td>
        </tr></tbody>
      </table>

      {/* ═══════════ BOTTOM — pure tables, NO flexbox ═══════════ */}
      <div style={{ marginTop: 6 }}>
        {/* Teacher's Remark */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: B, marginBottom: GAP, tableLayout: 'fixed' }}>
          <colgroup><col style={{ width: '18%' }} /><col /></colgroup>
          <tbody><tr>
            <td style={labelCell}>Teacher's Remark:</td>
            <td style={{ ...valueCell, fontStyle: 'italic', minHeight: 24, lineHeight: 1.5, wordBreak: 'break-word' as const }}>
              {reportCard.teacherRemarks || ''}
            </td>
          </tr></tbody>
        </table>

        {/* Teacher Name + Sign — bordered grid */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: GAP, tableLayout: 'fixed', border: B }}>
          <colgroup>
            <col style={{ width: '18%' }} />
            <col style={{ width: '47%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '27%' }} />
          </colgroup>
          <tbody><tr>
            <td style={labelCell}>Teacher's Name:</td>
            <td style={{ ...valueCell, textTransform: 'uppercase', fontWeight: 600 }}>
              {reportCard.teacherName || ''}
            </td>
            <td style={labelCell}>Sign:</td>
            <td style={{ ...valueCell, minHeight: 20 }}>
              {teacherSigSrc ? (
                <img src={teacherSigSrc} alt="" style={{ height: 20, objectFit: 'contain' }} />
              ) : ''}
            </td>
          </tr></tbody>
        </table>

        {/* Principal's Remark */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: B, marginBottom: GAP, tableLayout: 'fixed' }}>
          <colgroup><col style={{ width: '18%' }} /><col /></colgroup>
          <tbody><tr>
            <td style={labelCell}>Principal's Remark:</td>
            <td style={{ ...valueCell, fontStyle: 'italic', minHeight: 24, lineHeight: 1.5, wordBreak: 'break-word' as const }}>
              {reportCard.principalRemarks || ''}
            </td>
          </tr></tbody>
        </table>

        {/* Principal Name + Sign — bordered grid */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: GAP, tableLayout: 'fixed', border: B }}>
          <colgroup>
            <col style={{ width: '18%' }} />
            <col style={{ width: '47%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '27%' }} />
          </colgroup>
          <tbody><tr>
            <td style={labelCell}>Principal's Name:</td>
            <td style={{ ...valueCell, textTransform: 'uppercase', fontWeight: 600 }}>
              {reportCard.principalName || ''}
            </td>
            <td style={labelCell}>Sign:</td>
            <td style={{ ...valueCell, minHeight: 20 }}>
              {principalSigSrc ? (
                <img src={principalSigSrc} alt="" style={{ height: 20, objectFit: 'contain' }} />
              ) : ''}
            </td>
          </tr></tbody>
        </table>

        {/* Next Term + Date — bordered grid */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: GAP, tableLayout: 'fixed', border: B }}>
          <colgroup>
            <col style={{ width: '18%' }} />
            <col style={{ width: '37%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '37%' }} />
          </colgroup>
          <tbody><tr>
            <td style={labelCell}>Next Term Begins:</td>
            <td style={valueCell}>{reportCard.nextTermBegins || ''}</td>
            <td style={labelCell}>Date:</td>
            <td style={valueCell}>{reportCard.dateIssued || new Date().toLocaleDateString()}</td>
          </tr></tbody>
        </table>

        {/* Class Position */}
        <div style={{ textAlign: 'center', border: B, padding: '7px 0', backgroundColor: '#f5f5f5', fontWeight: 900, fontSize: 12, letterSpacing: 0.5 }}>
          CLASS POSITION: {formatPosition(reportCard.position)} out of {reportCard.totalStudentsInClass} Students
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 7, color: '#666', marginTop: 5, paddingTop: 3, borderTop: '1px solid #ccc' }}>
          <div>{schoolName} &bull; {schoolAddress}</div>
          {schoolMotto && <div style={{ fontStyle: 'italic' }}>"{schoolMotto}"</div>}
        </div>
      </div>
    </div>
  );
});

BaileysReportTemplate.displayName = 'BaileysReportTemplate';

export default BaileysReportTemplate;
