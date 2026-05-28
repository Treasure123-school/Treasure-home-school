import { useState, useRef } from 'react';
import { calculateAge, getGradeColor, getRemarkFromGrade, formatPosition } from '@/lib/report-card-utils';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import { BaileysReportTemplate } from '@/components/ui/baileys-report-template';
import { exportToPDF, exportToImage, printElement } from '@/lib/report-export-utils';
import { ContactUtils } from '@shared/contact-utils';
import { 
  Download, 
  FileText, 
  Calendar,
  Clock,
  User,
  BarChart3,
  Award,
  TrendingUp,
  TrendingDown,
  BookOpen,
  Brain,
  Activity,
  Pen,
  ChevronDown,
  ChevronUp,
  Image,
  Printer,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import RequireCompleteProfile from '@/components/RequireCompleteProfile';

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

const RatingDisplay = ({ value, label }: { value: number; label: string }) => {
  const ratingText = value > 0 ? RATING_LABELS[value] : '-';
  const ratingColor = value >= 4 ? 'text-green-600' : value >= 3 ? 'text-blue-600' : value >= 2 ? 'text-yellow-600' : 'text-red-600';
  
  return (
    <div className="flex items-center justify-between py-2 border-b border-muted last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <div
              key={star}
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-medium
                ${star <= value 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground/50'}
              `}
            >
              {star}
            </div>
          ))}
        </div>
        <span className={`text-xs font-medium min-w-[60px] text-right ${ratingColor}`}>
          {ratingText}
        </span>
      </div>
    </div>
  );
};

export default function StudentReportCard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [isSubjectsOpen, setIsSubjectsOpen] = useState(true);
  const [isAffectiveOpen, setIsAffectiveOpen] = useState(true);
  const [isPsychomotorOpen, setIsPsychomotorOpen] = useState(true);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const printTemplateRef = useRef<HTMLDivElement>(null);

  const { data: settings } = useQuery<any>({
    queryKey: ["/api/public/settings"],
  });

  const schoolName = settings?.schoolName || "";
  const schoolAddress = settings?.schoolAddress || "";
  const schoolMotto = settings?.schoolMotto || "";
  
  const schoolEmail = ContactUtils.getPrimaryEmail(settings);
  const schoolPhone = ContactUtils.getFormattedPrimaryPhone(settings);

  const { data: terms = [] } = useQuery({
    queryKey: ['/api/terms'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/terms');
      return await response.json();
    },
  });

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

  const handleExportPDF = async () => {
    if (!user?.id || !selectedTerm || !reportCard) {
      toast({
        title: "Error",
        description: "Please select a term first",
        variant: "destructive",
      });
      return;
    }
    
    if (!printTemplateRef.current) {
      toast({
        title: "Error",
        description: "Report template not ready",
        variant: "destructive",
      });
      return;
    }
    
    setIsExporting(true);
    try {
      toast({
        title: "Export Started",
        description: "Generating PDF report card...",
      });

      await exportToPDF(printTemplateRef.current, {
        filename: `report-card-${user.firstName}-${user.lastName}-${reportCard.termName || selectedTerm}`,
        scale: 2,
      });

      toast({
        title: "Export Complete",
        description: "Report card PDF has been downloaded.",
      });
    } catch (error: any) {
      console.error('PDF export error:', error);
      toast({
        title: "Export Failed",
        description: error?.message || "Could not generate the PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportImage = async () => {
    if (!user?.id || !selectedTerm || !reportCard) {
      toast({
        title: "Error",
        description: "Please select a term first",
        variant: "destructive",
      });
      return;
    }
    
    if (!printTemplateRef.current) {
      toast({
        title: "Error",
        description: "Report template not ready",
        variant: "destructive",
      });
      return;
    }
    
    setIsExporting(true);
    try {
      toast({
        title: "Export Started",
        description: "Generating image...",
      });

      await exportToImage(printTemplateRef.current, {
        filename: `report-card-${user.firstName}-${user.lastName}-${reportCard.termName || selectedTerm}`,
        scale: 2,
      });

      toast({
        title: "Export Complete",
        description: "Report card image has been downloaded.",
      });
    } catch (error: any) {
      console.error('Image export error:', error);
      toast({
        title: "Export Failed",
        description: error?.message || "Could not generate the image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    if (!printTemplateRef.current) {
      window.print();
      return;
    }
    printElement(printTemplateRef.current);
  };

  if (!user) {
    return <div>Please log in to access your report card.</div>;
  }

  const attendance = reportCard?.attendance || {
    timesSchoolOpened: 0,
    timesPresent: 0,
    timesAbsent: 0,
    attendancePercentage: 0
  };

  const classStats = reportCard?.classStatistics || {
    highestScore: 0,
    lowestScore: 0,
    classAverage: 0,
    totalStudents: reportCard?.totalStudentsInClass || reportCard?.totalStudents || 0
  };

  const affectiveTraits = reportCard?.affectiveTraits || {
    punctuality: 0,
    neatness: 0,
    attentiveness: 0,
    teamwork: 0,
    leadership: 0,
    assignments: 0,
    classParticipation: 0
  };

  const psychomotorSkills = reportCard?.psychomotorSkills || {
    sports: 0,
    handwriting: 0,
    musicalSkills: 0,
    creativity: 0
  };

  // Support both data structures: items (new blueprint) and subjects (legacy)
  const subjects = reportCard?.items || reportCard?.subjects || [];
  const totalSubjects = subjects.length;
  const totalObtained = subjects.reduce((sum: number, s: any) => sum + (s.obtainedMarks || s.totalScore || 0), 0);
  const totalMax = subjects.reduce((sum: number, s: any) => sum + (s.totalMarks || 100), 0) || totalSubjects * 100;

  const affectiveTraitLabels = [
    { key: 'punctuality', label: 'Punctuality' },
    { key: 'neatness', label: 'Neatness' },
    { key: 'attentiveness', label: 'Attentiveness' },
    { key: 'teamwork', label: 'Teamwork' },
    { key: 'leadership', label: 'Leadership' },
    { key: 'assignments', label: 'Assignments/Homework' },
    { key: 'classParticipation', label: 'Class Participation' }
  ];

  const psychomotorLabels = [
    { key: 'sports', label: 'Sports' },
    { key: 'handwriting', label: 'Handwriting' },
    { key: 'musicalSkills', label: 'Musical Skills' },
    { key: 'creativity', label: 'Creativity / Craft' }
  ];

  return (
    <RequireCompleteProfile feature="report cards and academic results">
    <div className="space-y-6 print:space-y-4" data-testid="student-report-card">
      {/* Header */}
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
                {isExporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                {isExporting ? 'Exporting...' : 'Export'}
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

      {!selectedTerm ? (
        <Card>
          <CardContent className="text-center py-12">
            <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Select Academic Term</h3>
            <p className="text-muted-foreground">
              Please select an academic term to view your report card.
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p>Loading report card...</p>
          </CardContent>
        </Card>
      ) : !reportCard ? (
        <Card>
          <CardContent className="text-center py-12">
            <Clock className="w-16 h-16 mx-auto text-amber-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">Report Card Not Yet Available</h3>
            <p className="text-muted-foreground mb-2">
              Your report card for this term has not been published yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Please check back later or contact your teacher.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* School Header - Visible on screen */}
          <Card className="mb-4 print:shadow-none print:border-2 bg-gradient-to-r from-primary/5 to-primary/10">
            <CardContent className="p-4">
              <div className="text-center">
                <h1 className="text-xl sm:text-2xl font-bold text-primary">{schoolName || ""}</h1>
                <p className="text-sm font-medium">{schoolAddress || ""}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Contact: {schoolPhone || ""}
                </p>
                {schoolEmail && (
                  <p className="text-xs text-muted-foreground">
                    Email: {schoolEmail}
                  </p>
                )}
                <p className="text-xs italic mt-2">Motto: "{schoolMotto || ""}"</p>
                <Separator className="my-3" />
                <h2 className="text-lg font-semibold">{reportCard.termName?.toUpperCase() || 'FIRST TERM'} STUDENT'S PERFORMANCE REPORT</h2>
                <p className="text-xs text-muted-foreground">Session: {reportCard.academicSession || '2024/2025'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Print Header */}
          <div className="hidden print:block mb-6">
            <div className="text-center border-b-2 border-primary pb-4">
              <h1 className="text-2xl font-bold">{schoolName || ""}</h1>
              <p className="text-sm font-medium">{schoolAddress || ""}</p>
              <p className="text-xs text-muted-foreground">
                Contact: {schoolPhone || ""}
              </p>
              {schoolEmail && (
                <p className="text-xs text-muted-foreground">
                  Email: {schoolEmail}
                </p>
              )}
              <p className="text-xs italic mt-2">Motto: "{schoolMotto || ""}"</p>
            </div>
            <h2 className="text-center text-lg font-semibold mt-4 mb-2">{reportCard.termName?.toUpperCase() || 'FIRST TERM'} STUDENT'S PERFORMANCE REPORT</h2>
            <p className="text-center text-xs text-muted-foreground mb-4">Session: {reportCard.academicSession || '2024/2025'}</p>
          </div>

          {/* Section 1: Student Information */}
          <Card className="print:shadow-none print:border-2">
            <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                Student Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex justify-center sm:justify-start">
                  <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-2 border-primary/20">
                    <AvatarImage src={reportCard.studentPhoto || user?.profileImageUrl || ''} alt={`${user?.firstName} ${user?.lastName}`} />
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-bold text-xl">
                      {user.firstName?.[0]}{user.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                </div>
                
                <div className="flex-1">
                  <h3 className="font-bold text-lg sm:text-xl text-center sm:text-left mb-3" data-testid="text-student-name">
                    {reportCard.studentName || `${user.firstName} ${user.lastName}`}
                  </h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs">Admission No</span>
                      <span className="font-medium" data-testid="text-admission-number">
                        {reportCard.admissionNumber || studentDetails?.admissionNumber || 'N/A'}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs">Class / Level</span>
                      <span className="font-medium" data-testid="text-class-name">
                        {reportCard.className || studentDetails?.className || 'N/A'}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs">Term</span>
                      <span className="font-medium" data-testid="text-term">
                        {reportCard.termName || reportCard.term?.name || 'N/A'}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs">Session</span>
                      <span className="font-medium" data-testid="text-session">
                        {reportCard.academicSession || reportCard.termYear || '2024/2025'}
                      </span>
                    </div>
                    {/* Display department for SSS classes */}
                    {reportCard.isSSS && reportCard.department && (
                      <div className="flex flex-col col-span-2">
                        <span className="text-muted-foreground text-xs">Department</span>
                        <span className="font-medium capitalize" data-testid="text-department">
                          {reportCard.department}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Overall Performance Summary */}
          <Card className="print:shadow-none print:border-2">
            <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Overall Performance Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
                <div className="bg-muted/50 p-2 sm:p-3 rounded-md text-center">
                  <p className="text-xs text-muted-foreground">Total Subjects</p>
                  <p className="text-lg sm:text-xl font-bold" data-testid="text-subjects-count">
                    {totalSubjects}
                  </p>
                </div>
                <div className="bg-muted/50 p-2 sm:p-3 rounded-md text-center">
                  <p className="text-xs text-muted-foreground">Total Marks</p>
                  <p className="text-lg sm:text-xl font-bold" data-testid="text-total-score">
                    {totalObtained}<span className="text-sm font-normal text-muted-foreground">/{totalMax}</span>
                  </p>
                </div>
                <div className="bg-muted/50 p-2 sm:p-3 rounded-md text-center">
                  <p className="text-xs text-muted-foreground">Average Score</p>
                  <p className="text-lg sm:text-xl font-bold" data-testid="text-average">
                    {reportCard.averagePercentage || reportCard.summary?.averagePercentage || 0}%
                  </p>
                </div>
                <div className="bg-primary/10 p-2 sm:p-3 rounded-md text-center">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Award className="w-3 h-3" /> Class Position
                  </p>
                  <p className="text-lg sm:text-xl font-bold text-primary" data-testid="text-position">
                    {formatPosition(reportCard.position || reportCard.classRank)} <span className="text-sm font-normal text-muted-foreground">of {reportCard.totalStudentsInClass || reportCard.totalStudents}</span>
                  </p>
                </div>
                <div className="bg-muted/50 p-2 sm:p-3 rounded-md text-center col-span-2 sm:col-span-1">
                  <p className="text-xs text-muted-foreground">Final Grade</p>
                  <Badge className={`text-sm sm:text-base ${getGradeColor(reportCard.overallGrade)}`} data-testid="badge-grade">
                    {reportCard.overallGrade || '-'}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-3">
                <div className="bg-green-50 dark:bg-green-900/20 p-2 sm:p-3 rounded-md text-center">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <TrendingUp className="w-3 h-3 text-green-600" /> Class Highest
                  </p>
                  <p className="text-lg sm:text-xl font-bold text-green-600" data-testid="text-class-highest">
                    {classStats.highestScore}%
                  </p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-2 sm:p-3 rounded-md text-center">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <TrendingDown className="w-3 h-3 text-red-600" /> Class Lowest
                  </p>
                  <p className="text-lg sm:text-xl font-bold text-red-600" data-testid="text-class-lowest">
                    {classStats.lowestScore}%
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-2 sm:p-3 rounded-md text-center">
                  <p className="text-xs text-muted-foreground">Class Average</p>
                  <p className="text-lg sm:text-xl font-bold text-blue-600" data-testid="text-class-average">
                    {classStats.classAverage}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Subject Performance */}
          <Collapsible open={isSubjectsOpen} onOpenChange={setIsSubjectsOpen}>
            <Card className="print:shadow-none print:border-2">
              <CollapsibleTrigger asChild className="print:hidden">
                <CardHeader className="pb-2 pt-3 px-3 sm:px-4 cursor-pointer hover-elevate">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      Subject Performance
                      <span className="text-xs text-muted-foreground font-normal">
                        (Test 40% | Exam 60%)
                      </span>
                    </CardTitle>
                    <div className="sm:hidden">
                      {isSubjectsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CardHeader className="hidden print:block pb-2 pt-3 px-4">
                <CardTitle className="text-base">Subject Performance (Test 40% | Exam 60%)</CardTitle>
              </CardHeader>
              
              <CollapsibleContent className="print:!block">
                <CardContent className="p-0 sm:p-3 print:p-3">
                  {/* Desktop Table View */}
                  <div className="hidden sm:block print:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left p-2 font-semibold border-b">Subject</th>
                          <th className="text-center p-2 font-semibold border-b">Test (40)</th>
                          <th className="text-center p-2 font-semibold border-b">Exam (60)</th>
                          <th className="text-center p-2 font-semibold border-b">Total (100)</th>
                          <th className="text-center p-2 font-semibold border-b">Grade</th>
                          <th className="text-center p-2 font-semibold border-b">Position</th>
                          <th className="text-left p-2 font-semibold border-b">Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjects.map((subject: any, index: number) => {
                          const testScore = subject.testScore ?? subject.testWeightedScore;
                          const examScore = subject.examScore ?? subject.examWeightedScore;
                          const totalScore = subject.obtainedMarks ?? subject.totalScore ?? 0;
                          return (
                            <tr key={subject.subjectName || subject.id} data-testid={`row-subject-${index}`} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                              <td className="p-2 font-medium border-b">{subject.subjectName}</td>
                              <td className="text-center p-2 border-b">
                                {testScore !== '-' && testScore !== null && testScore !== undefined ? `${testScore}/40` : '-'}
                              </td>
                              <td className="text-center p-2 border-b">
                                {examScore !== '-' && examScore !== null && examScore !== undefined ? `${examScore}/60` : '-'}
                              </td>
                              <td className="text-center p-2 font-semibold border-b">
                                {totalScore}/100
                              </td>
                              <td className="text-center p-2 border-b">
                                <Badge className={getGradeColor(subject.grade)}>{subject.grade || '-'}</Badge>
                              </td>
                              <td className="text-center p-2 border-b text-muted-foreground">
                                {subject.subjectPosition ? formatPosition(subject.subjectPosition) : '-'}
                              </td>
                              <td className="p-2 text-xs border-b">
                                <span className={getGradeColor(subject.grade).replace('bg-', 'text-').replace('-100', '-700')}>
                                  {getRemarkFromGrade(subject.grade) || subject.remarks || subject.teacherRemarks}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="block sm:hidden space-y-2 p-3 print:hidden">
                    {subjects.map((subject: any, index: number) => {
                      const testScore = subject.testScore ?? subject.testWeightedScore;
                      const examScore = subject.examScore ?? subject.examWeightedScore;
                      const totalScore = subject.obtainedMarks ?? subject.totalScore ?? 0;
                      return (
                        <div key={subject.subjectName || subject.id} className="bg-muted/30 rounded-md p-3" data-testid={`card-subject-mobile-${index}`}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <h4 className="font-medium text-sm">{subject.subjectName}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge className={`${getGradeColor(subject.grade)} text-xs`}>{subject.grade || '-'}</Badge>
                                <span className="text-xs text-muted-foreground">{totalScore}%</span>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-background p-2 rounded">
                              <p className="text-muted-foreground">Test</p>
                              <p className="font-medium">{testScore ?? '-'}/40</p>
                            </div>
                            <div className="bg-background p-2 rounded">
                              <p className="text-muted-foreground">Exam</p>
                              <p className="font-medium">{examScore ?? '-'}/60</p>
                            </div>
                            <div className="bg-background p-2 rounded">
                              <p className="text-muted-foreground">Total</p>
                              <p className="font-semibold">{totalScore}/100</p>
                            </div>
                          </div>
                          <p className="text-xs mt-2 text-muted-foreground">
                            <span className="font-medium">Remarks:</span> {getRemarkFromGrade(subject.grade) || subject.remarks || subject.teacherRemarks}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Section 4: Attendance & Conduct */}
          <Collapsible open={isAttendanceOpen} onOpenChange={setIsAttendanceOpen}>
            <Card className="print:shadow-none print:border-2">
              <CollapsibleTrigger asChild className="print:hidden">
                <CardHeader className="pb-2 pt-3 px-3 sm:px-4 cursor-pointer hover-elevate">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Attendance & Conduct
                    </CardTitle>
                    <div className="sm:hidden">
                      {isAttendanceOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CardHeader className="hidden print:block pb-2 pt-3 px-4">
                <CardTitle className="text-base">Attendance & Conduct</CardTitle>
              </CardHeader>
              
              <CollapsibleContent className="print:!block">
                <CardContent className="p-3 sm:p-4 pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    <div className="bg-muted/50 p-3 rounded-md text-center">
                      <p className="text-xs text-muted-foreground">School Days</p>
                      <p className="text-xl font-bold">{attendance.timesSchoolOpened}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md text-center">
                      <p className="text-xs text-muted-foreground">Days Present</p>
                      <p className="text-xl font-bold text-green-600">{attendance.timesPresent}</p>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md text-center">
                      <p className="text-xs text-muted-foreground">Days Absent</p>
                      <p className="text-xl font-bold text-red-600">{attendance.timesAbsent}</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md text-center">
                      <p className="text-xs text-muted-foreground">Attendance %</p>
                      <p className="text-xl font-bold text-blue-600">{attendance.attendancePercentage}%</p>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Section 5: Cognitive & Affective Skills */}
          <Collapsible open={isAffectiveOpen} onOpenChange={setIsAffectiveOpen}>
            <Card className="print:shadow-none print:border-2">
              <CollapsibleTrigger asChild className="print:hidden">
                <CardHeader className="pb-2 pt-3 px-3 sm:px-4 cursor-pointer hover-elevate">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                      <Brain className="w-4 h-4" />
                      Cognitive & Affective Skills
                    </CardTitle>
                    <div className="sm:hidden">
                      {isAffectiveOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CardHeader className="hidden print:block pb-2 pt-3 px-4">
                <CardTitle className="text-base">Cognitive & Affective Skills</CardTitle>
              </CardHeader>
              
              <CollapsibleContent className="print:!block">
                <CardContent className="p-3 sm:p-4 pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {affectiveTraitLabels.map(({ key, label }) => (
                      <RatingDisplay key={key} value={affectiveTraits[key as keyof typeof affectiveTraits]} label={label} />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    Rating Scale: 5 = Excellent, 4 = Very Good, 3 = Good, 2 = Fair, 1 = Poor
                  </p>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Section 6: Psychomotor Skills */}
          <Collapsible open={isPsychomotorOpen} onOpenChange={setIsPsychomotorOpen}>
            <Card className="print:shadow-none print:border-2">
              <CollapsibleTrigger asChild className="print:hidden">
                <CardHeader className="pb-2 pt-3 px-3 sm:px-4 cursor-pointer hover-elevate">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Psychomotor Skills
                    </CardTitle>
                    <div className="sm:hidden">
                      {isPsychomotorOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CardHeader className="hidden print:block pb-2 pt-3 px-4">
                <CardTitle className="text-base">Psychomotor Skills</CardTitle>
              </CardHeader>
              
              <CollapsibleContent className="print:!block">
                <CardContent className="p-3 sm:p-4 pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {psychomotorLabels.map(({ key, label }) => (
                      <RatingDisplay key={key} value={psychomotorSkills[key as keyof typeof psychomotorSkills]} label={label} />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    Rating Scale: 5 = Excellent, 4 = Very Good, 3 = Good, 2 = Fair, 1 = Poor
                  </p>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Section 7: Comments */}
          <Card className="print:shadow-none print:border-2">
            <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Comments
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Teacher's Comment</p>
                <div className="bg-muted/50 p-3 rounded-md min-h-[60px]">
                  <p className="text-sm" data-testid="text-teacher-remarks">
                    {reportCard.teacherRemarks || reportCard.teacherComment || 'No comment provided.'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Principal's Comment</p>
                <div className="bg-muted/50 p-3 rounded-md min-h-[60px]">
                  <p className="text-sm" data-testid="text-principal-remarks">
                    {reportCard.principalRemarks || reportCard.principalComment || 'No comment provided.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 8: Signatures */}
          <Card className="print:shadow-none print:border-2">
            <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Pen className="w-4 h-4" />
                Signatures
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="border-b-2 border-dashed border-muted-foreground/30 mb-2 h-16 flex items-end justify-center pb-1">
                    {reportCard.teacherSignatureUrl ? (
                      <img 
                        src={reportCard.teacherSignatureUrl} 
                        alt="Class Teacher's Signature" 
                        className="h-14 max-w-full object-contain"
                        data-testid="img-teacher-signature"
                      />
                    ) : (
                      <span className="text-lg font-serif italic text-muted-foreground/50">________________</span>
                    )}
                  </div>
                  <p className="text-sm font-medium">Class Teacher's Signature</p>
                  {reportCard.teacherSignedAt && (
                    <p className="text-xs text-muted-foreground mt-1" data-testid="text-teacher-signed-date">
                      Signed: {format(new Date(reportCard.teacherSignedAt), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
                
                <div className="text-center">
                  <div className="border-b-2 border-dashed border-muted-foreground/30 mb-2 h-16 flex items-end justify-center pb-1">
                    {reportCard.principalSignatureUrl ? (
                      <img 
                        src={reportCard.principalSignatureUrl} 
                        alt="Principal's Signature" 
                        className="h-14 max-w-full object-contain"
                        data-testid="img-principal-signature"
                      />
                    ) : (
                      <span className="text-lg font-serif italic text-muted-foreground/50">________________</span>
                    )}
                  </div>
                  <p className="text-sm font-medium">Principal's Signature</p>
                  {reportCard.principalSignedAt && (
                    <p className="text-xs text-muted-foreground mt-1" data-testid="text-principal-signed-date">
                      Signed: {format(new Date(reportCard.principalSignedAt), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>Date Issued:</span>
                  <span className="font-medium text-foreground" data-testid="text-date-issued">
                    {format(new Date(), 'MMMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Next Term Begins:</span>
                  <span className="font-medium text-foreground">To be announced</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Print Footer */}
          <div className="hidden print:block mt-6 pt-4 border-t-2 text-center text-sm text-muted-foreground">
            <p className="font-semibold">TREASURE HOME SCHOOL</p>
            <p>Seriki-Soyinka, Ifo, Ogun State, Nigeria</p>
            <p className="italic mt-1">This is a computer-generated report card.</p>
          </div>
        </>
      )}

      {/* Hidden Bailey's Style Template for Export/Print */}
      {reportCard && (
        <div className="fixed left-[-9999px] top-0 z-[-1]">
          <BaileysReportTemplate
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
                subjectPosition: s.subjectPosition || null,
              })),
              teacherRemarks: reportCard.teacherRemarks || reportCard.teacherComment,
              principalRemarks: reportCard.principalRemarks || reportCard.principalComment,
              attendance: attendance,
              affectiveTraits: affectiveTraits,
              psychomotorSkills: psychomotorSkills,
              studentPhoto: reportCard.studentPhoto || user?.profileImageUrl,
              gender: user?.gender || studentDetails?.gender || '',
              dateOfBirth: studentDetails?.dateOfBirth ? format(new Date(studentDetails?.dateOfBirth), 'dd-MMM-yyyy') : '',
              age: calculateAge(studentDetails?.dateOfBirth),
              dateIssued: format(new Date(), 'dd-MMM-yyyy'),
              teacherSignatureUrl: (reportCard as any).teacherSignatureUrl || null,
              principalSignatureUrl: (reportCard as any).principalSignatureUrl || null,
              teacherName: (reportCard as any).teacherName || '',
              principalName: (reportCard as any).principalName || '',
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
