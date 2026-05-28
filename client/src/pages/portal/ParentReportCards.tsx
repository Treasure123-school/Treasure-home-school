import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileText, TrendingUp, Award, Calendar, User, Clock, GraduationCap, BookOpen, PenLine } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { apiRequest } from '@/lib/queryClient';
import { BaileysReportTemplate } from '@/components/ui/baileys-report-template';
import { exportToPDF } from '@/lib/report-export-utils';
import { calculateAge, getGradeColor } from '@/lib/report-card-utils';

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  className: string | null;
}

interface ReportCardItem {
  subjectName: string;
  testScore: number;
  testMaxScore: number;
  testWeightedScore: number;
  examScore: number;
  examMaxScore: number;
  examWeightedScore: number;
  obtainedMarks: number;
  percentage: number;
  grade: string;
  teacherRemarks: string;
}

interface ReportCard {
  id: number;
  studentId: string;
  studentName: string;
  admissionNumber?: string | null;
  className: string;
  termName: string;
  termYear: string;
  academicSession?: string;
  averagePercentage: number;
  overallGrade: string;
  teacherRemarks: string;
  principalRemarks?: string;
  status: string;
  generatedAt: string;
  position?: number;
  totalStudentsInClass?: number;
  items: ReportCardItem[];
  teacherSignatureUrl?: string | null;
  teacherSignedAt?: string | null;
  teacherSignedBy?: string | null;
  teacherName?: string | null;
  principalSignatureUrl?: string | null;
  principalSignedAt?: string | null;
  principalSignedBy?: string | null;
  principalName?: string | null;
  studentPhoto?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  affectiveTraits?: { [key: string]: number };
  psychomotorSkills?: { [key: string]: number };
  attendance?: {
    timesSchoolOpened: number;
    timesPresent: number;
    timesAbsent: number;
    attendancePercentage: number;
  };
}

