import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { 
  Download, 
  Printer, 
  User,
  GraduationCap,
  Calendar,
  Award,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Edit,
  Save,
  ChevronDown,
  ChevronUp,
  Check,
  Clock,
  BookOpen,
  Star,
  Loader2,
  Lock,
  Users,
  FileText,
  Pen,
  Heart,
  Activity,
  Brain
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { SkillsSection } from '@/components/ui/skill-rating';

interface SubjectScore {
  id: number;
  subjectId: number;
  subjectName: string;
  subjectCode?: string;
  testScore: number | null;
  testMaxScore: number | null;
  testWeightedScore: number | null;
  examScore: number | null;
  examMaxScore: number | null;
  examWeightedScore: number | null;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade: string;
  remarks: string;
  teacherRemarks?: string | null;
  subjectPosition?: number | null;
  isOverridden?: boolean;
  canEditTest?: boolean;
  canEditExam?: boolean;
  canEditRemarks?: boolean;
}

interface ClassStatistics {
  highestScore: number;
  lowestScore: number;
  classAverage: number;
  totalStudents: number;
}

interface AttendanceSummary {
  timesSchoolOpened: number;
  timesPresent: number;
  timesAbsent: number;
  attendancePercentage: number;
}

interface AffectiveTraits {
  punctuality: number;
  neatness: number;
  attentiveness: number;
  teamwork: number;
  leadership: number;
  assignments: number;
  classParticipation: number;
}

interface PsychomotorSkills {
  sports: number;
  handwriting: number;
  musicalSkills: number;
  creativity: number;
}

interface ReportCardData {
  id: number;
  studentId: string;
  studentName: string;
  studentPhoto?: string;
  admissionNumber: string;
  className: string;
  classArm?: string;
  department?: string | null;
  isSSS?: boolean;
  termName: string;
  academicSession?: string;
  averagePercentage: number;
  overallGrade: string;
  position: number;
  totalStudentsInClass: number;
  totalScore?: number;
  items: SubjectScore[];
  teacherRemarks?: string | null;
  principalRemarks?: string | null;
  status: string;
  generatedAt?: string;
  classStatistics?: ClassStatistics;
  attendance?: AttendanceSummary;
  affectiveTraits?: AffectiveTraits;
  psychomotorSkills?: PsychomotorSkills;
  dateIssued?: string;
  teacherSignatureUrl?: string | null;
  teacherSignedAt?: string | null;
  teacherSignedBy?: string | null;
  principalSignatureUrl?: string | null;
  principalSignedAt?: string | null;
  principalSignedBy?: string | null;
}

interface ProfessionalReportCardProps {
  reportCard: ReportCardData;
  testWeight: number;
  examWeight: number;
  onEditSubject?: (item: SubjectScore) => void;
  onSaveRemarks?: (teacherRemarks: string, principalRemarks: string) => void;
  onSaveSkills?: (skills: any) => Promise<void>;
  canEditRemarks?: boolean;
  canEditTeacherRemarks?: boolean;
  canEditPrincipalRemarks?: boolean;
  canEditSkills?: boolean;
  onGenerateDefaultComments?: () => Promise<{ teacherComment: string; principalComment: string }>;
  isLoading?: boolean;
  isFullReportReady?: boolean;
  hideActionButtons?: boolean;
}

// Ratings are now in skill-rating.tsx component

const getGradeColor = (grade: string) => {
  if (!grade) return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  const gradeUpper = grade.toUpperCase();
  if (gradeUpper.startsWith('A')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (gradeUpper.startsWith('B')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  if (gradeUpper.startsWith('C')) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  if (gradeUpper.startsWith('D') || gradeUpper.startsWith('E')) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
};

const getRemarkFromGrade = (grade: string): string => {
  if (!grade) return '-';
  const gradeUpper = grade.toUpperCase();
  if (gradeUpper === 'A' || gradeUpper === 'A+') return 'Excellent';
  if (gradeUpper === 'B' || gradeUpper === 'B+') return 'Very Good';
  if (gradeUpper === 'C' || gradeUpper === 'C+') return 'Good';
  if (gradeUpper === 'D' || gradeUpper === 'D+') return 'Fair';
  if (gradeUpper === 'E') return 'Pass';
  return 'Needs Improvement';
};

const getPositionSuffix = (pos: number): string => {
  if (!pos) return '';
  if (pos >= 11 && pos <= 13) return 'th';
  switch (pos % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

const formatPosition = (pos: number): string => {
  if (!pos) return '-';
  return `${pos}${getPositionSuffix(pos)}`;
};


import { ContactUtils } from '@shared/contact-utils';

// ... existing imports ...

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
  hideActionButtons = false
}: ProfessionalReportCardProps) {
  const { data: settings } = useQuery<any>({
    queryKey: ["/api/public/settings"],
  });

  const schoolName = settings?.schoolName || "";
  const schoolAddress = settings?.schoolAddress || "";
  const schoolMotto = settings?.schoolMotto || "";

  const primaryPhone = ContactUtils.getFormattedPrimaryPhone(settings);
  const primaryEmail = ContactUtils.getPrimaryEmail(settings);
  const phonesList = ContactUtils.getPhones(settings);
  const allPhones = phonesList.length > 0 
    ? phonesList.map(p => `${p.countryCode}${p.number}`).join(', ')
    : "";

  const [isSubjectsOpen, setIsSubjectsOpen] = useState(true);
  const [isAffectiveOpen, setIsAffectiveOpen] = useState(true);
  const [isPsychomotorOpen, setIsPsychomotorOpen] = useState(true);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(true);
  const [isGeneratingComments, setIsGeneratingComments] = useState(false);
  const [isSavingSkills, setIsSavingSkills] = useState(false);
  const [localRemarks, setLocalRemarks] = useState({
    teacher: reportCard.teacherRemarks || '',
    principal: reportCard.principalRemarks || ''
  });
  const [localSkills, setLocalSkills] = useState({
    punctuality: reportCard.affectiveTraits?.punctuality || 0,
    neatness: reportCard.affectiveTraits?.neatness || 0,
    attentiveness: reportCard.affectiveTraits?.attentiveness || 0,
    teamwork: reportCard.affectiveTraits?.teamwork || 0,
    leadership: reportCard.affectiveTraits?.leadership || 0,
    assignments: reportCard.affectiveTraits?.assignments || 0,
    classParticipation: reportCard.affectiveTraits?.classParticipation || 0,
    sports: reportCard.psychomotorSkills?.sports || 0,
    handwriting: reportCard.psychomotorSkills?.handwriting || 0,
    musicalSkills: reportCard.psychomotorSkills?.musicalSkills || 0,
    creativity: reportCard.psychomotorSkills?.creativity || 0
  });
  
  // Baseline snapshot of loaded skills - used to compute diff for save payload
  const initialSkillsRef = useRef<Record<string, number> | null>(null);
  const [skillsLoaded, setSkillsLoaded] = useState(false);
  
  // Track the current report card ID to detect when switching to a different student
  const currentReportCardIdRef = useRef<number>(reportCard.id);
  
  // Track if we're in the middle of a save operation to prevent prop sync from overwriting local state
  const isSavingRef = useRef(false);

  // Sync localSkills when switching to a different report card OR when initial data loads
  // Skip sync during active save operations to prevent flicker
  useEffect(() => {
    const isNewReportCard = reportCard.id !== currentReportCardIdRef.current;
    
    // If switching to a different student, always sync and reset state
    if (isNewReportCard) {
      currentReportCardIdRef.current = reportCard.id;
      initialSkillsRef.current = null;
      setSkillsLoaded(false);
    }
    
    // Skip sync if we're currently saving (prevents flicker from optimistic updates)
    if (isSavingRef.current && !isNewReportCard) {
      return;
    }
    
    const loadedSkills = {
      punctuality: reportCard.affectiveTraits?.punctuality || 0,
      neatness: reportCard.affectiveTraits?.neatness || 0,
      attentiveness: reportCard.affectiveTraits?.attentiveness || 0,
      teamwork: reportCard.affectiveTraits?.teamwork || 0,
      leadership: reportCard.affectiveTraits?.leadership || 0,
      assignments: reportCard.affectiveTraits?.assignments || 0,
      classParticipation: reportCard.affectiveTraits?.classParticipation || 0,
      sports: reportCard.psychomotorSkills?.sports || 0,
      handwriting: reportCard.psychomotorSkills?.handwriting || 0,
      musicalSkills: reportCard.psychomotorSkills?.musicalSkills || 0,
      creativity: reportCard.psychomotorSkills?.creativity || 0
    };
    
    setLocalSkills(loadedSkills);
    
    // Only capture baseline and enable saves when full report is ready
    if (isFullReportReady) {
      initialSkillsRef.current = { ...loadedSkills };
      setSkillsLoaded(true);
    }
  }, [reportCard.id, reportCard.affectiveTraits, reportCard.psychomotorSkills, isFullReportReady]);
  
  // Use explicit permissions if provided, otherwise fall back to canEditRemarks
  const canEditTeacher = canEditTeacherRemarks !== undefined ? canEditTeacherRemarks : canEditRemarks;
  const canEditPrincipal = canEditPrincipalRemarks !== undefined ? canEditPrincipalRemarks : canEditRemarks;
  
  const handleSkillChange = (key: string, value: number) => {
    // Update local state immediately for responsive UI
    setLocalSkills(prev => ({ ...prev, [key]: value }));
    
    // Auto-save to server
    if (onSaveSkills && initialSkillsRef.current && skillsLoaded && !isLoading) {
      const baseline = initialSkillsRef.current[key] ?? 0;
      
      // Only save if value actually changed from baseline
      if (value !== baseline) {
        // Set saving flag to prevent useEffect from overwriting local state
        isSavingRef.current = true;
        setIsSavingSkills(true);
        
        onSaveSkills({ [key]: value })
          .then(() => {
            // Update baseline after successful save
            if (initialSkillsRef.current) {
              initialSkillsRef.current[key] = value;
            }
          })
          .catch((error) => {
            console.error('Failed to save skill:', error);
            // Revert local state on error
            setLocalSkills(prev => ({ ...prev, [key]: baseline }));
          })
          .finally(() => {
            // Clear saving flag after a short delay to allow React to settle
            setTimeout(() => {
              isSavingRef.current = false;
            }, 100);
            setIsSavingSkills(false);
          });
      }
    }
  };
  
  const handleSaveSkills = async () => {
    // Block save if data not loaded or no callback
    if (!onSaveSkills || !initialSkillsRef.current || isLoading || !skillsLoaded) return;
    
    // Build payload with only changed skills (different from baseline)
    const skillsToSave: Record<string, number> = {};
    Object.entries(localSkills).forEach(([key, value]) => {
      const baseline = initialSkillsRef.current![key] ?? 0;
      if (value !== baseline) {
        skillsToSave[key] = value;
      }
    });
    
    // If nothing changed, don't save
    if (Object.keys(skillsToSave).length === 0) {
      return;
    }
    
    isSavingRef.current = true;
    setIsSavingSkills(true);
    
    try {
      await onSaveSkills(skillsToSave);
      // Update baseline after successful save
      initialSkillsRef.current = { ...localSkills };
    } catch (error) {
      console.error('Failed to save skills:', error);
    } finally {
      setTimeout(() => {
        isSavingRef.current = false;
      }, 100);
      setIsSavingSkills(false);
    }
  };

  const handleGenerateComments = async () => {
    if (!onGenerateDefaultComments) return;
    setIsGeneratingComments(true);
    try {
      const comments = await onGenerateDefaultComments();
      if (comments.teacherComment && canEditTeacher) {
        setLocalRemarks(prev => ({ ...prev, teacher: comments.teacherComment }));
      }
      if (comments.principalComment && canEditPrincipal) {
        setLocalRemarks(prev => ({ ...prev, principal: comments.principalComment }));
      }
    } catch (error) {
      console.error('Failed to generate comments:', error);
    } finally {
      setIsGeneratingComments(false);
    }
  };
  
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    window.print();
  };

  const attendance = reportCard.attendance || {
    timesSchoolOpened: 0,
    timesPresent: 0,
    timesAbsent: 0,
    attendancePercentage: 0
  };

  const classStats = reportCard.classStatistics || {
    highestScore: 0,
    lowestScore: 0,
    classAverage: 0,
    totalStudents: reportCard.totalStudentsInClass || 0
  };

  const affectiveTraits = reportCard.affectiveTraits || {
    punctuality: 0,
    neatness: 0,
    attentiveness: 0,
    teamwork: 0,
    leadership: 0,
    assignments: 0,
    classParticipation: 0
  };

  const psychomotorSkills = reportCard.psychomotorSkills || {
    sports: 0,
    handwriting: 0,
    musicalSkills: 0,
    creativity: 0
  };

  const totalSubjects = reportCard.items?.length || 0;
  const totalObtained = reportCard.items?.reduce((sum, item) => sum + (item.obtainedMarks || 0), 0) || 0;
  const totalMax = reportCard.items?.reduce((sum, item) => sum + (item.totalMarks || 100), 0) || 0;

  const affectiveTraitLabels: { key: keyof AffectiveTraits; label: string }[] = [
    { key: 'punctuality', label: 'Punctuality' },
    { key: 'neatness', label: 'Neatness' },
    { key: 'attentiveness', label: 'Attentiveness' },
    { key: 'teamwork', label: 'Teamwork' },
    { key: 'leadership', label: 'Leadership' },
    { key: 'assignments', label: 'Assignments/Homework' },
    { key: 'classParticipation', label: 'Class Participation' }
  ];

  const psychomotorLabels: { key: keyof PsychomotorSkills; label: string }[] = [
    { key: 'sports', label: 'Sports' },
    { key: 'handwriting', label: 'Handwriting' },
    { key: 'musicalSkills', label: 'Musical Skills' },
    { key: 'creativity', label: 'Creativity / Craft' }
  ];

  return (
    <div ref={printRef} className="w-full bg-background print:bg-white">
      {/* School Header - Visible on screen */}
      <div className="mb-4 p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-md border print:hidden">
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold text-primary">{schoolName}</h1>
          <p className="text-sm font-medium">{schoolAddress}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Contact: {primaryPhone}
          </p>
          {primaryEmail && (
            <p className="text-xs text-muted-foreground">
              Email: {primaryEmail}
            </p>
          )}
          <p className="text-xs italic mt-2">Motto: "{schoolMotto}"</p>
          <Separator className="my-3" />
          <h2 className="text-lg font-semibold">{reportCard.termName?.toUpperCase() || 'FIRST TERM'} STUDENT'S PERFORMANCE REPORT</h2>
          <p className="text-xs text-muted-foreground">Session: {reportCard.academicSession || '2024/2025'}</p>
        </div>
      </div>

      {/* Print Header - Hidden on screen, shown only when printing */}
      <div className="hidden print:block mb-6">
        <div className="text-center border-b-2 border-primary pb-4">
          <h1 className="text-2xl font-bold text-primary">{schoolName}</h1>
          <p className="text-sm font-medium">{schoolAddress}</p>
          <p className="text-xs text-muted-foreground">
            {phonesList.length > 1 ? `Contacts: ${allPhones}` : `Contact: ${primaryPhone}`}
          </p>
          {primaryEmail && (
            <p className="text-xs text-muted-foreground">
              Email: {primaryEmail}
            </p>
          )}
          <p className="text-xs italic mt-2">Motto: "{schoolMotto}"</p>
        </div>
        <h2 className="text-center text-lg font-semibold mt-4 mb-2">{reportCard.termName?.toUpperCase() || 'FIRST TERM'} STUDENT'S PERFORMANCE REPORT</h2>
        <p className="text-center text-xs text-muted-foreground mb-4">
          Session: {reportCard.academicSession || '2024/2025'}
        </p>
        <p className="text-center text-xs text-muted-foreground">
          Contact: {primaryPhone}
        </p>
        {primaryEmail && (
          <p className="text-center text-xs text-muted-foreground mb-4">
            Email: {primaryEmail}
          </p>
        )}
      </div>

      {/* Action Buttons - Screen only, hidden when parent provides action bar */}
      {!hideActionButtons && (
        <div className="flex flex-wrap items-center gap-2 mb-4 print:hidden">
          <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print">
            <Printer className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Print</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} data-testid="button-export-pdf">
            <Download className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Export PDF</span>
          </Button>
        </div>
      )}

      {/* Section 1: Student Information */}
      <Card className="mb-4 print:shadow-none print:border-2">
        <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <User className="w-4 h-4" />
            Student Information
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Student Photo */}
            <div className="flex justify-center sm:justify-start">
              <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-2 border-primary/20 print:border-primary print:hidden">
                {reportCard.studentPhoto ? (
                  <AvatarImage src={reportCard.studentPhoto} alt={reportCard.studentName} crossOrigin="anonymous" />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-bold text-xl">
                  {reportCard.studentName?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || <User className="w-8 h-8" />}
                </AvatarFallback>
              </Avatar>
              {/* Print-safe image fallback — AvatarImage uses JS load detection that may fail in print window contexts */}
              {reportCard.studentPhoto ? (
                <img
                  src={reportCard.studentPhoto}
                  alt={reportCard.studentName}
                  crossOrigin="anonymous"
                  className="hidden print:block h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover border-2 border-primary"
                />
              ) : (
                <div className="hidden print:flex h-20 w-20 sm:h-24 sm:w-24 rounded-full border-2 border-primary bg-gray-100 items-center justify-center">
                  <span className="text-primary font-bold text-xl">
                    {reportCard.studentName?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            
            {/* Student Details - Responsive Grid */}
            <div className="flex-1">
              <h3 className="font-bold text-lg sm:text-xl text-center sm:text-left mb-3" data-testid="text-student-name">
                {reportCard.studentName}
              </h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">Admission No</span>
                  <span className="font-medium" data-testid="text-admission-number">{reportCard.admissionNumber}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">Class / Level</span>
                  <span className="font-medium" data-testid="text-class-name">{reportCard.className}{reportCard.classArm ? ` (${reportCard.classArm})` : ''}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">Term</span>
                  <span className="font-medium" data-testid="text-term">{reportCard.termName}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-xs">Session</span>
                  <span className="font-medium" data-testid="text-session">{reportCard.academicSession || '2024/2025'}</span>
                </div>
                {/* Display department for SSS classes */}
                {reportCard.isSSS && reportCard.department && (
                  <div className="flex flex-col col-span-2">
                    <span className="text-muted-foreground text-xs">Department</span>
                    <span className="font-medium capitalize" data-testid="text-department">{reportCard.department}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Overall Performance Summary */}
      <Card className="mb-4 print:shadow-none print:border-2">
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
                {reportCard.averagePercentage || 0}%
              </p>
            </div>
            <div className="bg-primary/10 p-2 sm:p-3 rounded-md text-center">
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Award className="w-3 h-3" /> Class Position
              </p>
              <p className="text-lg sm:text-xl font-bold text-primary" data-testid="text-position">
                {formatPosition(reportCard.position)} <span className="text-sm font-normal text-muted-foreground">of {reportCard.totalStudentsInClass}</span>
              </p>
            </div>
            <div className="bg-muted/50 p-2 sm:p-3 rounded-md text-center col-span-2 sm:col-span-1">
              <p className="text-xs text-muted-foreground">Final Grade</p>
              <Badge className={`text-sm sm:text-base ${getGradeColor(reportCard.overallGrade)}`} data-testid="badge-grade">
                {reportCard.overallGrade || '-'}
              </Badge>
            </div>
          </div>

          {/* Class Statistics Row */}
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

      {/* Section 3: Subject Performance (Core Academic Fields) */}
      <Collapsible open={isSubjectsOpen} onOpenChange={setIsSubjectsOpen} className="mb-4">
        <Card className="print:shadow-none print:border-2">
          <CollapsibleTrigger asChild className="print:hidden">
            <CardHeader className="pb-2 pt-3 px-3 sm:px-4 cursor-pointer hover-elevate">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Subject Performance
                  <span className="text-xs text-muted-foreground font-normal">
                    (Test {testWeight}% | Exam {examWeight}%)
                  </span>
                </CardTitle>
                <div className="flex items-center gap-2 sm:hidden">
                  {isSubjectsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          {/* Print Header */}
          <CardHeader className="hidden print:block pb-2 pt-3 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              Subject Performance (Test {testWeight}% | Exam {examWeight}%)
            </CardTitle>
          </CardHeader>
          
          <CollapsibleContent className="print:!block">
            <CardContent className="p-0 sm:p-3 print:p-3">
              {/* Desktop Table View */}
              <div className="hidden sm:block print:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-2 font-semibold border-b">Subject</th>
                      <th className="text-center p-2 font-semibold border-b">Test ({testWeight})</th>
                      <th className="text-center p-2 font-semibold border-b">Exam ({examWeight})</th>
                      <th className="text-center p-2 font-semibold border-b">Total (100)</th>
                      <th className="text-center p-2 font-semibold border-b">Grade</th>
                      <th className="text-center p-2 font-semibold border-b">Position</th>
                      <th className="text-left p-2 font-semibold border-b">Remarks</th>
                      <th className="text-center p-2 font-semibold border-b print:hidden">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportCard.items?.map((item, index) => (
                      <tr key={item.id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                        <td className="p-2 font-medium border-b">{item.subjectName}</td>
                        <td className="text-center p-2 border-b">
                          {item.testScore !== null ? item.testScore : '-'}/{item.testMaxScore || testWeight}
                        </td>
                        <td className="text-center p-2 border-b">
                          {item.examScore !== null ? item.examScore : '-'}/{item.examMaxScore || examWeight}
                        </td>
                        <td className="text-center p-2 font-semibold border-b">
                          {item.obtainedMarks || 0}/100
                        </td>
                        <td className="text-center p-2 border-b">
                          <Badge className={`${getGradeColor(item.grade)}`}>{item.grade || '-'}</Badge>
                        </td>
                        <td className="text-center p-2 border-b text-muted-foreground">
                          {item.subjectPosition ? formatPosition(item.subjectPosition) : '-'}
                        </td>
                        <td className="p-2 text-xs border-b max-w-[120px]">
                          <span className={getGradeColor(item.grade).replace('bg-', 'text-').replace('-100', '-700')}>
                            {item.remarks || item.teacherRemarks || getRemarkFromGrade(item.grade)}
                          </span>
                        </td>
                        <td className="text-center p-2 border-b print:hidden">
                          {(item.canEditTest || item.canEditExam || item.canEditRemarks) && onEditSubject && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => onEditSubject(item)}
                              data-testid={`button-edit-subject-${item.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="block sm:hidden space-y-2 p-3 print:hidden">
                {reportCard.items?.map((item) => (
                  <div key={item.id} className="bg-muted/30 rounded-md p-3" data-testid={`card-subject-${item.id}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="font-medium text-sm">{item.subjectName}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`${getGradeColor(item.grade)} text-xs`}>{item.grade || '-'}</Badge>
                          <span className="text-xs text-muted-foreground">{item.percentage || 0}%</span>
                          {item.subjectPosition && (
                            <span className="text-xs text-muted-foreground">Pos: {formatPosition(item.subjectPosition)}</span>
                          )}
                        </div>
                      </div>
                      {(item.canEditTest || item.canEditExam || item.canEditRemarks) && onEditSubject && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onEditSubject(item)}
                          className="h-8 w-8"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-background p-2 rounded">
                        <p className="text-muted-foreground">Test</p>
                        <p className="font-medium">{item.testScore !== null ? item.testScore : '-'}/{item.testMaxScore || testWeight}</p>
                      </div>
                      <div className="bg-background p-2 rounded">
                        <p className="text-muted-foreground">Exam</p>
                        <p className="font-medium">{item.examScore !== null ? item.examScore : '-'}/{item.examMaxScore || examWeight}</p>
                      </div>
                      <div className="bg-background p-2 rounded">
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-semibold">{item.obtainedMarks || 0}/100</p>
                      </div>
                    </div>
                    <p className="text-xs mt-2 text-muted-foreground">
                      <span className="font-medium">Remarks:</span> {item.remarks || item.teacherRemarks || getRemarkFromGrade(item.grade)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Section 4: Attendance & Conduct */}
      <Collapsible open={isAttendanceOpen} onOpenChange={setIsAttendanceOpen} className="mb-4">
        <Card className="print:shadow-none print:border-2">
          <CollapsibleTrigger asChild className="print:hidden">
            <CardHeader className="pb-2 pt-3 px-3 sm:px-4 cursor-pointer hover-elevate">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Attendance & Conduct
                </CardTitle>
                <div className="flex items-center gap-2 sm:hidden">
                  {isAttendanceOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CardHeader className="hidden print:block pb-2 pt-3 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              Attendance & Conduct
            </CardTitle>
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
      <Collapsible open={isAffectiveOpen} onOpenChange={setIsAffectiveOpen} className="mb-4">
        <Card className="print:shadow-none print:border-2">
          <CollapsibleTrigger asChild className="print:hidden">
            <CardHeader className="pb-2 pt-3 px-3 sm:px-4 cursor-pointer hover-elevate">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  Cognitive & Affective Skills
                </CardTitle>
                <div className="flex items-center gap-2 sm:hidden">
                  {isAffectiveOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CardHeader className="hidden print:block pb-2 pt-3 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              Cognitive & Affective Skills
            </CardTitle>
          </CardHeader>
          
          <CollapsibleContent className="print:!block">
            <CardContent className="p-3 sm:p-4 pt-0">
              <SkillsSection
                title="Affective Skills"
                icon={<Brain className="w-4 h-4" />}
                items={affectiveTraitLabels}
                values={canEditSkills ? (localSkills as unknown as Record<string, number>) : (affectiveTraits as unknown as Record<string, number>)}
                onRatingChange={handleSkillChange}
                canEdit={canEditSkills}
                bgColor="blue"
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Section 6: Psychomotor Skills */}
      <Collapsible open={isPsychomotorOpen} onOpenChange={setIsPsychomotorOpen} className="mb-4">
        <Card className="print:shadow-none print:border-2">
          <CollapsibleTrigger asChild className="print:hidden">
            <CardHeader className="pb-2 pt-3 px-3 sm:px-4 cursor-pointer hover-elevate">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Psychomotor Skills
                </CardTitle>
                <div className="flex items-center gap-2 sm:hidden">
                  {isPsychomotorOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CardHeader className="hidden print:block pb-2 pt-3 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              Psychomotor Skills
            </CardTitle>
          </CardHeader>
          
          <CollapsibleContent className="print:!block">
            <CardContent className="p-3 sm:p-4 pt-0">
              <SkillsSection
                title="Psychomotor Skills"
                icon={<Activity className="w-4 h-4" />}
                items={psychomotorLabels}
                values={canEditSkills ? (localSkills as unknown as Record<string, number>) : (psychomotorSkills as unknown as Record<string, number>)}
                onRatingChange={handleSkillChange}
                canEdit={canEditSkills}
                bgColor="purple"
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Section 7: Comments */}
      <Card className="mb-4 print:shadow-none print:border-2">
        <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Comments
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0 space-y-4">
          {/* Generate Default Comments Button */}
          {(canEditTeacher || canEditPrincipal) && onGenerateDefaultComments && (
            <div className="flex justify-end print:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateComments}
                disabled={isGeneratingComments}
                data-testid="button-generate-comments"
              >
                {isGeneratingComments ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Star className="w-4 h-4 mr-2" />
                )}
                Generate Default Comments
              </Button>
            </div>
          )}
          
          {/* Teacher's Comment */}
          <div>
            <Label className="text-sm font-medium text-muted-foreground mb-2 block flex items-center gap-2">
              Class Teacher's Comment
              {!canEditTeacher && canEditPrincipal && (
                <Badge variant="secondary" className="text-xs font-normal">
                  <Lock className="w-3 h-3 mr-1" />
                  View Only
                </Badge>
              )}
            </Label>
            {canEditTeacher ? (
              <Textarea
                value={localRemarks.teacher}
                onChange={(e) => setLocalRemarks(prev => ({ ...prev, teacher: e.target.value }))}
                placeholder="Enter class teacher's comment..."
                className="min-h-[80px]"
                data-testid="textarea-teacher-remarks"
              />
            ) : (
              <div className="bg-muted/50 p-3 rounded-md min-h-[60px]">
                <p className="text-sm" data-testid="text-teacher-remarks">
                  {reportCard.teacherRemarks || 'No comment provided.'}
                </p>
              </div>
            )}
          </div>

          {/* Principal's Comment */}
          <div>
            <Label className="text-sm font-medium text-muted-foreground mb-2 block flex items-center gap-2">
              Principal's Comment
              {canEditTeacher && !canEditPrincipal && (
                <Badge variant="secondary" className="text-xs font-normal">
                  <Lock className="w-3 h-3 mr-1" />
                  Admin Only
                </Badge>
              )}
            </Label>
            {canEditPrincipal ? (
              <Textarea
                value={localRemarks.principal}
                onChange={(e) => setLocalRemarks(prev => ({ ...prev, principal: e.target.value }))}
                placeholder="Enter principal's comment..."
                className="min-h-[80px]"
                data-testid="textarea-principal-remarks"
              />
            ) : (
              <div className="bg-muted/50 p-3 rounded-md min-h-[60px]">
                <p className="text-sm" data-testid="text-principal-remarks">
                  {reportCard.principalRemarks || 'No comment provided.'}
                </p>
              </div>
            )}
          </div>

          {/* Save Button */}
          {(canEditTeacher || canEditPrincipal) && onSaveRemarks && (
            <div className="flex justify-end print:hidden">
              <Button
                onClick={() => onSaveRemarks(localRemarks.teacher, localRemarks.principal)}
                disabled={isLoading}
                data-testid="button-save-remarks"
              >
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Comments
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 8: Signatures & Administrative Fields */}
      <Card className="print:shadow-none print:border-2">
        <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Pen className="w-4 h-4" />
            Signatures
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Teacher's Signature */}
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
            
            {/* Principal's Signature */}
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

          {/* Date Issued */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>Date Issued:</span>
              <span className="font-medium text-foreground" data-testid="text-date-issued">
                {reportCard.dateIssued || reportCard.generatedAt 
                  ? format(new Date(reportCard.dateIssued || reportCard.generatedAt || new Date()), 'MMMM d, yyyy')
                  : format(new Date(), 'MMMM d, yyyy')}
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

      {/* School Footer for Print */}
      <div className="hidden print:block mt-6 pt-4 border-t-2 text-center text-sm text-muted-foreground">
        <p className="font-semibold uppercase">{schoolName || ""}</p>
        <p>{schoolAddress || ""}</p>
        <p className="italic mt-1">This is a computer-generated report card.</p>
      </div>
    </div>
  );
}
