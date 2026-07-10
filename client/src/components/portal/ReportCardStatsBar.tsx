import { StatCard, StatCardGrid } from '@/components/ui/stat-card';
import { Users, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';

export interface ReportCardStatistics {
  totalStudents: number;
  passedStudents: number;
  failedStudents: number;
  classAverage: number;
  classHighest: number;
  classLowest: number;
  draftCount: number;
  finalizedCount: number;
  publishedCount: number;
}

/**
 * Standard stats grid for the teacher report cards page, using the shared
 * StatCard/StatCardGrid components so this page matches the look of other
 * portal pages (e.g. AdminExamAnalysis). Limited to the 4 most essential
 * metrics — status breakdown (draft/finalized/published) is already
 * available via the Status filter, so it's omitted here to avoid clutter.
 */
export function ReportCardStatsBar({ statistics }: { statistics: ReportCardStatistics }) {
  return (
    <StatCardGrid cols={4}>
      <StatCard
        label="Total Students"
        value={statistics.totalStudents}
        icon={Users}
        color="text-foreground"
        data-testid="card-total-students"
      />
      <StatCard
        label="Passed"
        value={statistics.passedStudents}
        icon={CheckCircle}
        color="text-green-600"
        data-testid="card-passed-students"
      />
      <StatCard
        label="Failed"
        value={statistics.failedStudents}
        icon={AlertCircle}
        color="text-red-600"
        data-testid="card-failed-students"
      />
      <StatCard
        label="Class Average"
        value={`${statistics.classAverage}%`}
        icon={TrendingUp}
        color="text-primary"
        data-testid="card-class-average"
      />
    </StatCardGrid>
  );
}
