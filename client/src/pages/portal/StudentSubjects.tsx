import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { 
  BookOpen, 
  GraduationCap, 
  Palette, 
  Briefcase, 
  BookMarked, 
  User, 
  ClipboardList, 
  FileText, 
  Award, 
  Clock, 
  AlertCircle,
  TrendingUp,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useLocation } from 'wouter';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string; borderColor: string }> = {
  general: { 
    label: 'General', 
    icon: BookMarked, 
    color: 'text-slate-700 dark:text-slate-300',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
    borderColor: 'border-slate-200 dark:border-slate-700'
  },
  science: { 
    label: 'Science', 
    icon: GraduationCap, 
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900',
    borderColor: 'border-blue-200 dark:border-blue-800'
  },
  art: { 
    label: 'Art', 
    icon: Palette, 
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-100 dark:bg-purple-900',
    borderColor: 'border-purple-200 dark:border-purple-800'
  },
  commercial: { 
    label: 'Commercial', 
    icon: Briefcase, 
    color: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-100 dark:bg-amber-900',
    borderColor: 'border-amber-200 dark:border-amber-800'
  },
};

export default function StudentSubjects() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const userName = user ? `${user.firstName} ${user.lastName}` : 'Student';
  const userInitials = user ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}` : 'S';
  const userRole = 'student' as const;

  const { data: studentInfo, isLoading: studentLoading } = useQuery({
    queryKey: ['/api/students/me'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/students/me');
      return await response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: assignedSubjects = [], isLoading: subjectsLoading } = useQuery({
    queryKey: ['/api/my-subjects'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/my-subjects');
      return await response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: subjectTeachers = {} } = useQuery({
    queryKey: ['/api/my-subject-teachers'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/my-subject-teachers');
      return await response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: examData = { activeExams: {}, examCounts: {} } } = useQuery({
    queryKey: ['/api/my-active-exams'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/my-active-exams');
      return await response.json();
    },
    staleTime: 3 * 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
  });

  const groupedSubjects: Record<string, any[]> = assignedSubjects.reduce((acc: Record<string, any[]>, subject: any) => {
    const category = (subject.category || 'general').toLowerCase();
    if (!acc[category]) acc[category] = [];
    acc[category].push(subject);
    return acc;
  }, {} as Record<string, any[]>);

  const getTeacherForSubject = (subjectId: number) => {
    return subjectTeachers[subjectId] || null;
  };

  const getActiveExamsForSubject = (subjectId: number) => {
    return examData.activeExams[subjectId] || [];
  };

  const getExamCountForSubject = (subjectId: number) => {
    return examData.examCounts[subjectId] || 0;
  };

  const hasActiveExams = (subjectId: number) => {
    return getActiveExamsForSubject(subjectId).length > 0;
  };

  const handleViewExams = (subjectId: number) => {
    navigate(`/portal/student/exams?subject=${subjectId}`);
  };

  const handleViewScores = (subjectId: number) => {
    navigate(`/portal/student/exam-results?subject=${subjectId}`);
  };

  const handleViewReportCard = () => {
    navigate('/portal/student/report-card');
  };

  const isLoading = studentLoading || subjectsLoading;

  const totalActiveExams = Object.values(examData.activeExams).flat().length;

  return (
    <>
      <div className="space-y-6" data-testid="student-subjects">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">My Subjects</h1>
            <p className="text-muted-foreground mt-1">
              {studentInfo?.className 
                ? `Subjects assigned to you in ${studentInfo.className}${studentInfo.department ? ` (${studentInfo.department} Department)` : ''}`
                : 'View your assigned subjects and teachers'}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleViewReportCard}
            data-testid="button-view-report-card"
          >
            <FileText className="w-4 h-4 mr-2" />
            View Report Card
          </Button>
        </div>

        {studentInfo && (
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">Class:</span>
                  <Badge variant="secondary">{studentInfo.className || 'Not Assigned'}</Badge>
                </div>
                {studentInfo.department && (
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-muted-foreground" />
                    <span className="font-medium">Department:</span>
                    <Badge className={CATEGORY_CONFIG[studentInfo.department.toLowerCase()]?.bgColor || 'bg-muted'}>
                      {studentInfo.department}
                    </Badge>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <BookMarked className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">Total Subjects:</span>
                  <Badge variant="outline">{assignedSubjects.length}</Badge>
                </div>
                {totalActiveExams > 0 && (
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    <span className="font-medium">Active Exams:</span>
                    <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">
                      {totalActiveExams}
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : assignedSubjects.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No Subjects Assigned</p>
                <p className="text-sm mt-2">
                  Your subjects haven't been assigned yet. Please contact your class teacher or administrator.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedSubjects).map(([category, subjects]: [string, any[]]) => {
              const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.general;
              const CategoryIcon = config.icon;
              
              return (
                <Card key={category}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <CategoryIcon className={`w-5 h-5 ${config.color}`} />
                      {config.label} Subjects
                      <Badge variant="secondary" className="ml-2">{subjects.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {subjects.map((subject: any) => {
                        const subjectId = subject.id || subject.subjectId;
                        const teacher = getTeacherForSubject(subjectId);
                        const activeExams = getActiveExamsForSubject(subjectId);
                        const examCount = getExamCountForSubject(subjectId);
                        const isActive = hasActiveExams(subjectId);
                        
                        return (
                          <Card 
                            key={subjectId}
                            className={`overflow-hidden transition-all duration-200 ${
                              isActive 
                                ? 'ring-2 ring-amber-400 dark:ring-amber-500 shadow-lg' 
                                : 'hover:shadow-md'
                            }`}
                            data-testid={`subject-card-${subjectId}`}
                          >
                            <div className={`h-1.5 ${isActive ? 'bg-gradient-to-r from-amber-400 to-amber-500' : config.bgColor}`} />
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-lg truncate">
                                    {subject.subjectName || subject.name}
                                  </h3>
                                  <p className="text-sm text-muted-foreground">
                                    {subject.subjectCode || subject.code}
                                  </p>
                                </div>
                                {isActive && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant="default" className="bg-amber-500 hover:bg-amber-600 flex items-center gap-1 shrink-0">
                                        <Sparkles className="w-3 h-3" />
                                        {activeExams.length} Active
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                      <p className="font-medium mb-1">Active Exams:</p>
                                      <ul className="text-xs space-y-1">
                                        {activeExams.slice(0, 3).map((exam: any) => (
                                          <li key={exam.id} className="flex items-center gap-1">
                                            <ClipboardList className="w-3 h-3" />
                                            {exam.title}
                                          </li>
                                        ))}
                                        {activeExams.length > 3 && (
                                          <li className="text-muted-foreground">+{activeExams.length - 3} more</li>
                                        )}
                                      </ul>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>

                              {teacher && (
                                <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                                  <Avatar className="w-8 h-8 shrink-0">
                                    <AvatarImage 
                                      src={teacher.profileImageUrl || undefined} 
                                      alt={`${teacher.firstName} ${teacher.lastName}`}
                                    />
                                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                      {(teacher.firstName?.[0] || '') + (teacher.lastName?.[0] || '')}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {teacher.firstName} {teacher.lastName}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Subject Teacher</p>
                                  </div>
                                </div>
                              )}

                              {!teacher && (
                                <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30 border border-dashed">
                                  <Avatar className="w-8 h-8 shrink-0">
                                    <AvatarFallback className="bg-muted text-muted-foreground">
                                      <User className="w-4 h-4" />
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-muted-foreground">No teacher assigned</p>
                                  </div>
                                </div>
                              )}

                              {examCount > 0 && !isActive && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <ClipboardList className="w-4 h-4" />
                                  <span>{examCount} exam{examCount > 1 ? 's' : ''} available</span>
                                </div>
                              )}

                              <div className="flex gap-2 pt-2">
                                <Button
                                  size="sm"
                                  variant={isActive ? "default" : "outline"}
                                  className={`flex-1 ${isActive ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
                                  onClick={() => handleViewExams(subjectId)}
                                  data-testid={`button-view-exams-${subjectId}`}
                                >
                                  <ClipboardList className="w-4 h-4 mr-1" />
                                  Exams
                                  {isActive && (
                                    <Badge variant="secondary" className="ml-1 bg-white/20 text-white">
                                      {activeExams.length}
                                    </Badge>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => handleViewScores(subjectId)}
                                  data-testid={`button-view-scores-${subjectId}`}
                                >
                                  <Award className="w-4 h-4 mr-1" />
                                  Scores
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
