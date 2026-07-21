/**
 * Off-screen report card template used exclusively for PDF / image export.
 * Rendered outside the viewport so html2canvas can capture it without
 * affecting the visible UI. Accepts a forwarded ref that callers pass to
 * exportToPDF / exportToImage.
 */
import { forwardRef } from 'react';
import { format } from 'date-fns';
import { ReportCardTemplate } from '@/components/ui/report-card-template';
import { calculateAge } from '@/lib/report-card-utils';

interface Props {
  fullReportCard: any;
  testWeight: number;
  examWeight: number;
}

export const ReportCardExportContainer = forwardRef<HTMLDivElement, Props>(
  ({ fullReportCard, testWeight, examWeight }, ref) => {
    if (!fullReportCard) return null;

    const items = (fullReportCard.items || []).map((item: any) => ({
      subjectName:     item.subjectName,
      testScore:       item.testScore       ?? item.testWeightedScore  ?? null,
      examScore:       item.examScore       ?? item.examWeightedScore  ?? null,
      obtainedMarks:   item.obtainedMarks   ?? item.totalScore         ?? 0,
      grade:           item.grade           || '-',
      remarks:         item.remarks         || item.teacherRemarks     || '',
      subjectPosition: item.subjectPosition || null,
    }));

    return (
      <div className="fixed left-[-9999px] top-0 z-[-1]">
        <ReportCardTemplate
          ref={ref}
          reportCard={{
            studentName:          fullReportCard.studentName,
            admissionNumber:      fullReportCard.admissionNumber || fullReportCard.studentUsername || 'N/A',
            className:            fullReportCard.className,
            classArm:             fullReportCard.classArm,
            department:           fullReportCard.department,
            isSSS:                fullReportCard.isSSS,
            termName:             fullReportCard.termName,
            academicSession:      fullReportCard.academicSession || fullReportCard.sessionYear || '2024/2025',
            averagePercentage:    fullReportCard.averagePercentage  || 0,
            overallGrade:         fullReportCard.overallGrade       || '-',
            position:             fullReportCard.position           || 0,
            totalStudentsInClass: fullReportCard.totalStudentsInClass || 0,
            items,
            teacherRemarks:       fullReportCard.teacherRemarks,
            principalRemarks:     fullReportCard.principalRemarks,
            attendance:           { timesSchoolOpened: 0, timesPresent: 0, timesAbsent: 0 },
            studentPhoto:         fullReportCard.studentPhoto,
            teacherSignatureUrl:  fullReportCard.teacherSignatureUrl  || null,
            principalSignatureUrl: fullReportCard.principalSignatureUrl || null,
            teacherName:          fullReportCard.teacherName    || '',
            principalName:        fullReportCard.principalName  || '',
            gender:               fullReportCard.gender         || '',
            dateOfBirth:          fullReportCard.dateOfBirth
              ? format(new Date(fullReportCard.dateOfBirth), 'dd-MMM-yyyy')
              : '',
            age:             calculateAge(fullReportCard.dateOfBirth),
            dateIssued:      new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            nextTermBegins:  fullReportCard.nextTermBegins || 'To be announced',
            affectiveTraits: fullReportCard.affectiveTraits  || { punctuality: 0, neatness: 0, attentiveness: 0, teamwork: 0, leadership: 0, assignments: 0, classParticipation: 0 },
            psychomotorSkills: fullReportCard.psychomotorSkills || { sports: 0, handwriting: 0, musicalSkills: 0, creativity: 0 },
          }}
          testWeight={testWeight}
          examWeight={examWeight}
        />
      </div>
    );
  }
);

ReportCardExportContainer.displayName = 'ReportCardExportContainer';
