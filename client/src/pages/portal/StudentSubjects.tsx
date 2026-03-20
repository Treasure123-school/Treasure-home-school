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
}> = {
  general: { label: 'General', icon: BookMarked },
  science: { label: 'Science', icon: GraduationCap },
  art: { label: 'Art', icon: Palette },
  commercial: { label: 'Commercial', icon: Briefcase },
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
          className="self-start sm:self-auto gap-1.5"
        >
          <FileText className="w-4 h-4" />
          Report Card
        </Button>
      </div>

      {/* Summary Strip */}
      {!isLoading && (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground">
            <GraduationCap className="w-3.5 h-3.5" />
            {studentInfo?.className || 'Not Assigned'}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground">
            <BookMarked className="w-3.5 h-3.5" />
            {assignedSubjects.length} Subject{assignedSubjects.length !== 1 ? 's' : ''}
          </span>
          {totalActive > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/20 text-xs font-semibold text-amber-700 dark:text-secondary">
              <Sparkles className="w-3.5 h-3.5" />
              {totalActive} Active Exam{totalActive !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && assignedSubjects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <BookOpen className="w-7 h-7 text-muted-foreground opacity-50" />
          </div>
          <p className="text-base font-semibold">No Subjects Assigned</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Your subjects haven't been assigned yet. Contact your class teacher or administrator.
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
                <div className="flex items-center gap-2 mb-3">
                  <CategoryIcon className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">{config.label} Subjects</h2>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {subjects.length}
                  </span>
                </div>

                {/* Cards Grid */}
                <div className="grid gap-3 sm:grid-cols-2">
                  {subjects.map((subject: any) => {
                    const subjectId = subject.id || subject.subjectId;
                    const teacher = getTeacher(subjectId);
                    const activeExams = getActiveExams(subjectId);
                    const active = hasActive(subjectId);

                    return (
                      <div
                        key={subjectId}
                        className={`rounded-xl border bg-card transition-shadow hover:shadow-sm flex flex-col ${
                          active ? 'border-secondary/60 dark:border-secondary/40' : 'border-border'
                        }`}
                        data-testid={`subject-card-${subjectId}`}
                      >
                        <div className="p-4 flex flex-col gap-3">

                          {/* Subject Identity */}
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <CategoryIcon className="w-4 h-4 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground leading-none mb-1">
                                {subject.subjectCode || subject.code}
                              </p>
                              <h3 className="text-sm font-semibold leading-snug line-clamp-2 text-foreground">
                                {subject.subjectName || subject.name}
                              </h3>
                            </div>
                            {active && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/20 text-amber-700 dark:text-secondary shrink-0">
                                <Sparkles className="w-2.5 h-2.5" />
                                {activeExams.length} Exam{activeExams.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>

                          {/* Teacher Row */}
                          {teacher ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="w-6 h-6 shrink-0">
                                <AvatarImage
                                  src={teacher.profileImageUrl || undefined}
                                  alt={`${teacher.firstName} ${teacher.lastName}`}
                                />
                                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                                  {(teacher.firstName?.[0] || '') + (teacher.lastName?.[0] || '')}
                                </AvatarFallback>
                              </Avatar>
                              <p className="text-xs text-muted-foreground truncate">
                                {teacher.firstName} {teacher.lastName}
                              </p>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                              <p className="text-xs text-muted-foreground/60">No teacher assigned</p>
                            </div>
                          )}

                          {/* Action Row */}
                          <div className="flex items-center gap-1.5 pt-1 border-t border-border/60">
                            <button
                              className="flex-1 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
                              onClick={() => navigate(`/portal/student/scheme-of-work?subject=${subjectId}`)}
                              data-testid={`button-scheme-${subjectId}`}
                            >
                              <Layers className="w-3.5 h-3.5" />
                              Scheme
                            </button>
                            <div className="w-px h-4 bg-border" />
                            <button
                              className="flex-1 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
                              onClick={() => navigate(`/portal/student/study-resources?subject=${subjectId}`)}
                              data-testid={`button-materials-${subjectId}`}
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                              Materials
                            </button>
                            <div className="w-px h-4 bg-border" />
                            <button
                              className={`flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg transition-colors ${
                                active
                                  ? 'text-amber-700 dark:text-secondary font-semibold hover:bg-secondary/10'
                                  : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
                              }`}
                              onClick={() => navigate(`/portal/student/exams?subject=${subjectId}`)}
                              data-testid={`button-exams-${subjectId}`}
                            >
                              <ClipboardList className="w-3.5 h-3.5" />
                              Exams
                            </button>
                            <div className="w-px h-4 bg-border" />
                            <button
                              className="flex-1 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
                              onClick={() => navigate(`/portal/student/exam-results?subject=${subjectId}`)}
                              data-testid={`button-scores-${subjectId}`}
                            >
                              <Award className="w-3.5 h-3.5" />
                              Scores
                            </button>
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
