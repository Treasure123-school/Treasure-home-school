import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Download, TrendingUp, Award, Star, ChevronDown, MessageSquare } from 'lucide-react';
import { Link } from 'wouter';
import { calculateGradeFromPercentage, getGradeColor as getGradeColorUtil, getGradeBgColor } from '@shared/grading-utils';
import RequireCompleteProfile from '@/components/RequireCompleteProfile';
import { useState, useMemo } from 'react';

function calcGrade(score: number) {
  return calculateGradeFromPercentage(score, 'standard').grade;
}
function gradeColor(grade: string) {
  return `${getGradeColorUtil(grade)} ${getGradeBgColor(grade)}`;
}

function GradeChip({ grade }: { grade: string }) {
  return (
    <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold ${gradeColor(grade)}`}>
      {grade}
    </span>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
      <div className={`h-2 rounded-full transition-all duration-700 ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function getBarColor(pct: number) {
  if (pct >= 70) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

export default function StudentGrades() {
  const { user } = useAuth();
  if (!user) return <div>Please log in to access your grades.</div>;
  return (
    <RequireCompleteProfile feature="grades and academic performance">
      <StudentGradesContent user={user} />
    </RequireCompleteProfile>
  );
}

function StudentGradesContent({ user }: { user: any }) {
  const [selectedTerm, setSelectedTerm] = useState('all');
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

  const { data: examResults = [], isLoading, error } = useQuery({
    queryKey: ['examResults', user.id],
    queryFn: async () => {
      const response = await fetch(`/api/exam-results/${user.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch exam results');
      return response.json();
    }
  });

  const formatted = useMemo(() => (examResults as any[]).map((r: any) => ({
    id: r.id,
    subject: r.subjectName || r.subject || 'Unknown Subject',
    examType: r.examType || 'Assessment',
    score: r.score ?? r.marks ?? 0,
    maxScore: r.maxScore ?? r.totalMarks ?? 100,
    grade: r.grade || calcGrade(((r.score ?? r.marks ?? 0) / (r.maxScore ?? r.totalMarks ?? 100)) * 100),
    date: r.examDate || r.createdAt,
    term: r.term || 'Current Term',
    comment: r.comment || r.teacherComment || null,
    teacher: r.teacherName || null,
  })), [examResults]);

  const terms = useMemo(() => {
    const s = new Set(formatted.map((r: any) => r.term));
    return Array.from(s);
  }, [formatted]);

  const filtered = useMemo(() =>
    selectedTerm === 'all' ? formatted : formatted.filter((r: any) => r.term === selectedTerm),
    [formatted, selectedTerm]
  );

  const bySubject = useMemo(() => {
    const map: Record<string, any[]> = {};
    filtered.forEach((r: any) => {
      if (!map[r.subject]) map[r.subject] = [];
      map[r.subject].push(r);
    });
    return map;
  }, [filtered]);

  const subjectSummaries = useMemo(() =>
    Object.entries(bySubject).map(([subject, records]) => {
      const avg = records.reduce((s: number, r: any) => s + (r.score / r.maxScore) * 100, 0) / records.length;
      const ca = records.filter((r: any) => r.examType?.toLowerCase().includes('ca') || r.examType?.toLowerCase().includes('assess'));
      const exam = records.filter((r: any) => r.examType?.toLowerCase().includes('exam'));
      const avgCA = ca.length ? ca.reduce((s: number, r: any) => s + (r.score / r.maxScore) * 100, 0) / ca.length : null;
      const avgExam = exam.length ? exam.reduce((s: number, r: any) => s + (r.score / r.maxScore) * 100, 0) / exam.length : null;
      const lastComment = records.find((r: any) => r.comment)?.comment || null;
      const teacher = records.find((r: any) => r.teacher)?.teacher || null;
      return { subject, avg: Math.round(avg), grade: calcGrade(avg), records, avgCA: avgCA ? Math.round(avgCA) : null, avgExam: avgExam ? Math.round(avgExam) : null, comment: lastComment, teacher };
    }),
    [bySubject]
  );

  const overallAvg = filtered.length > 0
    ? Math.round(filtered.reduce((s: number, r: any) => s + (r.score / r.maxScore) * 100, 0) / filtered.length)
    : 0;
  const overallGrade = filtered.length > 0 ? calcGrade(overallAvg) : '—';
  const highest = filtered.length > 0 ? Math.round(Math.max(...filtered.map((r: any) => (r.score / r.maxScore) * 100))) : 0;
  const subjectCount = Object.keys(bySubject).length;

  return (
    <div className="space-y-6 pb-6" data-testid="gradebook-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">My Gradebook</h1>
          <p className="text-sm text-muted-foreground mt-1">View your academic performance and progress</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedTerm} onValueChange={setSelectedTerm}>
            <SelectTrigger className="w-[160px] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700" data-testid="select-term">
              <SelectValue placeholder="Select term" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Terms</SelectItem>
              {terms.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" data-testid="button-download">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Overall Average', value: `${overallAvg}%`, icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/5 dark:bg-primary/5' },
          { label: 'Overall Grade', value: overallGrade, icon: Award, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/40' },
          { label: 'Highest Score', value: filtered.length ? `${highest}%` : '—', icon: Star, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/40' },
          { label: 'Subjects', value: subjectCount, icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border border-gray-200 dark:border-gray-700 shadow-sm">
            <CardContent className="p-4">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100" data-testid={`grade-stat-${label.toLowerCase().replace(/\s/g, '-')}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Overall Progress Bar */}
      {filtered.length > 0 && (
        <Card className="border border-gray-200 dark:border-gray-700 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Overall Performance</span>
              <div className={`px-3 py-1 rounded-full text-sm font-bold ${gradeColor(overallGrade)}`}>{overallGrade}</div>
            </div>
            <ProgressBar pct={overallAvg} color={getBarColor(overallAvg)} />
            <p className="text-xs text-muted-foreground mt-1.5 text-right">{overallAvg}% average across all subjects</p>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border border-gray-200 dark:border-gray-700">
              <CardContent className="p-5">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                  <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-full" />
                  <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30">
          <CardContent className="p-6 text-center py-10">
            <div className="w-14 h-14 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h3 className="font-semibold text-red-800 dark:text-red-300 mb-2">Unable to Load Grades</h3>
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">We encountered an issue fetching your records. Please try again.</p>
            <Button variant="outline" onClick={() => window.location.reload()} className="border-red-300 text-red-600 hover:bg-red-50">
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Subject Breakdown Table */}
      {!error && !isLoading && subjectSummaries.length > 0 && (
        <>
          <Card className="border border-gray-200 dark:border-gray-700 shadow-sm">
            <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-800">
              <CardTitle className="text-base">Subject Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      {['Subject', 'CA Score', 'Exam Score', 'Average', 'Grade', 'Progress'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                    {subjectSummaries.map(({ subject, avg, grade, avgCA, avgExam }) => (
                      <tr key={subject} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors" data-testid={`subject-row-${subject}`}>
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{subject}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{avgCA !== null ? `${avgCA}%` : '—'}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{avgExam !== null ? `${avgExam}%` : '—'}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-200">{avg}%</td>
                        <td className="px-4 py-3"><GradeChip grade={grade} /></td>
                        <td className="px-4 py-3 w-36"><ProgressBar pct={avg} color={getBarColor(avg)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="sm:hidden divide-y divide-gray-50 dark:divide-gray-800/50">
                {subjectSummaries.map(({ subject, avg, grade }) => (
                  <div key={subject} className="px-4 py-3 flex items-center gap-3" data-testid={`subject-card-${subject}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate">{subject}</p>
                      <div className="mt-1.5"><ProgressBar pct={avg} color={getBarColor(avg)} /></div>
                      <p className="text-xs text-muted-foreground mt-1">{avg}% average</p>
                    </div>
                    <GradeChip grade={grade} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Detailed Subject Records */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">Detailed Records</h2>
            {subjectSummaries.map(({ subject, records, avg, grade, comment, teacher }) => (
              <Card key={subject} className="border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors"
                  onClick={() => setExpandedSubject(expandedSubject === subject ? null : subject)}
                  data-testid={`expand-subject-${subject}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/5 dark:bg-primary/5 flex items-center justify-center">
                      <BookOpen className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-sm text-gray-800 dark:text-gray-200">{subject}</p>
                      <p className="text-xs text-muted-foreground">{records.length} assessment{records.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{avg}%</p>
                    </div>
                    <GradeChip grade={grade} />
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${expandedSubject === subject ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {expandedSubject === subject && (
                  <div className="border-t border-gray-100 dark:border-gray-800">
                    <div className="px-5 py-4 space-y-3">
                      {records.map((r: any) => {
                        const pct = Math.round((r.score / r.maxScore) * 100);
                        return (
                          <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50/70 dark:bg-gray-800/40" data-testid={`record-${r.id}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{r.examType}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{r.score}/{r.maxScore}</span>
                                  <GradeChip grade={r.grade} />
                                </div>
                              </div>
                              <ProgressBar pct={pct} color={getBarColor(pct)} />
                              <p className="text-xs text-muted-foreground mt-1">
                                {r.date ? new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''} · {r.term}
                              </p>
                            </div>
                          </div>
                        );
                      })}

                      {comment && (
                        <div className="flex gap-2 p-3 rounded-lg bg-primary/5 dark:bg-primary/5 border border-primary/20 dark:border-primary/30 mt-2">
                          <MessageSquare className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-primary dark:text-primary/60 mb-0.5">Teacher's Comment{teacher ? ` · ${teacher}` : ''}</p>
                            <p className="text-xs text-primary dark:text-primary/50">{comment}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Empty State */}
      {!error && !isLoading && filtered.length === 0 && (
        <Card className="border border-gray-200 dark:border-gray-700 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center" data-testid="empty-state-grades">
            <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <BookOpen className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">No grades available</h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-5">
              {selectedTerm !== 'all'
                ? 'No grades found for the selected term. Try selecting a different term.'
                : 'Your grades will appear here once your teachers have posted them.'}
            </p>
            {selectedTerm !== 'all' && (
              <Button variant="outline" size="sm" onClick={() => setSelectedTerm('all')}>View All Terms</Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
