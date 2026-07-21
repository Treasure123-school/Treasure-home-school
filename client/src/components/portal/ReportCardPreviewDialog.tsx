/**
 * Full-screen report card preview dialog.
 * ACTION BAR: ReportCardActionBar (status badge + export/workflow buttons).
 * BODY: ProfessionalReportCard — receives classStatistics from the backend
 *       response (fullReportCard.classStatistics), NOT from the teacher page's
 *       frontend stats bar, which uses different field names and a coarser calc.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertCircle, FileText, Loader2 } from 'lucide-react';
import { ProfessionalReportCard } from '@/components/report-card/ProfessionalReportCard';
import { ReportCardActionBar } from '@/components/portal/ReportCardActionBar';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fullReportCard: any;
  loadingFullReport: boolean;
  fetchingFullReport: boolean;
  isDownloading: boolean;
  autoPopulatePending: boolean;
  updateStatusPending: boolean;
  updateRemarksPending: boolean;
  testWeight: number;
  examWeight: number;
  classes: any[];
  selectedClass: string;
  selectedTerm: string;
  isAdmin: boolean;
  user: any;
  onPrint: () => void;
  onExportPDF: () => void;
  onExportImage: () => void;
  onRefresh: () => void;
  onFinalize: () => void;
  onRevertDraft: () => void;
  onEditSubject: (item: any) => void;
  onSaveRemarks: (teacher: string, principal: string) => void;
  onSaveSkills: (skills: any) => Promise<void>;
  onGenerateComments: () => Promise<{ teacherComment: string; principalComment: string }>;
  reportCardRef: React.RefObject<HTMLDivElement>;
}

export function ReportCardPreviewDialog({
  open, onOpenChange, fullReportCard, loadingFullReport, fetchingFullReport,
  isDownloading, autoPopulatePending, updateStatusPending, updateRemarksPending,
  testWeight, examWeight, classes, selectedClass, selectedTerm,
  isAdmin, user, onPrint, onExportPDF, onExportImage, onRefresh,
  onFinalize, onRevertDraft, onEditSubject, onSaveRemarks, onSaveSkills,
  onGenerateComments, reportCardRef,
}: Props) {
  const classInfo    = classes.find((c: any) => c.id === Number(selectedClass));
  const isPrincipal  = user?.role?.toLowerCase() === 'admin';
  const canEditTeacher   = !!fullReportCard && fullReportCard.status === 'draft' && (isAdmin || classInfo?.classTeacherId === user?.id);
  const canEditPrincipal = !!fullReportCard && fullReportCard.status === 'draft' && isPrincipal;
  const canEditSkills    = !!fullReportCard &&
    (fullReportCard.status === 'draft' || fullReportCard.status === 'teacher_signed') &&
    (isAdmin || classInfo?.classTeacherId === user?.id);

  // ── Class statistics: always prefer the backend-computed classStatistics
  // from fullReportCard (returned by GET /api/reports/:id/full).
  // That value is calculated from all stored averagePercentage values for the
  // class/term, filtered to > 0, consistent with every other backend path.
  const classStatistics = fullReportCard?.classStatistics || {
    highestScore: 0, lowestScore: 0, classAverage: 0,
    totalStudents: fullReportCard?.totalStudentsInClass || 0,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[98vw] sm:w-[95vw] md:w-[90vw] lg:w-[85vw] max-w-5xl max-h-[85dvh] sm:max-h-[88dvh] md:max-h-[90dvh] p-0 flex flex-col overflow-hidden" style={{ margin: 'auto' }}>
        <DialogHeader className="px-3 py-2 sm:px-4 sm:py-3 border-b shrink-0 bg-background">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex items-center gap-2 text-sm sm:text-base md:text-lg">
                <FileText className="w-4 h-4 shrink-0" /><span className="truncate">Report Card Preview</span>
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm truncate mt-0.5">
                {fullReportCard?.studentName} – {fullReportCard?.className} – {fullReportCard?.termName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loadingFullReport ? (
          <div className="flex-1 flex items-center justify-center min-h-[200px]">
            <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin" />
          </div>
        ) : fullReportCard ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <ReportCardActionBar
              fullReportCard={fullReportCard} isDownloading={isDownloading}
              autoPopulatePending={autoPopulatePending} updateStatusPending={updateStatusPending}
              onPrint={onPrint} onExportPDF={onExportPDF} onExportImage={onExportImage}
              onRefresh={onRefresh} onFinalize={onFinalize} onRevertDraft={onRevertDraft}
            />
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              <div ref={reportCardRef} className="p-2 sm:p-3 md:p-4 bg-background">
                <ProfessionalReportCard
                  reportCard={{
                    id: fullReportCard.id, studentId: fullReportCard.studentId,
                    studentName: fullReportCard.studentName, studentPhoto: fullReportCard.studentPhoto,
                    admissionNumber: fullReportCard.admissionNumber || fullReportCard.studentUsername,
                    className: fullReportCard.className, department: fullReportCard.department,
                    isSSS: fullReportCard.isSSS, termName: fullReportCard.termName,
                    academicSession: fullReportCard.academicSession || fullReportCard.sessionYear || '2024/2025',
                    averagePercentage: fullReportCard.averagePercentage || 0,
                    overallGrade: fullReportCard.overallGrade || '-',
                    position: fullReportCard.position || 0,
                    totalStudentsInClass: fullReportCard.totalStudentsInClass || 0,
                    totalScore: fullReportCard.totalScore, items: fullReportCard.items || [],
                    teacherRemarks: fullReportCard.teacherRemarks, principalRemarks: fullReportCard.principalRemarks,
                    status: fullReportCard.status, generatedAt: fullReportCard.generatedAt,
                    teacherSignatureUrl: fullReportCard.teacherSignatureUrl, teacherSignedAt: fullReportCard.teacherSignedAt,
                    teacherSignedBy: fullReportCard.teacherSignedBy,
                    teacherName: fullReportCard.teacherName || '',
                    principalSignatureUrl: fullReportCard.principalSignatureUrl, principalSignedAt: fullReportCard.principalSignedAt,
                    principalSignedBy: fullReportCard.principalSignedBy,
                    principalName: fullReportCard.principalName || '',
                    classStatistics,
                    attendance: { timesSchoolOpened: 0, timesPresent: 0, timesAbsent: 0, attendancePercentage: 0 },
                    affectiveTraits: fullReportCard.affectiveTraits || { punctuality: 0, neatness: 0, attentiveness: 0, teamwork: 0, leadership: 0, assignments: 0, classParticipation: 0 },
                    psychomotorSkills: fullReportCard.psychomotorSkills || { sports: 0, handwriting: 0, musicalSkills: 0, creativity: 0 },
                  }}
                  testWeight={testWeight} examWeight={examWeight}
                  onEditSubject={onEditSubject} onSaveRemarks={onSaveRemarks} onSaveSkills={onSaveSkills}
                  canEditTeacherRemarks={canEditTeacher} canEditPrincipalRemarks={canEditPrincipal}
                  canEditSkills={canEditSkills} onGenerateDefaultComments={onGenerateComments}
                  isLoading={updateRemarksPending}
                  isFullReportReady={!loadingFullReport && !fetchingFullReport && !!fullReportCard}
                  hideActionButtons={true}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-[200px]">
            <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mb-3 sm:mb-4" />
            <p className="text-xs sm:text-sm text-muted-foreground text-center">Failed to load report card details</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
