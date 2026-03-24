import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BookOpen, TrendingUp, Award, GraduationCap, Users, BarChart2, Star
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  className: string | null;
}

interface GradeResult {
  id: number;
  examId: number;
  examName: string;
  subjectName: string;
  examDate: string | null;
  examType: string;
  score: number;
  maxScore: number;
  percentage: number;
  grade: string | null;
  remarks: string | null;
}

function gradeColor(grade: string | null, percentage: number) {
  if (grade === 'A+' || grade === 'A' || percentage >= 80) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (grade === 'B+' || grade === 'B' || percentage >= 65) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  if (grade === 'C+' || grade === 'C' || percentage >= 50) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
}


function formatDate(dateStr: string | null) {
  if (!dateStr) return 'N/A';
  try {
    const d = parseISO(dateStr);
    if (isValid(d)) return format(d, 'MMM d, yyyy');
  } catch {}
  return dateStr;
}

export default function ParentGrades() {
  const { user } = useAuth();
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');

  const { data: children = [], isLoading: loadingChildren } = useQuery<Child[]>({
    queryKey: ['/api/parent/children'],
    enabled: !!user,
  });

  useEffect(() => {
    if (children.length > 0 && !selectedChild) {
      setSelectedChild(children[0].id);
    }
  }, [children, selectedChild]);

  const { data: grades = [], isLoading: loadingGrades } = useQuery<GradeResult[]>({
    queryKey: ['/api/parent/grades', selectedChild],
    queryFn: async () => {
      const res = await fetch(`/api/parent/grades/${selectedChild}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch grades');
      return res.json();
    },
    enabled: !!selectedChild,
  });

  const child = children.find(c => c.id === selectedChild);
  const subjects = [...new Set(grades.map(g => g.subjectName))].sort();
  const filtered = subjectFilter === 'all' ? grades : grades.filter(g => g.subjectName === subjectFilter);

  const avgPercentage = grades.length > 0
    ? Math.round(grades.reduce((s, g) => s + g.percentage, 0) / grades.length)
    : 0;

  const topSubject = subjects.length > 0
    ? subjects.reduce((best, sub) => {
        const avg = grades.filter(g => g.subjectName === sub).reduce((s, g) => s + g.percentage, 0)
          / grades.filter(g => g.subjectName === sub).length;
        const bestAvg = grades.filter(g => g.subjectName === best).reduce((s, g) => s + g.percentage, 0)
          / grades.filter(g => g.subjectName === best).length;
        return avg > bestAvg ? sub : best;
      }, subjects[0])
    : null;

  return (
    <div className="space-y-6" data-testid="page-parent-grades">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Academic Grades
          </h1>
          <p className="text-muted-foreground mt-1">View your child's exam results and performance</p>
        </div>

        {children.length > 0 && (
          <div className="w-full sm:w-64">
            <Select value={selectedChild} onValueChange={(v) => { setSelectedChild(v); setSubjectFilter('all'); }} data-testid="select-child">
              <SelectTrigger>
                <SelectValue placeholder="Select a child" />
              </SelectTrigger>
              <SelectContent>
                {children.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      <span>{c.firstName} {c.lastName}</span>
                      {c.className && <span className="text-xs text-muted-foreground">({c.className})</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {loadingChildren && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      )}

      {!loadingChildren && children.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold mb-2">No Children Linked</h3>
            <p className="text-sm text-muted-foreground">Please contact the school administration to link your children.</p>
          </CardContent>
        </Card>
      )}

      {selectedChild && !loadingGrades && (
        <>
          {/* Summary Stats */}
          {grades.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="overflow-hidden border-none shadow-lg">
                <div className="bg-gradient-to-br from-purple-500 to-violet-600 p-5 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/80 text-xs">Average Score</p>
                      <p className="text-3xl font-bold mt-1" data-testid="text-avg-score">{avgPercentage}%</p>
                      <p className="text-white/70 text-xs mt-1">{grades.length} results</p>
                    </div>
                    <div className="p-2 bg-white/20 rounded-xl"><BarChart2 className="h-6 w-6" /></div>
                  </div>
                </div>
              </Card>

              <Card className="overflow-hidden border-none shadow-lg">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-5 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/80 text-xs">Subjects Taken</p>
                      <p className="text-3xl font-bold mt-1" data-testid="text-subjects-count">{subjects.length}</p>
                      <p className="text-white/70 text-xs mt-1">across all exams</p>
                    </div>
                    <div className="p-2 bg-white/20 rounded-xl"><BookOpen className="h-6 w-6" /></div>
                  </div>
                </div>
              </Card>

              <Card className="overflow-hidden border-none shadow-lg">
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-5 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/80 text-xs">Top Subject</p>
                      <p className="text-base font-bold mt-1 truncate max-w-[140px]" data-testid="text-top-subject">{topSubject ?? '—'}</p>
                      <p className="text-white/70 text-xs mt-1">best performance</p>
                    </div>
                    <div className="p-2 bg-white/20 rounded-xl"><Star className="h-6 w-6" /></div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Subject Filter */}
          {subjects.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-muted-foreground">Filter:</span>
              <button
                onClick={() => setSubjectFilter('all')}
                className={`text-sm px-3 py-1 rounded-full border transition-colors ${subjectFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
              >
                All Subjects
              </button>
              {subjects.map(sub => (
                <button
                  key={sub}
                  onClick={() => setSubjectFilter(sub)}
                  className={`text-sm px-3 py-1 rounded-full border transition-colors ${subjectFilter === sub ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}

          {/* Grades Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-5 w-5" />
                Exam Results
                {child && <span className="font-normal text-muted-foreground">— {child.firstName} {child.lastName}</span>}
                <Badge variant="secondary" className="ml-auto">{filtered.length} results</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {grades.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <h3 className="font-medium mb-1">No Results Yet</h3>
                  <p className="text-sm">Exam results will appear here once available.</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <p className="text-sm">No results for the selected subject.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Exam</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subject</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Date</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Type</th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Score</th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filtered.map((g) => (
                        <tr key={g.id} className="hover:bg-muted/30 transition-colors" data-testid={`grade-row-${g.id}`}>
                          <td className="py-3 px-4">
                            <p className="font-medium text-sm">{g.examName}</p>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-sm text-muted-foreground">{g.subjectName}</p>
                          </td>
                          <td className="py-3 px-4 hidden sm:table-cell">
                            <p className="text-sm text-muted-foreground">{formatDate(g.examDate)}</p>
                          </td>
                          <td className="py-3 px-4 hidden sm:table-cell">
                            <Badge variant="outline" className="text-xs capitalize">{g.examType}</Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-sm font-bold">{g.score}/{g.maxScore}</span>
                              <div className="w-full max-w-[80px] bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                <div
                                  className="h-1.5 rounded-full bg-primary transition-all"
                                  style={{ width: `${g.percentage}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">{g.percentage}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge className={`${gradeColor(g.grade, g.percentage)} border-0 font-bold`}>
                              {g.grade ?? (g.percentage >= 80 ? 'A' : g.percentage >= 65 ? 'B' : g.percentage >= 50 ? 'C' : 'F')}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {selectedChild && loadingGrades && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      )}
    </div>
  );
}