export default function ParentReportCards() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [downloading, setDownloading] = useState<number | null>(null);
  const [activeExportReport, setActiveExportReport] = useState<ReportCard | null>(null);
  const printTemplateRef = useRef<HTMLDivElement>(null);

  const { data: children = [], isLoading: loadingChildren } = useQuery<Child[]>({
    queryKey: ['/api/parent/children'],
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (children.length > 0 && !selectedChild) {
      setSelectedChild(children[0].id);
    }
  }, [children, selectedChild]);

  const { data: reportCards = [], isLoading: loadingReports } = useQuery<ReportCard[]>({
    queryKey: ['/api/parent/child-reports', selectedChild],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/parent/child-reports/${selectedChild}`);
      if (!response.ok) throw new Error('Failed to fetch report cards');
      return response.json();
    },
    enabled: !!selectedChild,
  });

  useSocketIORealtime({
    table: 'report_cards',
    queryKey: ['/api/parent/child-reports', selectedChild],
    enabled: !!selectedChild,
  });

  useEffect(() => {
    if (!activeExportReport) return;
    const timer = setTimeout(async () => {
      if (!printTemplateRef.current) return;
      try {
        const filename = `report-card-${(activeExportReport.studentName || 'student').replace(/\s+/g, '-')}-${(activeExportReport.termName || 'term').replace(/\s+/g, '-')}`;
        await exportToPDF(printTemplateRef.current, { filename });
        toast({ title: 'Downloaded', description: 'Report card downloaded successfully.' });
      } catch (e: any) {
        toast({ title: 'Download Failed', description: e?.message || 'Could not download the report card. Please try again.', variant: 'destructive' });
      } finally {
        setDownloading(null);
        setActiveExportReport(null);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [activeExportReport]);

  const handleDownloadPDF = (report: ReportCard) => {
    setDownloading(report.id);
    setActiveExportReport(report);
  };

  if (!user) {
    return <div className="text-center py-12 text-muted-foreground">Please log in to access the parent portal.</div>;
  }

  return (
    <div className="space-y-6" data-testid="page-parent-report-cards">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <FileText className="h-6 w-6 text-primary" />
            Report Cards
          </h1>
          <p className="text-muted-foreground mt-1">View your child's published academic report cards</p>
        </div>

        {children.length > 0 && (
          <div className="w-full sm:w-64">
            <Select value={selectedChild} onValueChange={setSelectedChild}>
              <SelectTrigger data-testid="select-child">
                <SelectValue placeholder="Select a child" />
              </SelectTrigger>
              <SelectContent>
                {children.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      <span>{child.firstName} {child.lastName}</span>
                      {child.className && <span className="text-xs text-muted-foreground">({child.className})</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Loading */}
      {loadingChildren && (
        <div className="space-y-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      )}

      {/* No children */}
      {!loadingChildren && children.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <User className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold mb-2">No Children Linked</h3>
            <p className="text-sm text-muted-foreground">Please contact the school administration to link your children.</p>
          </CardContent>
        </Card>
      )}

      {/* No child selected (edge case) */}
      {!loadingChildren && children.length > 0 && !selectedChild && (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p className="text-muted-foreground">Select a child to view their report cards.</p>
          </CardContent>
        </Card>
      )}

      {/* Loading report cards */}
      {selectedChild && loadingReports && (
        <div className="space-y-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      )}

      {/* No report cards published */}
      {selectedChild && !loadingReports && reportCards.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Clock className="h-12 w-12 mx-auto mb-4 text-amber-500 opacity-60" />
            <h3 className="font-semibold mb-2">No Published Report Cards Yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Report cards for this child haven't been published yet. They will appear here once the school releases them.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Report Cards List */}
      {selectedChild && !loadingReports && reportCards.length > 0 && (
        <div className="space-y-6">
          {reportCards.map((report) => (
            <Card key={report.id} className="overflow-hidden border border-border shadow-sm" data-testid={`card-report-${report.id}`}>
              {/* Card Header */}
              <CardHeader className="pb-4 border-b border-border bg-muted/30">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1.5">
                    <CardTitle className="text-lg" data-testid={`text-report-title-${report.id}`}>
                      {report.studentName}
                    </CardTitle>
                    {report.admissionNumber && (
                      <p className="text-xs text-muted-foreground font-mono flex items-center gap-1" data-testid={`text-admission-report-${report.id}`}>
                        <User className="h-3 w-3" />
                        Admission No: {report.admissionNumber}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <GraduationCap className="h-3.5 w-3.5" />
                        {report.className}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {report.termName} {report.termYear}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Badge className={`${getGradeColor(report.overallGrade)} border-0 text-xs font-semibold`}>
                        Overall Grade: {report.overallGrade}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        Average: {report.averagePercentage}%
                      </Badge>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleDownloadPDF(report)}
                    disabled={downloading === report.id}
                    size="sm"
                    className="gap-2 self-start"
                    data-testid={`button-download-pdf-${report.id}`}
                  >
                    <Download className="h-4 w-4" />
                    {downloading === report.id ? 'Downloading…' : 'Download PDF'}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-5">
                {/* Subject breakdown */}
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <BookOpen className="h-4 w-4 text-primary" />
                    Subject Performance
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Subject</th>
                          <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Test (40)</th>
                          <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Exam (60)</th>
                          <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Total</th>
                          <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {report.items.map((item, index) => (
                          <tr key={index} className="hover:bg-muted/20 transition-colors">
                            <td className="py-3 px-4 font-medium">{item.subjectName}</td>
                            <td className="text-center py-3 px-3">
                              <div className="font-semibold">{item.testWeightedScore}/40</div>
                              <div className="text-xs text-muted-foreground">({item.testScore}/{item.testMaxScore})</div>
                            </td>
                            <td className="text-center py-3 px-3">
                              <div className="font-semibold">{item.examWeightedScore}/60</div>
                              <div className="text-xs text-muted-foreground">({item.examScore}/{item.examMaxScore})</div>
                            </td>
                            <td className="text-center py-3 px-3">
                              <div className="font-bold text-base">{item.obtainedMarks}/100</div>
                              <div className="text-xs text-muted-foreground">{item.percentage}%</div>
                            </td>
                            <td className="text-center py-3 px-3">
                              <Badge className={`${getGradeColor(item.grade)} border-0 font-semibold text-xs`}>
                                {item.grade}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Average Score</p>
                      <p className="text-lg font-bold">{report.averagePercentage}%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Award className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Overall Grade</p>
                      <p className="text-lg font-bold">{report.overallGrade}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Subjects</p>
                      <p className="text-lg font-bold">{report.items.length}</p>
                    </div>
                  </div>
                </div>

                {/* Teacher remarks */}
                {report.teacherRemarks && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-lg">
                    <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">Class Teacher's Remarks</h4>
                    <p className="text-sm text-amber-800 dark:text-amber-300">{report.teacherRemarks}</p>
                  </div>
                )}

                {/* Principal remarks */}
                {report.principalRemarks && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-lg">
                    <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">Principal's Remarks</h4>
                    <p className="text-sm text-blue-800 dark:text-blue-300">{report.principalRemarks}</p>
                  </div>
                )}

                {/* Signatures */}
                {(report.teacherSignatureUrl || report.principalSignatureUrl) && (
                  <div className="border border-border rounded-lg p-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-4">
                      <PenLine className="h-4 w-4 text-primary" />
                      Official Signatures
                    </h4>
                    <div className="grid grid-cols-2 gap-6">
                      {/* Teacher Signature */}
                      <div className="flex flex-col items-center gap-2" data-testid={`sig-teacher-${report.id}`}>
                        <div className="w-full h-16 border-b-2 border-dashed border-border flex items-end justify-center pb-1">
                          {report.teacherSignatureUrl ? (
                            <img
                              src={report.teacherSignatureUrl}
                              alt="Class Teacher's Signature"
                              className="max-h-14 max-w-full object-contain"
                              data-testid={`img-teacher-signature-${report.id}`}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Not yet signed</span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-center">Class Teacher's Signature</p>
                        {report.teacherSignedAt && (
                          <p className="text-xs text-muted-foreground text-center">
                            Signed: {format(new Date(report.teacherSignedAt), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>

                      {/* Principal Signature */}
                      <div className="flex flex-col items-center gap-2" data-testid={`sig-principal-${report.id}`}>
                        <div className="w-full h-16 border-b-2 border-dashed border-border flex items-end justify-center pb-1">
                          {report.principalSignatureUrl ? (
                            <img
                              src={report.principalSignatureUrl}
                              alt="Principal's Signature"
                              className="max-h-14 max-w-full object-contain"
                              data-testid={`img-principal-signature-${report.id}`}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Not yet signed</span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-center">Principal's Signature</p>
                        {report.principalSignedAt && (
                          <p className="text-xs text-muted-foreground text-center">
                            Signed: {format(new Date(report.principalSignedAt), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Hidden BaileysReportTemplate used for PDF export — never visible to the user */}
      {activeExportReport && (
        <div className="fixed left-[-9999px] top-0 z-[-1]" aria-hidden="true">
          <BaileysReportTemplate
            ref={printTemplateRef}
            reportCard={{
              studentName: activeExportReport.studentName || 'Student',
              admissionNumber: activeExportReport.admissionNumber || 'N/A',
              className: activeExportReport.className || 'N/A',
              termName: activeExportReport.termName || 'N/A',
              academicSession: activeExportReport.academicSession || activeExportReport.termYear || '2024/2025',
              averagePercentage: activeExportReport.averagePercentage || 0,
              overallGrade: activeExportReport.overallGrade || '-',
              position: activeExportReport.position || 0,
              totalStudentsInClass: activeExportReport.totalStudentsInClass || 0,
              items: (activeExportReport.items || []).map((s: any) => ({
                subjectName: s.subjectName,
                testScore: s.testScore ?? s.testWeightedScore ?? null,
                examScore: s.examScore ?? s.examWeightedScore ?? null,
                obtainedMarks: s.obtainedMarks ?? s.totalScore ?? ((Number(s.testScore) || 0) + (Number(s.examScore) || 0)),
                grade: s.grade || '-',
                remarks: s.teacherRemarks || s.remarks || '',
                subjectPosition: s.subjectPosition || null,
                classAverage: s.classAverage || null,
              })),
              teacherRemarks: activeExportReport.teacherRemarks || '',
              principalRemarks: activeExportReport.principalRemarks || '',
              teacherSignatureUrl: activeExportReport.teacherSignatureUrl || null,
              principalSignatureUrl: activeExportReport.principalSignatureUrl || null,
              teacherName: activeExportReport.teacherName || '',
              principalName: activeExportReport.principalName || '',
              studentPhoto: activeExportReport.studentPhoto || undefined,
              gender: activeExportReport.gender || '',
              dateOfBirth: activeExportReport.dateOfBirth
                ? format(new Date(activeExportReport.dateOfBirth), 'dd-MMM-yyyy')
                : '',
              age: calculateAge(activeExportReport.dateOfBirth),
              attendance: activeExportReport.attendance || {
                timesSchoolOpened: 0,
                timesPresent: 0,
                timesAbsent: 0,
                attendancePercentage: 0,
              },
              affectiveTraits: activeExportReport.affectiveTraits as any,
              psychomotorSkills: activeExportReport.psychomotorSkills as any,
              dateIssued: format(new Date(), 'dd-MMM-yyyy'),
            }}
            testWeight={40}
            examWeight={60}
          />
        </div>
      )}
    </div>
  );
}
