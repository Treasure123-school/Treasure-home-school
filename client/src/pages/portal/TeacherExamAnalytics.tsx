import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart2, BookOpen, CheckCircle2, XCircle } from 'lucide-react';
import {
  ExamAnalysisTabs, ExamAnalysisSkeleton, normalizeExamAnalytics,
  type AnalyticsData,
} from '@/components/portal/ExamAnalysisTabs';
import type { Exam } from '@shared/schema';

interface Class { id: number; name: string; }
interface Subject { id: number; name: string; code: string; }

export default function TeacherExamAnalytics() {
  const [classFilter, setClassFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [selectedExamId, setSelectedExamId] = useState<string>('');

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

  const { data: rawAnalytics, isLoading, isError } = useQuery<AnalyticsData>({
    queryKey: ['/api/teacher/exam-analytics', selectedExamId],
    enabled: !!selectedExamId,
  });

  const analytics = rawAnalytics ? normalizeExamAnalytics(rawAnalytics) : null;

  const statusBadge = analytics
    ? analytics.exam.isPublished
      ? <Badge className="bg-green-600 text-white">Published</Badge>
      : <Badge variant="secondary">Draft</Badge>
    : null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="heading-exam-analytics">
            <BarChart2 className="h-6 w-6 text-primary" />
            {analytics ? analytics.exam.name : 'Exam Analytics'}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {analytics
              ? `${analytics.exam.className} · ${analytics.exam.subjectName} · ${analytics.exam.termName}`
              : 'Deep insights into student performance and question effectiveness'}
          </p>
        </div>
        {statusBadge}
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
      {selectedExamId && isLoading && <ExamAnalysisSkeleton />}

      {/* Error state */}
      {selectedExamId && isError && (
        <Card className="border-destructive">
          <CardContent className="h-32 flex items-center justify-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Failed to load analytics. Please try again.</span>
          </CardContent>
        </Card>
      )}

      {/* Analytics content */}
      {analytics && !isLoading && (
        <ExamAnalysisTabs analytics={analytics} />
      )}
    </div>
  );
}
