import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Award,
  Sparkles,
  FileText,
  FolderOpen,
  Layers,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useLocation } from 'wouter';

const CATEGORY_CONFIG: Record<string, {
  label: string;
  icon: any;
  gradient: string;
  headerText: string;
  accent: string;
  badge: string;
}> = {
  general: {
    label: 'General',
    icon: BookMarked,
    gradient: 'from-slate-500 to-slate-600',
    headerText: 'text-white',
    accent: 'bg-slate-500',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  science: {
    label: 'Science',
    icon: GraduationCap,
    gradient: 'from-blue-500 to-blue-700',
    headerText: 'text-white',
    accent: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  art: {
    label: 'Art',
    icon: Palette,
    gradient: 'from-purple-500 to-purple-700',
    headerText: 'text-white',
    accent: 'bg-purple-500',
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  },
  commercial: {
    label: 'Commercial',
    icon: Briefcase,
    gradient: 'from-amber-500 to-amber-700',
    headerText: 'text-white',
    accent: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  },
};

export default function StudentSubjects() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: studentInfo, isLoading: studentLoading } = useQuery({
    queryKey: ['/api/students/me'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/students/me');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: assignedSubjects = [], isLoading: subjectsLoading } = useQuery({
    queryKey: ['/api/my-subjects'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/my-subjects');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: subjectTeachers = {} } = useQuery({
    queryKey: ['/api/my-subject-teachers'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/my-subject-teachers');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: examData = { activeExams: {}, examCounts: {} } } = useQuery({
    queryKey: ['/api/my-active-exams'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/my-active-exams');
      return res.json();
    },
    staleTime: 3 * 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
  });

  const groupedSubjects: Record<string, any[]> = assignedSubjects.reduce(
    (acc: Record<string, any[]>, subject: any) => {
      const cat = (subject.category || 'general').toLowerCase();
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(subject);
      return acc;
    },
    {}
  );

  const getTeacher = (id: number) => subjectTeachers[id] || null;
  const getActiveExams = (id: number) => examData.activeExams[id] || [];
  const hasActive = (id: number) => getActiveExams(id).length > 0;
  const totalActive = Object.values(examData.activeExams).flat().length;
  const isLoading = studentLoading || subjectsLoading;

  return (
    <div className="space-y-6 pb-8" data-testid="student-subjects">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Subjects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {studentInfo?.className
              ? `${studentInfo.className}${studentInfo.department ? ` · ${studentInfo.department} Dept.` : ''}`
              : 'Your assigned subjects for this term'}
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
          Report Card
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
          {totalActive > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              <span>{totalActive} Active Exam{totalActive !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
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
            Your subjects haven't been assigned yet. Contact your class teacher or administrator.
          </p>
        </div>
      )}

      {/* Subjects by Category */}
      {!isLoading && assignedSubjects.length > 0 && (
        <div className="space-y-10">
          {Object.entries(groupedSubjects).map(([category, subjects]: [string, any[]]) => {
            const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.general;
            const CategoryIcon = config.icon;

            return (
              <section key={category}>
                {/* Category Heading */}
                <div className="flex items-center gap-2 mb-5">
                  <div className={`w-7 h-7 rounded-lg ${config.accent} flex items-center justify-center`}>
                    <CategoryIcon className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="text-sm font-semibold text-foreground">{config.label} Subjects</h2>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.badge}`}>
                    {subjects.length}
                  </span>
                </div>

                {/* Cards Grid */}
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {subjects.map((subject: any) => {
                    const subjectId = subject.id || subject.subjectId;
                    const teacher = getTeacher(subjectId);
                    const activeExams = getActiveExams(subjectId);
                    const active = hasActive(subjectId);

                    return (
                      <div
                        key={subjectId}
                        className={`rounded-2xl overflow-hidden border bg-card shadow-sm hover:shadow-md transition-all duration-200 flex flex-col ${
                          active ? 'ring-2 ring-amber-400 dark:ring-amber-500' : ''
                        }`}
                        data-testid={`subject-card-${subjectId}`}
                      >
                        {/* Gradient Header */}
                        <div className={`relative bg-gradient-to-br ${config.gradient} px-4 pt-5 pb-8`}>
                          {active && (
                            <div className="absolute top-3 right-3">
                              <Badge className="bg-amber-400 text-amber-900 hover:bg-amber-400 text-xs font-bold flex items-center gap-1 px-2">
                                <Sparkles className="w-3 h-3" />
                                {activeExams.length} Exam{activeExams.length !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                          )}
                          <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">
                            {subject.subjectCode || subject.code}
                          </p>
                          <h3 className="text-white font-bold text-lg leading-snug line-clamp-2">
                            {subject.subjectName || subject.name}
                          </h3>
                        </div>

                        {/* Card Body */}
                        <div className="flex-1 flex flex-col p-4 gap-4 -mt-4 bg-card rounded-t-2xl relative">
                          {/* Teacher Row */}
                          {teacher ? (
                            <div className="flex items-center gap-2.5">
                              <Avatar className="w-8 h-8 shrink-0 ring-2 ring-background">
                                <AvatarImage
                                  src={teacher.profileImageUrl || undefined}
                                  alt={`${teacher.firstName} ${teacher.lastName}`}
                                />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                  {(teacher.firstName?.[0] || '') + (teacher.lastName?.[0] || '')}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate leading-tight">
                                  {teacher.firstName} {teacher.lastName}
                                </p>
                                <p className="text-xs text-muted-foreground">Subject Teacher</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                <User className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <p className="text-sm text-muted-foreground">No teacher assigned</p>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="grid grid-cols-2 gap-2 mt-auto">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 text-xs font-medium flex items-center gap-1.5 justify-center"
                              onClick={() => navigate(`/portal/student/scheme-of-work?subject=${subjectId}`)}
                              data-testid={`button-scheme-${subjectId}`}
                            >
                              <Layers className="w-3.5 h-3.5" />
                              Scheme
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 text-xs font-medium flex items-center gap-1.5 justify-center"
                              onClick={() => navigate(`/portal/student/study-resources?subject=${subjectId}`)}
                              data-testid={`button-materials-${subjectId}`}
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                              Materials
                            </Button>
                            <Button
                              size="sm"
                              variant={active ? 'default' : 'outline'}
                              className={`h-9 text-xs font-medium flex items-center gap-1.5 justify-center ${active ? 'bg-amber-500 hover:bg-amber-600 border-amber-500' : ''}`}
                              onClick={() => navigate(`/portal/student/exams?subject=${subjectId}`)}
                              data-testid={`button-exams-${subjectId}`}
                            >
                              <ClipboardList className="w-3.5 h-3.5" />
                              Exams
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 text-xs font-medium flex items-center gap-1.5 justify-center"
                              onClick={() => navigate(`/portal/student/exam-results?subject=${subjectId}`)}
                              data-testid={`button-scores-${subjectId}`}
                            >
                              <Award className="w-3.5 h-3.5" />
                              Scores
                            </Button>
                          </div>
                        </div>
                      </div>
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
