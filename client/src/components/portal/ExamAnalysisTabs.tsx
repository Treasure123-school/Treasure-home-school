import { useState, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Users, TrendingUp, TrendingDown, Award, Target, CheckCircle2,
  XCircle, Download, Search, ChevronUp, ChevronDown, ChevronsUpDown,
  BookOpen, Clock, Calendar, User, FileText, BarChart2, AlertCircle,
  Activity, GraduationCap, Layers, RotateCcw, Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { StudentResultsToolbar } from '@/components/portal/StudentResultsToolbar';
import { StudentResultMobileCard } from '@/components/portal/StudentResultMobileCard';
import { StudentRowActionsMenu } from '@/components/portal/StudentRowActionsMenu';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExamMeta {
  id: number;
  name: string;
  totalMarks: number;
  passingScore: number;
  date: string;
  classId: number;
  subjectId: number;
  examType: string;
  timeLimit: number | null;
  isPublished: boolean;
  createdAt: string;
  className: string;
  subjectName: string;
  termName: string;
  termYear: string;
  teacherName: string;
  totalQuestions: number;
}

export interface AnalyticsData {
  exam: ExamMeta;
  overview: {
    totalStudents: number;
    avgPercent: number;
    highestPercent: number;
    lowestPercent: number;
    passRate: number;
    passCount: number;
    failCount: number;
  };
  participation: {
    totalClassStudents: number;
    attempted: number;
    notAttempted: number;
    participationRate: number;
  };
  gradeDistribution: Array<{ grade: string; label: string; count: number }>;
  scoreDistribution: Array<{ range: string; count: number }>;
  studentPerformance: Array<{
    studentId: string;
    studentName: string;
    admissionNumber: string | null;
    score: number;
    maxScore: number;
    scorePercent: number;
    grade: string | null;
    passed: boolean;
    timeTaken: number | null;
    submitted_at: string | null;
  }>;
  questionAnalysis: Array<{
    questionId: number;
    questionText: string;
    questionType: string;
    points: number;
    orderNumber: number;
    totalAttempted: number;
    correctCount: number;
    correctPercent: number;
  }>;
  topPerformers: Array<{ studentName: string; scorePercent: number; grade: string | null; passed: boolean }>;
  lowPerformers: Array<{ studentName: string; scorePercent: number; grade: string | null; passed: boolean }>;
  trends: Array<{ examId: number; examName: string; date: string; avgPercent: number; passRate: number; studentCount: number }>;
}

type StudentSortKey = 'position' | 'studentName' | 'scorePercent' | 'grade' | 'passed';
type SortDir = 'asc' | 'desc';

// ─── Constants ────────────────────────────────────────────────────────────────

const PASS_COLOR = '#10b981';
const FAIL_COLOR = '#ef4444';
const PRIMARY_COLOR = '#3b82f6';
const DIST_COLOR = '#6366f1';
const GRADE_COLORS: Record<string, string> = {
  A: '#10b981',
  B: '#3b82f6',
  C: '#f59e0b',
  D: '#f97316',
  F: '#ef4444',
};

// ─── Shared sub-components ────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, color = 'text-foreground', testId,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  testId: string;
}) {
  return (
    <Card data-testid={`card-${testId}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${color}`} data-testid={`text-${testId}`}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
      <AlertCircle className="h-8 w-8 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function SortButton({
  label, sortKey, currentKey, dir, onSort,
}: {
  label: string;
  sortKey: StudentSortKey;
  currentKey: StudentSortKey;
  dir: SortDir;
  onSort: (k: StudentSortKey) => void;
}) {
  const Icon = currentKey !== sortKey ? ChevronsUpDown : dir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <button className="flex items-center gap-1 mx-auto" onClick={() => onSort(sortKey)}>
      {label} <Icon className="h-3 w-3 opacity-60" />
    </button>
  );
}

function percentColor(pct: number) {
  if (pct >= 70) return 'text-emerald-600';
  if (pct >= 50) return 'text-amber-600';
  return 'text-red-500';
}

function difficultyLabel(pct: number) {
  if (pct >= 80) return { label: 'Easy', cls: 'text-emerald-600 bg-emerald-50' };
  if (pct >= 60) return { label: 'Medium', cls: 'text-amber-600 bg-amber-50' };
  if (pct >= 40) return { label: 'Hard', cls: 'text-orange-600 bg-orange-50' };
  return { label: 'Very Hard', cls: 'text-red-600 bg-red-50' };
}

