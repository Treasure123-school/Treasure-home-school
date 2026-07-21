import { useState, useRef, useEffect } from 'react';
import { calculateAge, getRemarkFromGrade } from '@/lib/report-card-utils';
import { useQuery } from '@tanstack/react-query';
import { useAcademicCalendar } from '@/hooks/useAcademicCalendar';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { ReportCardTemplate } from '@/components/ui/report-card-template';
import { ProfessionalReportCard } from '@/components/ui/professional-report-card';
import { exportToPDF, exportToImage, printElement } from '@/lib/report-export-utils';
import {
  Download,
  FileText,
  Calendar,
  Clock,
  Image,
  Printer,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import RequireCompleteProfile from '@/components/RequireCompleteProfile';

export default function StudentReportCard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [isExporting, setIsExporting] = useState(false);
  const printTemplateRef = useRef<HTMLDivElement>(null);

  const { data: settings } = useQuery<any>({
    queryKey: ['/api/public/settings'],
  });

  const { currentTerm, allTerms: terms } = useAcademicCalendar();

  // Auto-select current term when it loads
  useEffect(() => {
    if (currentTerm && !selectedTerm) {
      setSelectedTerm(String(currentTerm.id));
    }
  }, [currentTerm, selectedTerm]);

  const { data: reportCard, isLoading } = useQuery({
    queryKey: ['/api/reports/student-report-card', user?.id, selectedTerm],
    queryFn: async () => {
      if (!user?.id || !selectedTerm) return null;
      const response = await apiRequest('GET', `/api/reports/student-report-card/${user.id}?termId=${selectedTerm}`);
      return await response.json();
    },
    enabled: !!user?.id && !!selectedTerm,
  });

  const { data: studentDetails } = useQuery({
    queryKey: ['/api/students/details', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const response = await apiRequest('GET', `/api/students/${user.id}`);
      return await response.json();
    },
    enabled: !!user?.id,
  });

  useSocketIORealtime({
    table: 'report_cards',
    queryKey: ['/api/reports/student-report-card', user?.id, selectedTerm],
    enabled: !!user?.id && !!selectedTerm,
  });

  // ── Export handlers ──────────────────────────────────────────────────────────

  const handleExportPDF = async () => {
    if (!printTemplateRef.current || !reportCard) {
      toast({ title: 'Error', description: 'Please select a term first', variant: 'destructive' });
      return;
    }
    setIsExporting(true);
    try {
      toast({ title: 'Export Started', description: 'Generating PDF report card…' });
      await exportToPDF(printTemplateRef.current, {
        filename: `report-card-${user?.firstName}-${user?.lastName}-${reportCard.termName || selectedTerm}`,
        scale: 2,
      });
      toast({ title: 'Export Complete', description: 'Report card PDF has been downloaded.' });
    } catch (error: any) {
      toast({ title: 'Export Failed', description: error?.message || 'Could not generate the PDF.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportImage = async () => {
    if (!printTemplateRef.current || !reportCard) {
      toast({ title: 'Error', description: 'Please select a term first', variant: 'destructive' });
      return;
    }
    setIsExporting(true);
    try {
      toast({ title: 'Export Started', description: 'Generating image…' });
      await exportToImage(printTemplateRef.current, {
        filename: `report-card-${user?.firstName}-${user?.lastName}-${reportCard.termName || selectedTerm}`,
        scale: 2,
      });
      toast({ title: 'Export Complete', description: 'Report card image has been downloaded.' });
    } catch (error: any) {
      toast({ title: 'Export Failed', description: error?.message || 'Could not generate the image.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    if (!printTemplateRef.current) { window.print(); return; }
    printElement(printTemplateRef.current);
  };

  if (!user) return <div>Please log in to access your report card.</div>;

  // ── Derived data ─────────────────────────────────────────────────────────────

  const attendance = reportCard?.attendance || {
    timesSchoolOpened: 0, timesPresent: 0, timesAbsent: 0, attendancePercentage: 0,
  };

  const classStats = reportCard?.classStatistics || {
    highestScore: 0, lowestScore: 0, classAverage: 0,
    totalStudents: reportCard?.totalStudentsInClass || reportCard?.totalStudents || 0,
  };

  const affectiveTraits = reportCard?.affectiveTraits || {
    punctuality: 0, neatness: 0, attentiveness: 0,
    teamwork: 0, leadership: 0, assignments: 0, classParticipation: 0,
  };

  const psychomotorSkills = reportCard?.psychomotorSkills || {
    sports: 0, handwriting: 0, musicalSkills: 0, creativity: 0,
  };

  // Support both data structures: items (new blueprint) and subjects (legacy)
  const subjects = reportCard?.items || reportCard?.subjects || [];

  return (
    <RequireCompleteProfile feature="report cards and academic results">
      <div className="space-y-6 print:space-y-4" data-testid="student-report-card">

        {/* ── Page header: term selector + export actions ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">My Report Card</h1>
            <p className="text-muted-foreground">View your academic performance</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={selectedTerm} onValueChange={setSelectedTerm}>
              <SelectTrigger className="w-48" data-testid="select-term">
                <SelectValue placeholder="Select Term" />
              </SelectTrigger>
              <SelectContent>
                {terms.map((term: any) => (
                  <SelectItem key={term.id} value={term.id.toString()}>
                    {term.name} ({term.year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handlePrint} disabled={isExporting || !reportCard} data-testid="button-print">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={isExporting || !reportCard} data-testid="button-export">
                  {isExporting
                    ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    : <Download className="w-4 h-4 mr-2" />}
                  {isExporting ? 'Exporting…' : 'Export'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportPDF} data-testid="menu-export-pdf">
                  <FileText className="w-4 h-4 mr-2" />
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportImage} data-testid="menu-export-image">
                  <Image className="w-4 h-4 mr-2" />
                  Export as Image
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── Loading / empty states ── */}
        {!selectedTerm ? (
          <Card>
            <CardContent className="text-center py-12">
              <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Select Academic Term</h3>
              <p className="text-muted-foreground">Please select an academic term to view your report card.</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p>Loading report card…</p>
            </CardContent>
          </Card>
        ) : !reportCard ? (
          <Card>
            <CardContent className="text-center py-12">
              <Clock className="w-16 h-16 mx-auto text-amber-500 mb-4" />
              <h3 className="text-lg font-medium mb-2">Report Card Not Yet Available</h3>
              <p className="text-muted-foreground mb-2">Your report card for this term has not been published yet.</p>
              <p className="text-sm text-muted-foreground">Please check back later or contact your teacher.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ── Shared on-screen view — same component used by teacher & admin ── */}
            <ProfessionalReportCard
              reportCard={{
                id: reportCard.id,
                studentId: user.id,
                studentName: reportCard.studentName || `${user.firstName} ${user.lastName}`,
                studentPhoto: reportCard.studentPhoto || user?.profileImageUrl,
                admissionNumber: reportCard.admissionNumber || studentDetails?.admissionNumber || 'N/A',
                className: reportCard.className || studentDetails?.className || 'N/A',
                classArm: reportCard.classArm,
                department: reportCard.department,
                isSSS: reportCard.isSSS,
                termName: reportCard.termName || reportCard.term?.name || 'N/A',
                academicSession: reportCard.academicSession || reportCard.termYear || '2024/2025',
                dateOfBirth: studentDetails?.dateOfBirth
                  ? format(new Date(studentDetails.dateOfBirth), 'dd-MMM-yyyy')
                  : undefined,
                gender: user?.gender || studentDetails?.gender || '',
                averagePercentage: reportCard.averagePercentage || reportCard.summary?.averagePercentage || 0,
                overallGrade: reportCard.overallGrade || '-',
                position: reportCard.position || reportCard.classRank || 0,
                totalStudentsInClass: reportCard.totalStudentsInClass || reportCard.totalStudents || 0,
                totalScore: reportCard.totalScore,
                items: subjects.map((s: any) => ({
                  id: s.id ?? 0,
                  subjectId: s.subjectId ?? 0,
                  subjectName: s.subjectName,
                  subjectCode: s.subjectCode,
                  testScore: s.testScore ?? s.testWeightedScore ?? null,
                  testMaxScore: s.testMaxScore ?? 40,
                  testWeightedScore: s.testWeightedScore ?? s.testScore ?? null,
                  examScore: s.examScore ?? s.examWeightedScore ?? null,
                  examMaxScore: s.examMaxScore ?? 60,
                  examWeightedScore: s.examWeightedScore ?? s.examScore ?? null,
                  totalMarks: s.totalMarks ?? 100,
                  obtainedMarks: s.obtainedMarks ?? s.totalScore ?? 0,
                  percentage: s.percentage ?? (s.obtainedMarks ?? s.totalScore ?? 0),
                  grade: s.grade || '-',
                  remarks: getRemarkFromGrade(s.grade) || s.remarks || s.teacherRemarks || '',
                  subjectPosition: s.subjectPosition ?? null,
                })),
                teacherRemarks: reportCard.teacherRemarks || reportCard.teacherComment,
                principalRemarks: reportCard.principalRemarks || reportCard.principalComment,
                status: reportCard.status || 'published',
                generatedAt: reportCard.generatedAt,
                classStatistics: {
                  highestScore: classStats.highestScore,
                  lowestScore: classStats.lowestScore,
                  classAverage: classStats.classAverage,
                  totalStudents: classStats.totalStudents || reportCard.totalStudentsInClass || 0,
                },
                attendance,
                affectiveTraits,
                psychomotorSkills,
                teacherSignatureUrl: reportCard.teacherSignatureUrl ?? null,
                teacherSignedAt: reportCard.teacherSignedAt ?? null,
                teacherSignedBy: reportCard.teacherSignedBy ?? null,
                teacherName: reportCard.teacherName || '',
                principalSignatureUrl: reportCard.principalSignatureUrl ?? null,
                principalSignedAt: reportCard.principalSignedAt ?? null,
                principalSignedBy: reportCard.principalSignedBy ?? null,
                principalName: reportCard.principalName || '',
                dateIssued: format(new Date(), 'MMMM d, yyyy'),
              }}
              testWeight={40}
              examWeight={60}
              // Read-only for students — no editing callbacks
              canEditTeacherRemarks={false}
              canEditPrincipalRemarks={false}
              canEditSkills={false}
              // Page already shows its own print/export buttons above
              hideActionButtons={true}
            />
          </>
        )}

        {/* ── Hidden report card template for PDF/Image export ── */}
        {reportCard && (
          <div className="fixed left-[-9999px] top-0 z-[-1]">
            <ReportCardTemplate
              ref={printTemplateRef}
              reportCard={{
                studentName: reportCard.studentName || `${user?.firstName} ${user?.lastName}`,
                admissionNumber: reportCard.admissionNumber || studentDetails?.admissionNumber || 'N/A',
                className: reportCard.className || studentDetails?.className || 'N/A',
                classArm: reportCard.classArm,
                department: reportCard.department,
                isSSS: reportCard.isSSS,
                termName: reportCard.termName || reportCard.term?.name || 'N/A',
                academicSession: reportCard.academicSession || reportCard.termYear || '2024/2025',
                averagePercentage: reportCard.averagePercentage || reportCard.summary?.averagePercentage || 0,
                overallGrade: reportCard.overallGrade || '-',
                position: reportCard.position || reportCard.classRank || 0,
                totalStudentsInClass: reportCard.totalStudentsInClass || reportCard.totalStudents || 0,
                items: subjects.map((s: any) => ({
                  subjectName: s.subjectName,
                  testScore: s.testScore ?? s.testWeightedScore ?? null,
                  examScore: s.examScore ?? s.examWeightedScore ?? null,
                  obtainedMarks: s.obtainedMarks ?? s.totalScore ?? 0,
                  grade: s.grade || '-',
                  remarks: getRemarkFromGrade(s.grade) || s.remarks || s.teacherRemarks,
                  subjectPosition: s.subjectPosition ?? null,
                })),
                teacherRemarks: reportCard.teacherRemarks || reportCard.teacherComment,
                principalRemarks: reportCard.principalRemarks || reportCard.principalComment,
                attendance,
                affectiveTraits,
                psychomotorSkills,
                studentPhoto: reportCard.studentPhoto || user?.profileImageUrl,
                gender: user?.gender || studentDetails?.gender || '',
                dateOfBirth: studentDetails?.dateOfBirth
                  ? format(new Date(studentDetails.dateOfBirth), 'dd-MMM-yyyy')
                  : '',
                age: calculateAge(studentDetails?.dateOfBirth),
                dateIssued: format(new Date(), 'dd-MMM-yyyy'),
                teacherSignatureUrl: reportCard.teacherSignatureUrl ?? null,
                principalSignatureUrl: reportCard.principalSignatureUrl ?? null,
                teacherName: reportCard.teacherName || '',
                principalName: reportCard.principalName || '',
              }}
              testWeight={40}
              examWeight={60}
            />
          </div>
        )}

      </div>
    </RequireCompleteProfile>
  );
}
