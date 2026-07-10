import { useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, FileText, XCircle } from 'lucide-react';
import {
  ExamAnalysisTabs, ExamAnalysisSkeleton, normalizeExamAnalytics,
  type AnalyticsData,
} from '@/components/portal/ExamAnalysisTabs';

export default function AdminExamAnalysis() {
  const [, params] = useRoute('/portal/admin/exams/analysis/:examId');
  const examId = params?.examId;

  const { data: rawAnalytics, isLoading, isError } = useQuery<AnalyticsData>({
    queryKey: ['/api/teacher/exam-analytics', examId],
    enabled: !!examId,
  });

  const analytics = rawAnalytics ? normalizeExamAnalytics(rawAnalytics) : null;

  const statusBadge = analytics
    ? analytics.exam.isPublished
      ? <Badge className="bg-green-600 text-white"><CheckCircle2 className="h-3 w-3 mr-1" />Published</Badge>
      : <Badge variant="secondary"><FileText className="h-3 w-3 mr-1" />Draft</Badge>
    : null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="heading-exam-analysis">
                {analytics?.exam.name ?? 'Exam Analysis'}
              </h1>
              {statusBadge}
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              {analytics
                ? `${analytics.exam.className} · ${analytics.exam.subjectName} · ${analytics.exam.termName}`
                : 'Loading exam details…'}
            </p>
          </div>
        </div>
      </div>

      {/* Error */}
      {isError && (
        <Card className="border-destructive">
          <CardContent className="h-32 flex items-center justify-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Failed to load exam analysis. Please try again.</span>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && <ExamAnalysisSkeleton />}

      {/* Content */}
      {analytics && !isLoading && (
        <ExamAnalysisTabs analytics={analytics} />
      )}
    </div>
  );
}