// ─── CSV export utilities ──────────────────────────────────────────────────────

function exportStudentsCSV(analytics: AnalyticsData) {
  const headers = ['Position', 'Student Name', 'Admission No', 'Score', 'Max Score', 'Percentage', 'Grade', 'Status', 'Time Taken (min)', 'Submitted At'];
  const sorted = [...analytics.studentPerformance].sort((a, b) => b.scorePercent - a.scorePercent);
  const rows = sorted.map((s, i) => [
    i + 1,
    s.studentName,
    s.admissionNumber ?? '',
    s.score,
    s.maxScore,
    `${s.scorePercent}%`,
    s.grade ?? '-',
    s.passed ? 'Pass' : 'Fail',
    s.timeTaken != null ? Math.round(s.timeTaken / 60) : '-',
    s.submitted_at ? format(new Date(s.submitted_at), 'MMM dd yyyy HH:mm') : '-',
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${analytics.exam.name.replace(/\s+/g, '_')}_results.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportQuestionsCSV(analytics: AnalyticsData) {
  const headers = ['#', 'Question', 'Type', 'Points', 'Attempted', 'Correct', 'Success Rate', 'Difficulty'];
  const rows = analytics.questionAnalysis.map(q => {
    const diff = difficultyLabel(q.correctPercent);
    return [
      q.orderNumber,
      q.questionText.replace(/"/g, '""'),
      q.questionType,
      q.points,
      q.totalAttempted,
      q.correctCount,
      `${q.correctPercent}%`,
      diff.label,
    ];
  });
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${analytics.exam.name.replace(/\s+/g, '_')}_questions.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({ analytics }: { analytics: AnalyticsData }) {
  const { exam, overview, gradeDistribution, scoreDistribution, topPerformers, lowPerformers, trends } = analytics;

  const examInfoItems = [
    { icon: GraduationCap, label: 'Class', value: exam.className },
    { icon: BookOpen, label: 'Subject', value: exam.subjectName },
    { icon: Layers, label: 'Term', value: `${exam.termName}${exam.termYear ? ` (${exam.termYear})` : ''}` },
    { icon: User, label: 'Teacher', value: exam.teacherName },
    { icon: FileText, label: 'Exam Type', value: (exam.examType ?? 'exam').replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) },
    { icon: Target, label: 'Total Marks', value: exam.totalMarks },
    { icon: Activity, label: 'Questions', value: exam.totalQuestions || '—' },
    { icon: Clock, label: 'Duration', value: exam.timeLimit ? `${exam.timeLimit} min` : 'Untimed' },
    { icon: Calendar, label: 'Exam Date', value: exam.date ? format(new Date(exam.date), 'MMM dd, yyyy') : '—' },
    { icon: Calendar, label: 'Created', value: exam.createdAt ? format(new Date(exam.createdAt), 'MMM dd, yyyy') : '—' },
  ];

  return (
    <div className="space-y-6">
      {/* Exam Info Panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Exam Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {examInfoItems.map(({ icon: Icon, label, value }) => (
              <div key={label} className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </div>
                <p className="text-sm font-semibold capitalize">{String(value)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Stat Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={Users} label="Attempted" value={overview.totalStudents} testId="total-students" />
        <StatCard icon={Target} label="Average Score" value={`${overview.avgPercent}%`} color="text-primary" testId="avg-score" />
        <StatCard icon={TrendingUp} label="Highest Score" value={`${overview.highestPercent}%`} color="text-green-600" testId="highest-score" />
        <StatCard icon={TrendingDown} label="Lowest Score" value={`${overview.lowestPercent}%`} color="text-orange-500" testId="lowest-score" />
        <StatCard icon={CheckCircle2} label="Pass Rate" value={`${overview.passRate}%`} sub={`${overview.passCount} passed`} color="text-emerald-600" testId="pass-rate" />
        <StatCard icon={XCircle} label="Fail Rate" value={`${100 - overview.passRate}%`} sub={`${overview.failCount} failed`} color="text-red-500" testId="fail-rate" />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Score Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {scoreDistribution.some(d => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={scoreDistribution} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill={DIST_COLOR} radius={[3, 3, 0, 0]} name="Students" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No result data available" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Pass / Fail Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {overview.totalStudents > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Passed', value: overview.passCount },
                      { name: 'Failed', value: overview.failCount },
                    ]}
                    cx="50%" cy="50%" outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    <Cell fill={PASS_COLOR} />
                    <Cell fill={FAIL_COLOR} />
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No result data available" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Grade Distribution */}
      {overview.totalStudents > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart2 className="h-4 w-4" /> Grade Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-3">
              {gradeDistribution.map(({ grade, label, count }) => (
                <div key={grade} className="text-center space-y-2" data-testid={`grade-dist-${grade}`}>
                  <div
                    className="mx-auto flex items-center justify-center rounded-full w-12 h-12 text-white font-bold text-lg"
                    style={{ backgroundColor: GRADE_COLORS[grade] ?? '#6b7280' }}
                  >
                    {grade}
                  </div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top & Low Performers */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Award className="h-4 w-4 text-yellow-500" /> Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPerformers.length > 0 ? (
              <div className="space-y-2">
                {topPerformers.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0" data-testid={`row-top-${i}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                      <span className="text-sm font-medium truncate max-w-[160px]">{s.studentName}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {s.grade && <Badge variant="outline" className="text-xs">{s.grade}</Badge>}
                      <span className="text-sm font-bold text-emerald-600">{s.scorePercent}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No data available" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" /> Needs Improvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowPerformers.length > 0 ? (
              <div className="space-y-2">
                {lowPerformers.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0" data-testid={`row-low-${i}`}>
                    <div className="flex items-center gap-2">
                      <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                      <span className="text-sm font-medium truncate max-w-[160px]">{s.studentName}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {s.grade && <Badge variant="outline" className="text-xs">{s.grade}</Badge>}
                      <span className="text-sm font-bold text-red-500">{s.scorePercent}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No data available" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trends */}
      {trends.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Performance Trends
              <span className="text-xs text-muted-foreground font-normal">across exams in this class &amp; subject</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trends} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="examName" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={48} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Legend />
                <Line type="monotone" dataKey="avgPercent" stroke={PRIMARY_COLOR} strokeWidth={2} dot name="Avg Score %" activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="passRate" stroke={PASS_COLOR} strokeWidth={2} dot name="Pass Rate %" activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Student Performance ─────────────────────────────────────────────────

function StudentsTab({ analytics }: { analytics: AnalyticsData }) {
  const { toast, dismiss } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<StudentSortKey>('position');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [retakeDialog, setRetakeDialog] = useState<{ studentId: string; studentName: string } | null>(null);

  const allowRetakeMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const response = await apiRequest('POST', `/api/teacher/exams/${analytics.exam.id}/allow-retake/${studentId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to allow retake');
      }
      return response.json();
    },
    onMutate: async (studentId: string) => {
      // 1. Close the dialog and show success feedback immediately — no waiting for the API.
      setRetakeDialog(null);

      const { id: toastId } = toast({
        title: 'Retake Allowed',
        description: 'The student can now retake this exam. Their previous submission has been archived.',
      });

      // 2. Cancel any in-flight analytics refetches so they don't stomp our optimistic update.
      const cacheKey = ['/api/teacher/exam-analytics', String(analytics.exam.id)];
      await queryClient.cancelQueries({ queryKey: cacheKey });

      // 3. Snapshot for rollback.
      const previousData = queryClient.getQueryData(cacheKey);

      // 4. Optimistically remove the student from the performance list immediately.
      queryClient.setQueryData(cacheKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          studentPerformance: (old.studentPerformance ?? []).filter(
            (s: any) => s.studentId !== studentId,
          ),
        };
      });

      return { previousData, toastId };
    },
    onError: (error: Error, _studentId, context: any) => {
      // Dismiss the premature success toast so the user isn't misled.
      if (context?.toastId) dismiss(context.toastId);

      // Roll back — student row reappears.
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(
          ['/api/teacher/exam-analytics', String(analytics.exam.id)],
          context.previousData,
        );
      }
      toast({
        title: 'Failed to Allow Retake',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      // Mark the query stale so the next mount/navigate fetches fresh data —
      // but do NOT refetch the currently active view, which would undo the
      // optimistic removal and make the student row reappear.
      queryClient.invalidateQueries({
        queryKey: ['/api/teacher/exam-analytics', String(analytics.exam.id)],
        refetchType: 'none',
      });
    },
  });

  const handleSort = (key: StudentSortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const rankedStudents = useMemo(() => {
    return [...analytics.studentPerformance]
      .sort((a, b) => b.scorePercent - a.scorePercent)
      .map((s, i) => ({ ...s, position: i + 1 }));
  }, [analytics.studentPerformance]);

  const filtered = useMemo(() => {
    let rows = rankedStudents.filter(s => {
      const matchSearch = s.studentName.toLowerCase().includes(search.toLowerCase()) ||
        (s.admissionNumber?.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchStatus = statusFilter === 'all' || (statusFilter === 'pass' ? s.passed : !s.passed);
      const matchGrade = gradeFilter === 'all' || s.grade === gradeFilter;
      return matchSearch && matchStatus && matchGrade;
    });

    rows.sort((a, b) => {
      let va: string | number | boolean | null, vb: string | number | boolean | null;
      if (sortKey === 'position') { va = a.position; vb = b.position; }
      else if (sortKey === 'studentName') { va = a.studentName.toLowerCase(); vb = b.studentName.toLowerCase(); }
      else if (sortKey === 'scorePercent') { va = a.scorePercent; vb = b.scorePercent; }
      else if (sortKey === 'grade') { va = a.grade ?? ''; vb = b.grade ?? ''; }
      else { va = a.passed ? 1 : 0; vb = b.passed ? 1 : 0; }
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [rankedStudents, search, statusFilter, gradeFilter, sortKey, sortDir]);

  const uniqueGrades = useMemo(() => {
    return Array.from(new Set(analytics.studentPerformance.map(s => s.grade).filter(Boolean))) as string[];
  }, [analytics.studentPerformance]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" /> Student Results
            <Badge variant="secondary">{filtered.length}</Badge>
          </CardTitle>
          <StudentResultsToolbar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            gradeFilter={gradeFilter}
            onGradeFilterChange={setGradeFilter}
            gradeOptions={uniqueGrades}
            onExport={() => exportStudentsCSV(analytics)}
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Mobile: card list */}
        <div className="block sm:hidden p-3 space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              {search || statusFilter !== 'all' || gradeFilter !== 'all'
                ? 'No students match your filters'
                : 'No student results yet'}
            </p>
          ) : filtered.map((s, i) => (
            <StudentResultMobileCard
              key={s.studentId}
              position={s.position}
              studentName={s.studentName}
              admissionNumber={s.admissionNumber}
              score={s.score}
              maxScore={s.maxScore}
              scorePercent={s.scorePercent}
              percentColorClass={percentColor(s.scorePercent)}
              grade={s.grade}
              gradeColor={s.grade ? GRADE_COLORS[s.grade] : undefined}
              passed={s.passed}
              testId={`card-student-${i}`}
              actions={[
                {
                  label: 'Allow Retake',
                  icon: RotateCcw,
                  onClick: () => setRetakeDialog({ studentId: s.studentId, studentName: s.studentName }),
                  testId: `button-allow-retake-${i}`,
                },
              ]}
            />
          ))}
        </div>

        {/* Desktop: table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">
                  <SortButton label="#" sortKey="position" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                  <SortButton label="Student" sortKey="studentName" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Admission No.</th>
                <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Score</th>
                <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">
                  <SortButton label="%" sortKey="scorePercent" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                </th>
                <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">
                  <SortButton label="Grade" sortKey="grade" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                </th>
                <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">
                  <SortButton label="Status" sortKey="passed" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                </th>
                <th className="text-center px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Time Taken</th>
                <th className="text-center px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Submitted</th>
                <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center text-muted-foreground py-12 text-sm">
                    {search || statusFilter !== 'all' || gradeFilter !== 'all'
                      ? 'No students match your filters'
                      : 'No student results yet'}
                  </td>
                </tr>
              ) : filtered.map((s, i) => (
                <tr
                  key={s.studentId}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  data-testid={`row-student-${i}`}
                >
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.position <= 3 ? 'bg-yellow-100 text-yellow-700' : 'text-muted-foreground'}`}>
                      #{s.position}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-medium">{s.studentName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{s.admissionNumber ?? '—'}</td>
                  <td className="px-4 py-2.5 text-center">{s.score}/{s.maxScore}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`font-semibold ${percentColor(s.scorePercent)}`}>{s.scorePercent}%</span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {s.grade
                      ? <Badge variant="outline" style={{ borderColor: GRADE_COLORS[s.grade] ?? undefined, color: GRADE_COLORS[s.grade] ?? undefined }}>{s.grade}</Badge>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <Badge
                      variant={s.passed ? 'default' : 'destructive'}
                      className={s.passed ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : ''}
                    >
                      {s.passed ? 'Pass' : 'Fail'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-center text-muted-foreground hidden md:table-cell">
                    {s.timeTaken != null ? `${Math.round(s.timeTaken / 60)} min` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center text-muted-foreground text-xs hidden lg:table-cell">
                    {s.submitted_at ? format(new Date(s.submitted_at), 'MMM dd, HH:mm') : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <StudentRowActionsMenu
                      testId={`button-row-actions-${i}`}
                      actions={[
                        {
                          label: 'Allow Retake',
                          icon: RotateCcw,
                          onClick: () => setRetakeDialog({ studentId: s.studentId, studentName: s.studentName }),
                          testId: `button-allow-retake-${i}`,
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      <AlertDialog
        open={!!retakeDialog}
        onOpenChange={(open) => !open && setRetakeDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Allow Exam Retake</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to allow <strong>{retakeDialog?.studentName}</strong> to retake this exam?
              <br /><br />
              This will:
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Archive their current submission for records</li>
                <li>Remove their current result from the exam</li>
                <li>Allow them to start the exam fresh</li>
              </ul>
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-retake">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => retakeDialog && allowRetakeMutation.mutate(retakeDialog.studentId)}
              data-testid="button-confirm-retake"
            >
              Allow Retake
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ─── Tab: Question Analytics ──────────────────────────────────────────────────

function QuestionsTab({ analytics }: { analytics: AnalyticsData }) {
  const [search, setSearch] = useState('');
  const [diffFilter, setDiffFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    return analytics.questionAnalysis.filter(q => {
      const matchSearch = q.questionText.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
      if (diffFilter === 'all') return true;
      const { label } = difficultyLabel(q.correctPercent);
      return label.toLowerCase().replace(' ', '-') === diffFilter;
    });
  }, [analytics.questionAnalysis, search, diffFilter]);

  if (analytics.questionAnalysis.length === 0) {
    return (
      <Card>
        <CardContent className="py-16">
          <EmptyState message="No question analysis data available. Students must attempt the exam first." />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4" /> Question-Level Analysis
              <Badge variant="secondary">{filtered.length} of {analytics.questionAnalysis.length}</Badge>
            </CardTitle>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search questions…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm w-48"
                  data-testid="input-question-search"
                />
              </div>
              <Select value={diffFilter} onValueChange={setDiffFilter}>
                <SelectTrigger className="h-8 text-sm w-32" data-testid="select-difficulty-filter">
                  <SelectValue placeholder="Difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                  <SelectItem value="very-hard">Very Hard</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => exportQuestionsCSV(analytics)} className="h-8 gap-1.5" data-testid="button-export-questions">
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-3">
        {filtered.map((q, i) => {
          const diff = difficultyLabel(q.correctPercent);
          return (
            <Card key={q.questionId} data-testid={`card-question-${i}`}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug">
                      <span className="text-muted-foreground mr-1.5 font-mono">Q{q.orderNumber}.</span>
                      {q.questionText}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs capitalize">{(q.questionType ?? '').replace('_', ' ')}</Badge>
                      <span className="text-xs text-muted-foreground">{q.points} pt{q.points !== 1 ? 's' : ''}</span>
                      {q.totalAttempted > 0 && (
                        <span className="text-xs text-muted-foreground">{q.totalAttempted} attempted · {q.correctCount} correct</span>
                      )}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${diff.cls}`}>{diff.label}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right min-w-[60px]">
                    <span className={`text-xl font-bold ${percentColor(q.correctPercent)}`}>{q.correctPercent}%</span>
                    <p className="text-xs text-muted-foreground">correct</p>
                  </div>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${q.correctPercent >= 70 ? 'bg-emerald-500' : q.correctPercent >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${q.correctPercent}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <EmptyState message="No questions match your filters" />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Participation ───────────────────────────────────────────────────────

function ParticipationTab({ analytics }: { analytics: AnalyticsData }) {
  const { participation, overview } = analytics;

  const participationData = [
    { name: 'Attempted', value: participation.attempted, color: '#3b82f6' },
    { name: 'Not Attempted', value: participation.notAttempted, color: '#e5e7eb' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total in Class" value={participation.totalClassStudents} testId="class-total" />
        <StatCard icon={CheckCircle2} label="Attempted" value={participation.attempted} color="text-primary" testId="attempted" />
        <StatCard icon={XCircle} label="Not Attempted" value={participation.notAttempted} color="text-red-500" testId="not-attempted" />
        <StatCard icon={Activity} label="Participation Rate" value={`${participation.participationRate}%`} color="text-emerald-600" testId="participation-rate" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Participation Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {participation.totalClassStudents > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={participationData}
                    cx="50%" cy="50%" outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {participationData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No class enrollment data" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Participation vs Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-2">
            {[
              { label: 'Participation Rate', value: participation.participationRate, color: '#3b82f6' },
              { label: 'Pass Rate (of attempted)', value: overview.passRate, color: '#10b981' },
              { label: 'Fail Rate (of attempted)', value: 100 - overview.passRate, color: '#ef4444' },
              { label: 'Average Score', value: overview.avgPercent, color: '#6366f1' },
            ].map(({ label, value, color }) => (
              <div key={label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold">{value}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

export function ExamAnalysisSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}

// ─── Normalize raw API response ────────────────────────────────────────────────
// Ensures all fields have safe defaults, guarding against stale cache data
// or a partial API shape.

export function normalizeExamAnalytics(raw: any): AnalyticsData {
  const exam = raw?.exam ?? {};
  const overview = raw?.overview ?? {
    totalStudents: 0, avgPercent: 0, highestPercent: 0,
    lowestPercent: 0, passRate: 0, passCount: 0, failCount: 0,
  };
  const participation = raw?.participation ?? {
    totalClassStudents: 0, attempted: 0, notAttempted: 0, participationRate: 0,
  };
  return {
    exam: {
      id: exam.id ?? 0,
      name: exam.name ?? '',
      totalMarks: exam.totalMarks ?? 0,
      passingScore: exam.passingScore ?? 50,
      date: exam.date ?? '',
      classId: exam.classId ?? 0,
      subjectId: exam.subjectId ?? 0,
      examType: exam.examType ?? 'exam',
      timeLimit: exam.timeLimit ?? null,
      isPublished: exam.isPublished ?? false,
      createdAt: exam.createdAt ?? '',
      className: exam.className ?? '',
      subjectName: exam.subjectName ?? '',
      termName: exam.termName ?? '',
      termYear: exam.termYear ?? '',
      teacherName: exam.teacherName ?? '',
      totalQuestions: exam.totalQuestions ?? 0,
    },
    overview,
    participation,
    gradeDistribution: Array.isArray(raw?.gradeDistribution) ? raw.gradeDistribution : [],
    scoreDistribution: Array.isArray(raw?.scoreDistribution) ? raw.scoreDistribution : [],
    studentPerformance: Array.isArray(raw?.studentPerformance) ? raw.studentPerformance : [],
    questionAnalysis: Array.isArray(raw?.questionAnalysis) ? raw.questionAnalysis : [],
    topPerformers: Array.isArray(raw?.topPerformers) ? raw.topPerformers : [],
    lowPerformers: Array.isArray(raw?.lowPerformers) ? raw.lowPerformers : [],
    trends: Array.isArray(raw?.trends) ? raw.trends : [],
  };
}

// ─── Combined tabbed view (shared by admin & teacher analysis pages) ──────────

export function ExamAnalysisTabs({ analytics }: { analytics: AnalyticsData }) {
  const [activeTab, setActiveTab] = useState('overview');
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      {/* Mobile: dropdown tab selector */}
      <div className="sm:hidden">
        <Select value={activeTab} onValueChange={setActiveTab}>
          <SelectTrigger className="w-full" data-testid="tabs-analysis-mobile">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="overview">Overview</SelectItem>
            <SelectItem value="students">Students</SelectItem>
            <SelectItem value="questions">Questions</SelectItem>
            <SelectItem value="participation">Participation</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {/* Desktop: tab bar */}
      <TabsList className="hidden sm:flex w-full" data-testid="tabs-analysis">
        <TabsTrigger value="overview" className="flex-1" data-testid="tab-overview">
          Overview
        </TabsTrigger>
        <TabsTrigger value="students" className="flex-1" data-testid="tab-students">
          Students
        </TabsTrigger>
        <TabsTrigger value="questions" className="flex-1" data-testid="tab-questions">
          Questions
        </TabsTrigger>
        <TabsTrigger value="participation" className="flex-1" data-testid="tab-participation">
          Participation
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <OverviewTab analytics={analytics} />
      </TabsContent>
      <TabsContent value="students">
        <StudentsTab analytics={analytics} />
      </TabsContent>
      <TabsContent value="questions">
        <QuestionsTab analytics={analytics} />
      </TabsContent>
      <TabsContent value="participation">
        <ParticipationTab analytics={analytics} />
      </TabsContent>
    </Tabs>
  );
}
