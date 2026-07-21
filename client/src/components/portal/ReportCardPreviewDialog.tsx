/**
 * Full-screen report card preview dialog.
 * Shows action bar (status badge, print/export/refresh/finalize) + scrollable card body.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertCircle, CheckCircle, Clock, Download, FileCheck, FileText, Loader2, Printer, RefreshCw, Send, Undo2 } from 'lucide-react';
import { ProfessionalReportCard } from '@/components/report-card/ProfessionalReportCard';

interface ActionBarProps {
  fullReportCard: any;
  isDownloading: boolean;
  autoPopulatePending: boolean;
  updateStatusPending: boolean;
  onPrint: () => void;
  onExportPDF: () => void;
  onExportImage: () => void;
  onRefresh: () => void;
  onFinalize: () => void;
  onRevertDraft: () => void;
}

function ActionBar({ fullReportCard, isDownloading, autoPopulatePending, updateStatusPending, onPrint, onExportPDF, onExportImage, onRefresh, onFinalize, onRevertDraft }: ActionBarProps) {
  return (
    <div className="px-2 py-2 sm:px-4 sm:py-3 border-b bg-muted/30 shrink-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {fullReportCard.status === 'draft' && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
              <Clock className="w-3 h-3 mr-1" />Draft
            </Badge>
          )}
          {fullReportCard.status === 'finalized' && (
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/30 text-xs">
              <FileCheck className="w-3 h-3 mr-1" />Awaiting Approval
            </Badge>
          )}
          {fullReportCard.status === 'published' && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
              <CheckCircle className="w-3 h-3 mr-1" />Published
            </Badge>
          )}
          <span className="text-xs text-muted-foreground hidden md:inline">
            {fullReportCard.status === 'draft' ? 'Editing enabled' : fullReportCard.status === 'finalized' ? 'Awaiting admin approval' : 'Visible to students and parents'}
          </span>
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5">
          <Button variant="outline" size="icon" onClick={onPrint} aria-label="Print" data-testid="button-print">
            <Printer className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" disabled={isDownloading} aria-label="Export" data-testid="button-download">
                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onExportPDF} data-testid="menu-export-pdf">
                <FileText className="w-4 h-4 mr-2" />Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportImage} data-testid="menu-export-image">
                <Download className="w-4 h-4 mr-2" />Export as Image
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="icon" onClick={onRefresh}
            disabled={autoPopulatePending || fullReportCard.status !== 'draft'}
            aria-label="Refresh scores" data-testid="button-refresh-scores">
            {autoPopulatePending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
          {fullReportCard.status === 'draft' && (
            <Button onClick={onFinalize} disabled={updateStatusPending} size="sm" className="text-xs sm:text-sm h-9" data-testid="button-finalize">
              <Send className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Finalize</span>
            </Button>
          )}
          {fullReportCard.status === 'finalized' && (
            <Button variant="outline" size="sm" onClick={onRevertDraft} disabled={updateStatusPending}
              className="text-xs sm:text-sm h-9 text-amber-600 hover:text-amber-700" data-testid="button-revert-draft">
              <Undo2 className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Revert to Draft</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

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
  statistics: any;
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
  testWeight, examWeight, classes, selectedClass, selectedTerm, statistics,
  isAdmin, user, onPrint, onExportPDF, onExportImage, onRefresh,
  onFinalize, onRevertDraft, onEditSubject, onSaveRemarks, onSaveSkills,
  onGenerateComments, reportCardRef,
}: Props) {
  const classInfo  = classes.find((c: any) => c.id === Number(selectedClass));
  const isPrincipal = user?.role?.toLowerCase() === 'admin';
  const canEditTeacher   = !!fullReportCard && fullReportCard.status === 'draft' && (isAdmin || classInfo?.classTeacherId === user?.id);
  const canEditPrincipal = !!fullReportCard && fullReportCard.status === 'draft' && isPrincipal;
  const canEditSkills    = !!fullReportCard && (fullReportCard.status === 'draft' || fullReportCard.status === 'teacher_signed') &&
    (isAdmin || classInfo?.classTeacherId === user?.id);

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
            <ActionBar
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
                    principalSignatureUrl: fullReportCard.principalSignatureUrl, principalSignedAt: fullReportCard.principalSignedAt,
                    principalSignedBy: fullReportCard.principalSignedBy,
                    classStatistics: {
                      highestScore: statistics?.classHighest || 0, lowestScore: statistics?.classLowest || 0,
                      classAverage: statistics?.classAverage || 0, totalStudents: fullReportCard.totalStudentsInClass || 0,
                    },
                    attendance: { timesSchoolOpened: 0, timesPresent: 0, timesAbsent: 0, attendancePercentage: 0 },
                    affectiveTraits: fullReportCard.affectiveTraits || { punctuality: 0, neatness: 0, attentiveness: 0, teamwork: 0, leadership: 0, assignments: 0, classParticipation: 0 },
                    psychomotorSkills: fullReportCard.psychomotorSkills || { sports: 0, handwriting: 0, musicalSkills: 0, creativity: 0 },
                  }}
                  testWeight={testWeight} examWeight={examWeight}
                  onEditSubject={onEditSubject}
                  onSaveRemarks={onSaveRemarks}
                  onSaveSkills={onSaveSkills}
                  canEditTeacherRemarks={canEditTeacher}
                  canEditPrincipalRemarks={canEditPrincipal}
                  canEditSkills={canEditSkills}
                  onGenerateDefaultComments={onGenerateComments}
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
