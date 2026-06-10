import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Users, TrendingUp, TrendingDown, Award, Target, CheckCircle2, XCircle,
  Download, Search, ChevronUp, ChevronDown, ChevronsUpDown, BookOpen,
  BarChart2, AlertCircle, HelpCircle,
} from 'lucide-react';
import type { Exam } from '@shared/schema';

interface Class { id: number; name: string; }
interface Subject { id: number; name: string; code: string; }
interface AnalyticsData {
  exam: { id: number; name: string; totalMarks: number; passingScore: number; date: string; classId: number; subjectId: number; };
  overview: { totalStudents: number; avgPercent: number; highestPercent: number; lowestPercent: number; passRate: number; passCount: number; failCount: number; };
  scoreDistribution: Array<{ range: string; count: number; }>;
  studentPerformance: Array<{ studentId: string; studentName: string; admissionNumber: string | null; score: number; maxScore: number; scorePercent: number; grade: string | null; passed: boolean; timeTaken: number | null; }>;
  questionAnalysis: Array<{ questionId: number; questionText: string; questionType: string; points: number; orderNumber: number; totalAttempted: number; correctCount: number; correctPercent: number; }>;
  topPerformers: Array<{ studentName: string; scorePercent: number; grade: string | null; passed: boolean; }>;
  lowPerformers: Array<{ studentName: string; scorePercent: number; grade: string | null; passed: boolean; }>;
  trends: Array<{ examId: number; examName: string; date: string; avgPercent: number; passRate: number; studentCount: number; }>;
}

type SortKey = 'studentName' | 'scorePercent' | 'grade' | 'passed';
type SortDir = 'asc' | 'desc';

const PASS_COLOR = '#10b981';
const FAIL_COLOR = '#ef4444';
const PRIMARY_COLOR = '#3b82f6';
const DIST_COLOR = '#6366f1';

