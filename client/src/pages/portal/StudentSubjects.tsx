import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
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
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useLocation } from 'wouter';

const CATEGORY_CONFIG: Record<string, {
  label: string;
  icon: any;
  accent: string;
  badge: string;
  heading: string;
}> = {
  general: {
    label: 'General',
    icon: BookMarked,
    accent: 'bg-slate-400 dark:bg-slate-500',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    heading: 'text-slate-700 dark:text-slate-300',
  },
  science: {
    label: 'Science',
    icon: GraduationCap,
    accent: 'bg-blue-500 dark:bg-blue-600',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    heading: 'text-blue-700 dark:text-blue-300',
  },
  art: {
    label: 'Art',
    icon: Palette,
    accent: 'bg-purple-500 dark:bg-purple-600',
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    heading: 'text-purple-700 dark:text-purple-300',
  },
  commercial: {
    label: 'Commercial',
    icon: Briefcase,
    accent: 'bg-amber-500 dark:bg-amber-600',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    heading: 'text-amber-700 dark:text-amber-300',
  },
};

export default function StudentSubjects() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

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

  const groupedSubjects: Record<string, any[]> = assignedSubjects.reduce(
    (acc: Record<string, any[]>, subject: any) => {
      const category = (subject.category || 'general').toLowerCase();
      if (!acc[category]) acc[category] = [];
      acc[category].push(subject);
      return acc;
    },
    {} as Record<string, any[]>
  );

  const getTeacher = (subjectId: number) => subjectTeachers[subjectId] || null;
  const getActiveExams = (subjectId: number) => examData.activeExams[subjectId] || [];
  const isActive = (subjectId: number) => getActiveExams(subjectId).length > 0;

  const totalActiveExams = Object.values(examData.activeExams).flat().length;
  const isLoading = studentLoading || subjectsLoading;

  return (
    <div className="space-y-6 pb-8" data-testid="student-subjects">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Subjects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {studentInfo?.className
              ? `${studentInfo.className}${studentInfo.department ? ` · ${studentInfo.department} Department` : ''}`
              : 'Your assigned subjects and teachers'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/portal/student/report-card')}
          data-testid="button-view-report-card"
          className="self-start sm:self-auto"
        >
          <FileText className="w-4 h-4 mr-2" />
          View Report Card
        </Button>
      </div>

      {/* Summary Strip */}
      {!isLoading && (
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-sm font-medium">
            <GraduationCap className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Class:</span>
            <span>{studentInfo?.className || 'Not Assigned'}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-sm font-medium">
            <BookMarked className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Subjects:</span>
            <span>{assignedSubjects.length}</span>
          </div>
          {totalActiveExams > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              <span>{totalActiveExams} Active Exam{totalActiveExams !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && assignedSubjects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-muted-foreground opacity-60" />
          </div>
          <p className="text-base font-medium">No Subjects Assigned</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Your subjects haven't been assigned yet. Please contact your class teacher or administrator.
          </p>
        </div>
      )}

      {/* Subjects by Category */}
      {!isLoading && assignedSubjects.length > 0 && (
        <div className="space-y-8">
          {Object.entries(groupedSubjects).map(([category, subjects]: [string, any[]]) => {
            const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.general;
            const CategoryIcon = config.icon;

            return (
              <section key={category}>
                {/* Category Heading */}
                <div className="flex items-center gap-2 mb-4">
                  <CategoryIcon className={`w-5 h-5 ${config.heading}`} />
                  <h2 className={`text-base font-semibold ${config.heading}`}>
                    {config.label} Subjects
                  </h2>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.badge}`}>
                    {subjects.length}
                  </span>
                </div>

                {/* Subject Cards Grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {subjects.map((subject: any) => {
                    const subjectId = subject.id || subject.subjectId;
                    const teacher = getTeacher(subjectId);
                    const activeExams = getActiveExams(subjectId);
                    const active = isActive(subjectId);

                    return (
                      <Card
                        key={subjectId}
                        className={`relative overflow-hidden border transition-shadow duration-200 hover:shadow-md ${
                          active ? 'ring-2 ring-amber-400 dark:ring-amber-500' : ''
                        }`}
                        data-testid={`subject-card-${subjectId}`}
                      >
                        {/* Color Accent Bar */}
                        <div className={`h-1 w-full ${active ? 'bg-amber-400' : config.accent}`} />

                        <CardContent className="p-4 space-y-3">
                          {/* Subject Name + Active Badge */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="font-semibold text-sm leading-snug line-clamp-2">
                                {subject.subjectName || subject.name}
                              </h3>
                              <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wide">
                                {subject.subjectCode || subject.code}
                              </p>
                            </div>
                            {active && (
                              <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-xs shrink-0 flex items-center gap-1 px-2">
                                <Sparkles className="w-3 h-3" />
                                {activeExams.length}
                              </Badge>
                            )}
                          </div>

                          {/* Teacher */}
                          {teacher ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="w-7 h-7 shrink-0">
                                <AvatarImage
                                  src={teacher.profileImageUrl || undefined}
                                  alt={`${teacher.firstName} ${teacher.lastName}`}
                                />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                                  {(teacher.firstName?.[0] || '') + (teacher.lastName?.[0] || '')}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate">
                                  {teacher.firstName} {teacher.lastName}
                                </p>
                                <p className="text-xs text-muted-foreground">Teacher</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                                <User className="w-3.5 h-3.5" />
                              </div>
                              <p className="text-xs">No teacher assigned</p>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              variant={active ? 'default' : 'outline'}
                              className={`flex-1 h-8 text-xs ${active ? 'bg-amber-500 hover:bg-amber-600 border-amber-500' : ''}`}
                              onClick={() => navigate(`/portal/student/exams?subject=${subjectId}`)}
                              data-testid={`button-view-exams-${subjectId}`}
                            >
                              <ClipboardList className="w-3.5 h-3.5 mr-1" />
                              Exams
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-8 text-xs"
                              onClick={() => navigate(`/portal/student/exam-results?subject=${subjectId}`)}
                              data-testid={`button-view-scores-${subjectId}`}
                            >
                              <Award className="w-3.5 h-3.5 mr-1" />
                              Scores
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
