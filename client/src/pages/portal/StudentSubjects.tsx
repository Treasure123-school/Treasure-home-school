import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  BookOpen, GraduationCap, Palette, Briefcase, BookMarked,
  User, ClipboardList, Award, Sparkles, FileText, FolderOpen, Layers,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useLocation } from 'wouter';

// ── Category Config ────────────────────────────────────────────────────────
type CategoryKey = 'all' | 'general' | 'science' | 'art' | 'commercial';

const CATEGORY_CONFIG: Record<Exclude<CategoryKey, 'all'>, { label: string; icon: any; color: string; bg: string }> = {
  general:    { label: 'General',    icon: BookMarked, color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
  science:    { label: 'Science',    icon: GraduationCap, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  art:        { label: 'Art',        icon: Palette,    color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/20' },
  commercial: { label: 'Commercial', icon: Briefcase,  color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-900/20' },
};

const ALL_CATEGORIES: CategoryKey[] = ['all', 'general', 'science', 'art', 'commercial'];

function getCategoryConfig(cat: string) {
  return CATEGORY_CONFIG[cat as Exclude<CategoryKey, 'all'>] ?? CATEGORY_CONFIG.general;
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function StudentSubjects() {
  useAuth();
  const [, navigate] = useLocation();
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all');

  const { data: studentInfo, isLoading: studentLoading } = useQuery({
    queryKey: ['/api/students/me'],
    queryFn: async () => { const res = await apiRequest('GET', '/api/students/me'); return res.json(); },
    staleTime: 5 * 60 * 1000,
  });

  const { data: assignedSubjects = [], isLoading: subjectsLoading } = useQuery({
    queryKey: ['/api/my-subjects'],
    queryFn: async () => { const res = await apiRequest('GET', '/api/my-subjects'); return res.json(); },
    staleTime: 5 * 60 * 1000,
  });

  const { data: subjectTeachers = {} } = useQuery({
    queryKey: ['/api/my-subject-teachers'],
    queryFn: async () => { const res = await apiRequest('GET', '/api/my-subject-teachers'); return res.json(); },
    staleTime: 5 * 60 * 1000,
  });

  const { data: examData = { activeExams: {}, examCounts: {} } } = useQuery({
    queryKey: ['/api/my-active-exams'],
    queryFn: async () => { const res = await apiRequest('GET', '/api/my-active-exams'); return res.json(); },
    staleTime: 3 * 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
  });

  const isLoading = studentLoading || subjectsLoading;

  const getTeacher = (id: number) => subjectTeachers[id] || null;
  const getActiveExams = (id: number) => examData.activeExams[id] || [];
  const hasActive = (id: number) => getActiveExams(id).length > 0;
  const totalActive = Object.values(examData.activeExams as Record<string, any[]>).flat().length;

  // Count per category
  const categoryCounts: Record<CategoryKey, number> = {
    all: assignedSubjects.length,
    general: 0, science: 0, art: 0, commercial: 0,
  };
  (assignedSubjects as any[]).forEach((s: any) => {
    const cat = (s.category || 'general').toLowerCase() as Exclude<CategoryKey, 'all'>;
    if (cat in categoryCounts) categoryCounts[cat]++;
  });

  const filteredSubjects = activeCategory === 'all'
    ? (assignedSubjects as any[])
    : (assignedSubjects as any[]).filter((s: any) => (s.category || 'general').toLowerCase() === activeCategory);

  return (
    <div className="space-y-6 pb-8" data-testid="student-subjects">

      {/* ── Header ── */}
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

      {/* ── Summary Chips ── */}
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
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-700 dark:text-amber-400">
              <Sparkles className="w-3.5 h-3.5" />
              {totalActive} Active Exam{totalActive !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* ── Category Filter Tabs ── */}
      {!isLoading && assignedSubjects.length > 0 && (
        <Tabs value={activeCategory} onValueChange={v => setActiveCategory(v as CategoryKey)}>
          <TabsList>
            {ALL_CATEGORIES.map(cat => {
              const count = categoryCounts[cat];
              if (cat !== 'all' && count === 0) return null;
              const label = cat === 'all' ? 'All' : CATEGORY_CONFIG[cat]?.label ?? cat;
              const Icon = cat !== 'all' ? CATEGORY_CONFIG[cat]?.icon : BookOpen;
              return (
                <TabsTrigger
                  key={cat}
                  value={cat}
                  data-testid={`button-category-${cat}`}
                  className="flex items-center gap-1.5"
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {label}
                  {count > 0 && (
                    <span className="ml-0.5 text-[10px] font-bold opacity-70">({count})</span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      )}

      {/* ── Loading State ── */}
      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
        </div>
      )}

      {/* ── Empty State ── */}
      {!isLoading && assignedSubjects.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <BookOpen className="w-7 h-7 text-muted-foreground opacity-50" />
            </div>
            <p className="text-base font-semibold">No Subjects Assigned</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Your subjects haven't been assigned yet. Contact your class teacher or administrator.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Subject Grid ── */}
      {!isLoading && filteredSubjects.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredSubjects.map((subject: any) => {
            const subjectId = subject.id || subject.subjectId;
            const teacher = getTeacher(subjectId);
            const activeExams = getActiveExams(subjectId);
            const active = hasActive(subjectId);
            const cat = (subject.category || 'general').toLowerCase();
            const catCfg = getCategoryConfig(cat);
            const CategoryIcon = catCfg.icon;

            return (
              <SubjectCard
                key={subjectId}
                subject={subject}
                subjectId={subjectId}
                teacher={teacher}
                activeExams={activeExams}
                active={active}
                catCfg={catCfg}
                CategoryIcon={CategoryIcon}
                onNavigate={navigate}
              />
            );
          })}
        </div>
      )}

      {/* No results for filter */}
      {!isLoading && assignedSubjects.length > 0 && filteredSubjects.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <BookOpen className="w-6 h-6 text-muted-foreground opacity-50" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">No subjects in this category</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Subject Card ───────────────────────────────────────────────────────────
function SubjectCard({
  subject, subjectId, teacher, activeExams, active, catCfg, CategoryIcon, onNavigate,
}: {
  subject: any;
  subjectId: number;
  teacher: any;
  activeExams: any[];
  active: boolean;
  catCfg: { label: string; icon: any; color: string; bg: string };
  CategoryIcon: any;
  onNavigate: (path: string) => void;
}) {
  return (
    <div
      className={`rounded-xl border bg-white dark:bg-gray-900 transition-shadow hover:shadow-sm flex flex-col ${
        active ? 'border-amber-200 dark:border-amber-800' : 'border-gray-200 dark:border-gray-700'
      }`}
      data-testid={`subject-card-${subjectId}`}
    >
      <div className="p-4 flex flex-col gap-3">

        {/* Subject Identity */}
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${catCfg.bg}`}>
            <CategoryIcon className={`w-4 h-4 ${catCfg.color}`} />
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
            <Badge className="shrink-0 text-[10px] font-bold px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
              <Sparkles className="w-2.5 h-2.5 mr-1" />
              {activeExams.length} Exam{activeExams.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Teacher Row */}
        {teacher ? (
          <div className="flex items-center gap-2">
            <Avatar className="w-6 h-6 shrink-0">
              <AvatarImage src={teacher.profileImageUrl || undefined} alt={`${teacher.firstName} ${teacher.lastName}`} />
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
        <div className="grid grid-cols-4 divide-x divide-border/60 pt-1 border-t border-border/60">
          <ActionBtn
            icon={<Layers className="w-3.5 h-3.5" />}
            label="Scheme"
            onClick={() => onNavigate(`/portal/student/scheme-of-work?subject=${subjectId}`)}
            testId={`button-scheme-${subjectId}`}
          />
          <ActionBtn
            icon={<FolderOpen className="w-3.5 h-3.5" />}
            label="Files"
            onClick={() => onNavigate(`/portal/student/study-resources?subject=${subjectId}`)}
            testId={`button-materials-${subjectId}`}
          />
          <ActionBtn
            icon={<ClipboardList className="w-3.5 h-3.5" />}
            label="Exams"
            onClick={() => onNavigate(`/portal/student/exams?subject=${subjectId}`)}
            testId={`button-exams-${subjectId}`}
            highlight={active}
          />
          <ActionBtn
            icon={<Award className="w-3.5 h-3.5" />}
            label="Scores"
            onClick={() => onNavigate(`/portal/student/exam-results?subject=${subjectId}`)}
            testId={`button-scores-${subjectId}`}
          />
        </div>
      </div>
    </div>
  );
}

// ── Action Button ──────────────────────────────────────────────────────────
function ActionBtn({
  icon, label, onClick, testId, highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  testId?: string;
  highlight?: boolean;
}) {
  return (
    <button
      className={`flex flex-col items-center gap-0.5 py-2 transition-colors ${
        highlight
          ? 'text-amber-700 dark:text-amber-400 font-semibold hover:bg-amber-50 dark:hover:bg-amber-900/20'
          : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
      }`}
      onClick={onClick}
      data-testid={testId}
    >
      {icon}
      <span className="text-[10px]">{label}</span>
    </button>
  );
}