function StatCard({ icon: Icon, label, value, sub, color = 'text-foreground', testId }: {
  icon: any; label: string; value: string | number; sub?: string; color?: string; testId: string;
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

export default function TeacherExamAnalytics() {
  const [classFilter, setClassFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('scorePercent');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [activeTab, setActiveTab] = useState('overview');

  const { data: classes = [] } = useQuery<Class[]>({ queryKey: ['/api/classes'] });
  const { data: subjects = [] } = useQuery<Subject[]>({ queryKey: ['/api/subjects'] });
  const { data: exams = [] } = useQuery<Exam[]>({ queryKey: ['/api/exams'] });

  const filteredExams = useMemo(() => {
    return exams.filter(e => {
      if (classFilter !== 'all' && String(e.classId) !== classFilter) return false;
      if (subjectFilter !== 'all' && String(e.subjectId) !== subjectFilter) return false;
      return true;
    });
  }, [exams, classFilter, subjectFilter]);

  const { data: analytics, isLoading, isError } = useQuery<AnalyticsData>({
    queryKey: ['/api/teacher/exam-analytics', selectedExamId],
    enabled: !!selectedExamId,
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortedStudents = useMemo(() => {
    if (!analytics) return [];
    let rows = analytics.studentPerformance.filter(s =>
      s.studentName.toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.admissionNumber?.toLowerCase().includes(studentSearch.toLowerCase()) ?? false)
    );
    rows.sort((a, b) => {
      let va: any = a[sortKey], vb: any = b[sortKey];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [analytics, studentSearch, sortKey, sortDir]);

  const exportCSV = () => {
    if (!analytics) return;
    const headers = ['Student Name', 'Admission No', 'Score', 'Max Score', 'Percentage', 'Grade', 'Status'];
    const rows = analytics.studentPerformance.map(s => [
      s.studentName, s.admissionNumber ?? '', s.score, s.maxScore,
      `${s.scorePercent}%`, s.grade ?? '-', s.passed ? 'Pass' : 'Fail',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${analytics.exam.name.replace(/\s+/g, '_')}_results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="heading-exam-analytics">
            Exam Analytics
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Deep insights into student performance and question effectiveness
          </p>
        </div>
        {analytics && (
          <Button variant="outline" size="sm" onClick={exportCSV} data-testid="button-export-csv" className="gap-2 w-fit">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart2 className="h-4 w-4" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Class</label>
              <Select value={classFilter} onValueChange={v => { setClassFilter(v); setSelectedExamId(''); }} data-testid="select-class-filter">
                <SelectTrigger data-testid="trigger-class-filter">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Subject</label>
              <Select value={subjectFilter} onValueChange={v => { setSubjectFilter(v); setSelectedExamId(''); }} data-testid="select-subject-filter">
                <SelectTrigger data-testid="trigger-subject-filter">
                  <SelectValue placeholder="All Subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Exam</label>
              <Select value={selectedExamId} onValueChange={setSelectedExamId} data-testid="select-exam-filter">
                <SelectTrigger data-testid="trigger-exam-filter">
                  <SelectValue placeholder="Select an exam…" />
                </SelectTrigger>
                <SelectContent>
                  {filteredExams.length === 0 ? (
                    <SelectItem value="__none__" disabled>No exams found</SelectItem>
                  ) : filteredExams.map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empty state */}
      {!selectedExamId && (
        <Card>
          <CardContent className="h-48 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <BookOpen className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">Select an exam above to view analytics</p>
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {selectedExamId && isLoading && (
        <div className="space-y-4">
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-72 rounded-lg" />
            <Skeleton className="h-72 rounded-lg" />
          </div>
          <Skeleton className="h-96 rounded-lg" />
        </div>
      )}

      {/* Error state */}
      {selectedExamId && isError && (
        <Card className="border-destructive">
          <CardContent className="h-32 flex items-center justify-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Failed to load analytics. Please try again.</span>
          </CardContent>
        </Card>
      )}

      {/* Analytics content in tabs */}
      {analytics && !isLoading && (
        <>
          {/* Exam info badge row */}
          <div className="flex items-center gap-2 flex-wrap">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">{analytics.exam.name}</h2>
            <Badge variant="outline" className="text-xs">{analytics.exam.date}</Badge>
            <Badge variant="secondary" className="text-xs">Passing: {analytics.exam.passingScore}%</Badge>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full" data-testid="tabs-analytics">
              <TabsTrigger value="overview" className="flex-1" data-testid="tab-overview">
                <BarChart2 className="h-3.5 w-3.5 shrink-0 sm:hidden" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="students" className="flex-1" data-testid="tab-students">
                <Users className="h-3.5 w-3.5 shrink-0 sm:hidden" />
                <span className="hidden sm:inline">Students</span>
                <Badge variant="secondary" className="ml-1.5 text-xs hidden sm:inline-flex">
                  {analytics.studentPerformance.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="questions" className="flex-1" data-testid="tab-questions">
                <Target className="h-3.5 w-3.5 shrink-0 sm:hidden" />
                <span className="hidden sm:inline">Questions</span>
                <Badge variant="secondary" className="ml-1.5 text-xs hidden sm:inline-flex">
                  {analytics.questionAnalysis.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="trends" className="flex-1" data-testid="tab-trends">
                <TrendingUp className="h-3.5 w-3.5 shrink-0 sm:hidden" />
                <span className="hidden sm:inline">Trends</span>
              </TabsTrigger>
            </TabsList>

            {/* ── Overview Tab ─────────────────────────────────────────────── */}
            <TabsContent value="overview" className="space-y-5 mt-4">
              {/* Stat cards */}
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                <StatCard icon={Users} label="Total Students" value={analytics.overview.totalStudents} testId="total-students" />
                <StatCard icon={Target} label="Average Score" value={`${analytics.overview.avgPercent}%`} color="text-primary" testId="avg-score" />
                <StatCard icon={TrendingUp} label="Highest Score" value={`${analytics.overview.highestPercent}%`} color="text-green-600" testId="highest-score" />
                <StatCard icon={TrendingDown} label="Lowest Score" value={`${analytics.overview.lowestPercent}%`} color="text-orange-500" testId="lowest-score" />
                <StatCard icon={CheckCircle2} label="Pass Rate" value={`${analytics.overview.passRate}%`} sub={`${analytics.overview.passCount} passed`} color="text-emerald-600" testId="pass-rate" />
                <StatCard icon={XCircle} label="Failed" value={analytics.overview.failCount} sub={`${analytics.overview.failCount} students`} color="text-red-500" testId="fail-count" />
              </div>

              {/* Charts */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Score Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analytics.scoreDistribution.some(d => d.count > 0) ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={analytics.scoreDistribution} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
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
                    {analytics.overview.totalStudents > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Passed', value: analytics.overview.passCount, color: PASS_COLOR },
                              { name: 'Failed', value: analytics.overview.failCount, color: FAIL_COLOR },
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

              {/* Top & Low performers */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Award className="h-4 w-4 text-yellow-500" /> Top Performers
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analytics.topPerformers.length > 0 ? (
                      <div className="space-y-2">
                        {analytics.topPerformers.map((s, i) => (
                          <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0" data-testid={`row-top-performer-${i}`}>
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
                      <EmptyState message="No data" />
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
                    {analytics.lowPerformers.length > 0 ? (
                      <div className="space-y-2">
                        {analytics.lowPerformers.map((s, i) => (
                          <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0" data-testid={`row-low-performer-${i}`}>
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
                      <EmptyState message="No data" />
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── Students Tab ─────────────────────────────────────────────── */}
            <TabsContent value="students" className="mt-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4" /> Student Performance
                      <Badge variant="secondary">{sortedStudents.length}</Badge>
                    </CardTitle>
                    <div className="relative w-full sm:w-60">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        data-testid="input-student-search"
                        placeholder="Search students…"
                        value={studentSearch}
                        onChange={e => setStudentSearch(e.target.value)}
                        className="pl-8 h-8 text-sm"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                            <button className="flex items-center gap-1" onClick={() => handleSort('studentName')} data-testid="th-sort-name">
                              Student <SortIcon k="studentName" />
                            </button>
                          </th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Admission No.</th>
                          <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Score</th>
                          <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">
                            <button className="flex items-center gap-1 mx-auto" onClick={() => handleSort('scorePercent')} data-testid="th-sort-percent">
                              % <SortIcon k="scorePercent" />
                            </button>
                          </th>
                          <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">
                            <button className="flex items-center gap-1 mx-auto" onClick={() => handleSort('grade')} data-testid="th-sort-grade">
                              Grade <SortIcon k="grade" />
                            </button>
                          </th>
                          <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">
                            <button className="flex items-center gap-1 mx-auto" onClick={() => handleSort('passed')} data-testid="th-sort-status">
                              Status <SortIcon k="passed" />
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedStudents.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center text-muted-foreground py-10 text-sm">
                              {studentSearch ? 'No students match your search' : 'No student results yet'}
                            </td>
                          </tr>
                        ) : sortedStudents.map((s, i) => (
                          <tr key={s.studentId} className="border-b last:border-0 hover:bg-muted/30 transition-colors" data-testid={`row-student-${i}`}>
                            <td className="px-4 py-2.5 font-medium">{s.studentName}</td>
                            <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{s.admissionNumber ?? '—'}</td>
                            <td className="px-4 py-2.5 text-center">{s.score}/{s.maxScore}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`font-semibold ${s.scorePercent >= 70 ? 'text-emerald-600' : s.scorePercent >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                                {s.scorePercent}%
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {s.grade ? <Badge variant="outline">{s.grade}</Badge> : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <Badge variant={s.passed ? 'default' : 'destructive'} className={s.passed ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : ''}>
                                {s.passed ? 'Pass' : 'Fail'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Questions Tab ─────────────────────────────────────────────── */}
            <TabsContent value="questions" className="mt-4">
              {analytics.questionAnalysis.length === 0 ? (
                <Card>
                  <CardContent className="h-48 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <HelpCircle className="h-10 w-10 opacity-30" />
                    <p className="text-sm font-medium">No question data for this exam</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Target className="h-4 w-4" /> Question-Level Analysis
                      <Badge variant="secondary">{analytics.questionAnalysis.length} questions</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analytics.questionAnalysis.map((q, i) => (
                      <div key={q.questionId} className="p-3 rounded-lg border hover:border-primary/30 transition-colors" data-testid={`row-question-${i}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-snug line-clamp-2">
                              <span className="text-muted-foreground mr-1.5">Q{q.orderNumber}.</span>
                              {q.questionText}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <Badge variant="outline" className="text-xs capitalize">{q.questionType.replace('_', ' ')}</Badge>
                              <span className="text-xs text-muted-foreground">{q.points} pt{q.points !== 1 ? 's' : ''}</span>
                              {q.totalAttempted > 0 && (
                                <span className="text-xs text-muted-foreground">{q.totalAttempted} attempted</span>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className={`text-lg font-bold ${q.correctPercent >= 70 ? 'text-emerald-600' : q.correctPercent >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                              {q.correctPercent}%
                            </span>
                            <p className="text-xs text-muted-foreground">correct</p>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${q.correctPercent >= 70 ? 'bg-emerald-500' : q.correctPercent >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${q.correctPercent}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── Trends Tab ─────────────────────────────────────────────────── */}
            <TabsContent value="trends" className="mt-4">
              {analytics.trends.length <= 1 ? (
                <Card>
                  <CardContent className="h-48 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <TrendingUp className="h-10 w-10 opacity-30" />
                    <p className="text-sm font-medium">Need at least 2 exams in the same class &amp; subject to show trends</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Performance Trends
                      <span className="text-xs text-muted-foreground font-normal">across exams in this class &amp; subject</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={analytics.trends} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="examName" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={48} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                        <Tooltip formatter={(v: any) => `${v}%`} />
                        <Legend />
                        <Line type="monotone" dataKey="avgPercent" stroke={PRIMARY_COLOR} strokeWidth={2} dot name="Avg Score %" activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="passRate" stroke={PASS_COLOR} strokeWidth={2} dot name="Pass Rate %" activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>

                    {/* Trends table */}
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40">
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Exam</th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Date</th>
                            <th className="text-center px-3 py-2 font-medium text-muted-foreground">Students</th>
                            <th className="text-center px-3 py-2 font-medium text-muted-foreground">Avg Score</th>
                            <th className="text-center px-3 py-2 font-medium text-muted-foreground">Pass Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.trends.map((t, i) => (
                            <tr key={t.examId} className={`border-b last:border-0 ${t.examId === analytics.exam.id ? 'bg-primary/5 font-medium' : 'hover:bg-muted/30'}`} data-testid={`row-trend-${i}`}>
                              <td className="px-3 py-2">
                                {t.examName}
                                {t.examId === analytics.exam.id && <Badge variant="secondary" className="ml-2 text-xs">current</Badge>}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{t.date}</td>
                              <td className="px-3 py-2 text-center">{t.studentCount}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`font-semibold ${t.avgPercent >= 70 ? 'text-emerald-600' : t.avgPercent >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                                  {t.avgPercent}%
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span className={`font-semibold ${t.passRate >= 70 ? 'text-emerald-600' : t.passRate >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                                  {t.passRate}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
