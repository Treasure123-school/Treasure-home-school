/**
 * BaileysReportTemplate — main orchestrator
 *
 * This file is intentionally thin. All logic lives in sub-modules:
 *   baileys-report/types.ts          — interfaces
 *   baileys-report/styles.ts         — inline style constants
 *   baileys-report/utils.ts          — pure helper functions
 *   baileys-report/sections/
 *     ReportHeader.tsx               — school header + term title
 *     StudentInfo.tsx                — student info grid + photo
 *     CognitiveDomain.tsx            — subjects table
 *     PerformanceSummary.tsx         — performance summary + grade scale
 *     RightColumn.tsx                — attendance, affective, psychomotor, grade analysis
 *     BottomSection.tsx              — remarks, signatures, next term, footer
 */

import { forwardRef, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ContactUtils } from '@shared/contact-utils';
import { imageUrlToBase64 } from '@/lib/report-export-utils';

import type { BaileysReportTemplateProps } from './baileys-report/types';
import { FONT, MIN_ROWS } from './baileys-report/styles';
import { getGradeFromScore, countGrades } from './baileys-report/utils';

import ReportHeader from './baileys-report/sections/ReportHeader';
import StudentInfo from './baileys-report/sections/StudentInfo';
import CognitiveDomain from './baileys-report/sections/CognitiveDomain';
import PerformanceSummary from './baileys-report/sections/PerformanceSummary';
import RightColumn from './baileys-report/sections/RightColumn';
import BottomSection from './baileys-report/sections/BottomSection';

export const BaileysReportTemplate = forwardRef<HTMLDivElement, BaileysReportTemplateProps>(({
  reportCard,
  testWeight = 40,
  examWeight = 60,
  schoolName: propSchoolName,
  schoolAddress: propSchoolAddress,
  schoolPhone: propSchoolPhone,
  schoolEmail: propSchoolEmail,
  schoolMotto: propSchoolMotto,
  schoolLogo: customLogo,
}, ref) => {
  const { data: settings } = useQuery<any>({ queryKey: ['/api/public/settings'] });

  // ── Resolve school info (props override settings) ──
  const schoolName    = propSchoolName    || settings?.schoolName    || '';
  const schoolAddress = propSchoolAddress || settings?.schoolAddress || '';
  const primaryPhone  = ContactUtils.getFormattedPrimaryPhone(settings);
  const primaryEmail  = ContactUtils.getPrimaryEmail(settings);
  const phonesList    = ContactUtils.getPhones(settings);
  const allPhones     = phonesList.length > 0 ? phonesList.map(p => `${p.countryCode}${p.number}`).join(', ') : '';
  const schoolEmail   = propSchoolEmail || primaryEmail;
  const schoolPhone   = propSchoolPhone || (phonesList.length > 1 ? allPhones : primaryPhone);
  const schoolMotto   = propSchoolMotto || settings?.schoolMotto || '';
  const displayLogo   = customLogo      || settings?.schoolLogo  || '';

  // ── Pre-convert images to base64 (required for html-to-image / PDF capture) ──
  const [photoSrc,        setPhotoSrc]        = useState('');
  const [logoSrc,         setLogoSrc]         = useState('');
  const [teacherSigSrc,   setTeacherSigSrc]   = useState('');
  const [principalSigSrc, setPrincipalSigSrc] = useState('');

  useEffect(() => {
    reportCard.studentPhoto ? imageUrlToBase64(reportCard.studentPhoto).then(setPhotoSrc) : setPhotoSrc('');
  }, [reportCard.studentPhoto]);

  useEffect(() => {
    displayLogo ? imageUrlToBase64(displayLogo).then(setLogoSrc) : setLogoSrc('');
  }, [displayLogo]);

  useEffect(() => {
    reportCard.teacherSignatureUrl
      ? imageUrlToBase64(reportCard.teacherSignatureUrl).then(setTeacherSigSrc)
      : setTeacherSigSrc('');
  }, [reportCard.teacherSignatureUrl]);

  useEffect(() => {
    reportCard.principalSignatureUrl
      ? imageUrlToBase64(reportCard.principalSignatureUrl).then(setPrincipalSigSrc)
      : setPrincipalSigSrc('');
  }, [reportCard.principalSignatureUrl]);

  // ── Derived data ──
  const subjects      = reportCard.items || reportCard.subjects || [];
  const totalObtained = subjects.reduce((sum, s) => sum + (s.obtainedMarks || 0), 0);
  const totalMax      = subjects.length * 100;
  const avgPct        = reportCard.averagePercentage ||
    (totalMax > 0 ? Math.round((totalObtained / totalMax) * 1000) / 10 : 0);
  const overallGrade  = reportCard.overallGrade || getGradeFromScore(avgPct);
  const gradeCounts   = countGrades(subjects);
  const emptyRows     = Array.from({ length: Math.max(0, MIN_ROWS - subjects.length) });

  const att    = reportCard.attendance || { timesSchoolOpened: 0, timesPresent: 0, timesAbsent: 0, attendancePercentage: 0 };
  const attPct = att.attendancePercentage ||
    (att.timesSchoolOpened > 0 ? Math.round((att.timesPresent / att.timesSchoolOpened) * 1000) / 10 : 0);

  return (
    <div ref={ref} style={{
      width: '210mm', minHeight: '297mm', maxWidth: '210mm',
      margin: '0 auto', boxSizing: 'border-box',
      backgroundColor: '#fff', color: '#000',
      padding: '5mm 7mm',
      fontFamily: FONT, fontSize: 9, lineHeight: 1.3,
      WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
    } as React.CSSProperties}>

      <ReportHeader
        schoolName={schoolName}
        schoolAddress={schoolAddress}
        schoolPhone={schoolPhone}
        schoolEmail={schoolEmail}
        termName={reportCard.termName}
        logoSrc={logoSrc}
      />

      <StudentInfo reportCard={reportCard} photoSrc={photoSrc} />

      {/* ── Main 2-column layout ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '73%' }} />
          <col style={{ width: '27%' }} />
        </colgroup>
        <tbody><tr>
          {/* Left column */}
          <td style={{ verticalAlign: 'top', paddingRight: 5 }}>
            <CognitiveDomain subjects={subjects} testWeight={testWeight} emptyRows={emptyRows} />
            <PerformanceSummary
              totalObtained={totalObtained}
              totalMax={totalMax}
              avgPct={avgPct}
              overallGrade={overallGrade}
            />
          </td>
          {/* Right column */}
          <td style={{ verticalAlign: 'top' }}>
            <RightColumn
              att={att}
              attPct={attPct}
              aff={reportCard.affectiveTraits || {}}
              psy={reportCard.psychomotorSkills || {}}
              gradeCounts={gradeCounts}
              subjectCount={subjects.length}
            />
          </td>
        </tr></tbody>
      </table>

      <BottomSection
        reportCard={reportCard}
        teacherSigSrc={teacherSigSrc}
        principalSigSrc={principalSigSrc}
        schoolName={schoolName}
        schoolAddress={schoolAddress}
        schoolMotto={schoolMotto}
      />

    </div>
  );
});

BaileysReportTemplate.displayName = 'BaileysReportTemplate';

export default BaileysReportTemplate;
