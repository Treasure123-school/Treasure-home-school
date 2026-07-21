/**
 * Main report card orchestrator.
 * Composes all section components; owns image-loading side effects only.
 */
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Printer, Download } from 'lucide-react';
import { ContactUtils } from '@shared/contact-utils';
import { imageUrlToBase64 } from '@/lib/report-export-utils';
import { useReportCardSkills } from './useReportCardSkills';
import { ReportCardHeader } from './ReportCardHeader';
import { ReportCardStudentInfo } from './ReportCardStudentInfo';
import { ReportCardPerformanceSummary } from './ReportCardPerformanceSummary';
import { ReportCardSubjectTable } from './ReportCardSubjectTable';
import { ReportCardAttendance } from './ReportCardAttendance';
import { ReportCardSkillsSections } from './ReportCardSkillsSections';
import { ReportCardComments } from './ReportCardComments';
import { ReportCardSignatures } from './ReportCardSignatures';
import type { ProfessionalReportCardProps } from './types';

export function ProfessionalReportCard({
  reportCard,
  testWeight,
  examWeight,
  onEditSubject,
  onSaveRemarks,
  onSaveSkills,
  canEditRemarks = false,
  canEditTeacherRemarks,
  canEditPrincipalRemarks,
  canEditSkills = false,
  onGenerateDefaultComments,
  isLoading = false,
  isFullReportReady = false,
  hideActionButtons = false,
}: ProfessionalReportCardProps) {
  const { data: settings } = useQuery<any>({ queryKey: ['/api/public/settings'] });

  const schoolName    = settings?.schoolName    || '';
  const schoolAddress = settings?.schoolAddress || '';
  const schoolMotto   = settings?.schoolMotto   || '';
  const primaryPhone  = ContactUtils.getFormattedPrimaryPhone(settings);
  const primaryEmail  = ContactUtils.getPrimaryEmail(settings);
  const phonesList    = ContactUtils.getPhones(settings);
  const allPhones     = phonesList.length > 0 ? phonesList.map((p: any) => `${p.countryCode}${p.number}`).join(', ') : '';

  // Base64 image conversion so signatures/photos render in print & export contexts
  const [photoSrc, setPhotoSrc]             = useState('');
  const [teacherSigSrc, setTeacherSigSrc]   = useState('');
  const [principalSigSrc, setPrincipalSigSrc] = useState('');

  useEffect(() => { reportCard.studentPhoto ? imageUrlToBase64(reportCard.studentPhoto).then(setPhotoSrc) : setPhotoSrc(''); }, [reportCard.studentPhoto]);
  useEffect(() => { reportCard.teacherSignatureUrl ? imageUrlToBase64(reportCard.teacherSignatureUrl).then(setTeacherSigSrc) : setTeacherSigSrc(''); }, [reportCard.teacherSignatureUrl]);
  useEffect(() => { reportCard.principalSignatureUrl ? imageUrlToBase64(reportCard.principalSignatureUrl).then(setPrincipalSigSrc) : setPrincipalSigSrc(''); }, [reportCard.principalSignatureUrl]);

  const { localSkills, handleSkillChange } = useReportCardSkills(reportCard, isFullReportReady, onSaveSkills);

  const canEditTeacher   = canEditTeacherRemarks   !== undefined ? canEditTeacherRemarks   : canEditRemarks;
  const canEditPrincipal = canEditPrincipalRemarks !== undefined ? canEditPrincipalRemarks : canEditRemarks;

  const classStats = reportCard.classStatistics || { highestScore: 0, lowestScore: 0, classAverage: 0, totalStudents: reportCard.totalStudentsInClass || 0 };
  const attendance = reportCard.attendance    || { timesSchoolOpened: 0, timesPresent: 0, timesAbsent: 0, attendancePercentage: 0 };
  const affectiveTraits   = reportCard.affectiveTraits   || { punctuality: 0, neatness: 0, attentiveness: 0, teamwork: 0, leadership: 0, assignments: 0, classParticipation: 0 };
  const psychomotorSkills = reportCard.psychomotorSkills || { sports: 0, handwriting: 0, musicalSkills: 0, creativity: 0 };

  const totalSubjects  = reportCard.items?.length || 0;
  const totalObtained  = reportCard.items?.reduce((s, i) => s + (i.obtainedMarks || 0), 0) || 0;
  const totalMax       = reportCard.items?.reduce((s, i) => s + (i.totalMarks || 100), 0) || 0;

  return (
    <div className="w-full bg-background print:bg-white">
      <ReportCardHeader
        schoolName={schoolName} schoolAddress={schoolAddress} schoolMotto={schoolMotto}
        primaryPhone={primaryPhone} primaryEmail={primaryEmail}
        allPhones={allPhones} phoneCount={phonesList.length}
        termName={reportCard.termName} academicSession={reportCard.academicSession || '2024/2025'}
      />

      {!hideActionButtons && (
        <div className="flex flex-wrap items-center gap-2 mb-4 print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print">
            <Printer className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Print</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-export-pdf">
            <Download className="w-4 h-4 mr-2" /><span className="hidden sm:inline">Export PDF</span>
          </Button>
        </div>
      )}

      <ReportCardStudentInfo reportCard={reportCard} photoSrc={photoSrc} />

      <ReportCardPerformanceSummary
        reportCard={reportCard} classStats={classStats}
        totalSubjects={totalSubjects} totalObtained={totalObtained} totalMax={totalMax}
      />

      <ReportCardSubjectTable
        items={reportCard.items || []} testWeight={testWeight} examWeight={examWeight}
        onEditSubject={onEditSubject}
      />

      <ReportCardAttendance attendance={attendance} />

      <ReportCardSkillsSections
        affectiveTraits={affectiveTraits} psychomotorSkills={psychomotorSkills}
        localSkills={localSkills} canEditSkills={canEditSkills} onSkillChange={handleSkillChange}
      />

      <ReportCardComments
        reportCardId={reportCard.id}
        teacherRemarks={reportCard.teacherRemarks} principalRemarks={reportCard.principalRemarks}
        canEditTeacher={canEditTeacher} canEditPrincipal={canEditPrincipal}
        onSaveRemarks={onSaveRemarks} onGenerateDefaultComments={onGenerateDefaultComments}
        isLoading={isLoading}
      />

      <ReportCardSignatures reportCard={reportCard} teacherSigSrc={teacherSigSrc} principalSigSrc={principalSigSrc} />

      {/* Print footer */}
      <div className="hidden print:block mt-6 pt-4 border-t-2 text-center text-sm text-muted-foreground">
        <p className="font-semibold uppercase">{schoolName}</p>
        <p>{schoolAddress}</p>
        <p className="italic mt-1">This is a computer-generated report card.</p>
      </div>
    </div>
  );
}
