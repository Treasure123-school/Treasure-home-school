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
  User, ClipboardList, Award, Sparkles, FolderOpen,
  Layers,
} from 'lucide-react';
import { useLocation } from 'wouter';

// ── Category Config ────────────────────────────────────────────────────────
type CategoryKey = 'all' | 'general' | 'science' | 'art' | 'commercial';

const CATEGORY_CFG: Record<Exclude<CategoryKey, 'all'>, {
  label: string; icon: any; iconColor: string; bg: string;
}> = {
  general:    { label: 'General',    icon: BookMarked,   iconColor: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-900/30' },
  science:    { label: 'Science',    icon: GraduationCap,iconColor: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
  art:        { label: 'Art',        icon: Palette,      iconColor: 'text-violet-600',  bg: 'bg-violet-50 dark:bg-violet-900/30' },
  commercial: { label: 'Commercial', icon: Briefcase,    iconColor: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-900/30' },
};
const ALL_TABS: CategoryKey[] = ['all', 'general', 'science', 'art', 'commercial'];

function getCategoryCfg(cat: string) {
  return CATEGORY_CFG[cat as Exclude<CategoryKey, 'all'>] ?? CATEGORY_CFG.general;
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function StudentSubjects() {
  const [, navigate] = useLocation();
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all');

  const { data: studentInfo, isLoading: studentLoading } = useQuery({
    queryKey: ['/api/students/me'],
    queryFn: async () => { const r = await apiRequest('GET', '/api/students/me'); return r.json(); },
    staleTime: 5 * 60 * 1000,
  });

  const { data: assignedSubjects = [], isLoading: subjectsLoading } = useQuery<any[]>({
    queryKey: ['/api/my-subjects'],
    queryFn: async () => { const r = await apiRequest('GET', '/api/my-subjects'); return r.json(); },
    staleTime: 5 * 60 * 1000,
  });

  const { data: subjectTeachers = {} } = useQuery<Record<number, any>>({
    queryKey: ['/api/my-subject-teachers'],
    queryFn: async () => { const r = await apiRequest('GET', '/api/my-subject-teachers'); return r.json(); },
    staleTime: 5 * 60 * 1000,
  });

  const { data: examData = { activeExams: {}, examCounts: {} } } = useQuery<any>({
    queryKey: ['/api/my-active-exams'],
    queryFn: async () => { const r = await apiRequest('GET', '/api/my-active-exams'); return r.json(); },
    staleTime: 3 * 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
  });

  const isLoading = studentLoading || subjectsLoading;

  const getTeacher = (id: number) => subjectTeachers[id] || null;
  const getActiveExams = (id: number): any[] => examData.activeExams?.[id] || [];
  const hasActive = (id: number) => getActiveExams(id).length > 0;
  const totalActive = Object.values(examData.activeExams ?? {}).flat().length;

  // Counts per category
  const counts: Record<CategoryKey, number> = { all: assignedSubjects.length, general: 0, science: 0, art: 0, commercial: 0 };
  assignedSubjects.forEach((s: any) => {
    const cat = (s.category || 'general').toLowerCase() as Exclude<CategoryKey, 'all'>;
    if (cat in counts) counts[cat]++;
  });

  const filtered = activeCategory === 'all'
    ? assignedSubjects
    : assignedSubjects.filter((s: any) => (s.category || 'general').toLowerCase() === activeCategory);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto" data-testid="student-subjects">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            My Subjects
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {studentInfo?.className
              ? `${studentInfo.className}${studentInfo.department ? ` · ${studentInfo.department} Dept.` : ''}`
              : 'Your assigned subjects for this term'}
          </p>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Subjects', value: assignedSubjects.length, icon: BookMarked, color: 'text-blue-600' },
            { label: 'General',        value: counts.general,          icon: BookOpen,   color: 'text-blue-500' },
            { label: 'Science / Art',  value: counts.science + counts.art, icon: GraduationCap, color: 'text-emerald-600' },
            { label: 'Active Exams',   value: totalActive,             icon: Sparkles,   color: 'text-amber-600' },
          ].map(item => (
            <Card key={item.label}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
                <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Active Exams Banner ── */}
      {!isLoading && totalActive > 0 && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Active Now</p>
                <p className="text-sm font-bold text-foreground">
                  {totalActive} Exam{totalActive !== 1 ? 's' : ''} available
                </p>
                <p className="text-xs text-muted-foreground">Tap a subject to view and start</p>
              </div>
            </div>
            <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-sm font-bold px-3 py-1">
              {totalActive} Active
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* ── Category Filter Tabs ── */}
      {!isLoading && assignedSubjects.length > 0 && (
        <Tabs value={activeCategory} onValueChange={v => setActiveCategory(v as CategoryKey)}>
          <TabsList>
            {ALL_TABS.map(cat => {
              const count = counts[cat];
              if (cat !== 'all' && count === 0) return null;
              const label = cat === 'all' ? 'All' : CATEGORY_CFG[cat]?.label ?? cat;
              const Icon = cat === 'all' ? BookOpen : CATEGORY_CFG[cat]?.icon;
              return (
                <TabsTrigger key={cat} value={cat} data-testid={`button-category-${cat}`} className="flex items-center gap-1.5">
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {label}
                  <span className="ml-0.5 opacity-60 text-[10px] font-bold">({count})</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      )}

      {/* ── Loading Grid ── */}
      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-36 rounded-lg" />)}
        </div>
      )}

      {/* ── Empty State ── */}
      {!isLoading && assignedSubjects.length === 0 && (
        <Card>
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

      {/* ── Subject Cards Grid ── */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((subject: any) => {
            const subjectId = subject.id || subject.subjectId;
            const teacher = getTeacher(subjectId);
            const activeExams = getActiveExams(subjectId);
            const active = hasActive(subjectId);
            const cat = (subject.category || 'general').toLowerCase();
            const catCfg = getCategoryCfg(cat);

            return (
              <SubjectCard
                key={subjectId}
                subject={subject}
                subjectId={subjectId}
                teacher={teacher}
                activeExams={activeExams}
                active={active}
                catCfg={catCfg}
                onNavigate={navigate}
              />
            );
          })}
        </div>
      )}

      {/* ── No results for filter ── */}
      {!isLoading && assignedSubjects.length > 0 && filtered.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <BookOpen className="w-6 h-6 text-muted-foreground opacity-40" />
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
  subject, subjectId, teacher, activeExams, active, catCfg, onNavigate,
}: {
  subject: any;
  subjectId: number;
  teacher: any;
  activeExams: any[];
  active: boolean;
  catCfg: { label: string; icon: any; iconColor: string; bg: string };
  onNavigate: (path: string) => void;
}) {
  const CategoryIcon = catCfg.icon;

  return (
    <Card
      className={active ? 'border-amber-200 dark:border-amber-800' : ''}
      data-testid={`subject-card-${subjectId}`}
    >
      <CardContent className="p-4 flex flex-col gap-3">

        {/* Subject Identity */}
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${catCfg.bg}`}>
            <CategoryIcon className={`w-4 h-4 ${catCfg.iconColor}`} />
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
          <ActionBtn icon={<Layers className="w-3.5 h-3.5" />} label="Scheme"
            onClick={() => onNavigate(`/portal/student/scheme-of-work?subject=${subjectId}`)}
            testId={`button-scheme-${subjectId}`} />
          <ActionBtn icon={<FolderOpen className="w-3.5 h-3.5" />} label="Files"
            onClick={() => onNavigate(`/portal/student/study-resources?subject=${subjectId}`)}
            testId={`button-materials-${subjectId}`} />
          <ActionBtn icon={<ClipboardList className="w-3.5 h-3.5" />} label="Exams"
            onClick={() => onNavigate(`/portal/student/exams?subject=${subjectId}`)}
            testId={`button-exams-${subjectId}`} highlight={active} />
          <ActionBtn icon={<Award className="w-3.5 h-3.5" />} label="Scores"
            onClick={() => onNavigate(`/portal/student/exam-results?subject=${subjectId}`)}
            testId={`button-scores-${subjectId}`} />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Action Button (icon + label) ───────────────────────────────────────────
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
      className={`flex flex-col items-center gap-0.5 py-2 transition-colors rounded-b ${
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
