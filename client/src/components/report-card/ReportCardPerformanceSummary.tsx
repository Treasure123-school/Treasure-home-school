/** Section 2 — overall performance stats + class highest/lowest/average row. */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Award, TrendingUp, TrendingDown } from 'lucide-react';
import { formatPosition } from '@/lib/report-card-utils';
import { getGradeColor } from '@/lib/report-card-utils';
import type { ReportCardData, ClassStatistics } from './types';

interface Props {
  reportCard: ReportCardData;
  classStats: ClassStatistics;
  totalSubjects: number;
  totalObtained: number;
  totalMax: number;
}

export function ReportCardPerformanceSummary({
  reportCard, classStats, totalSubjects, totalObtained, totalMax,
}: Props) {
  return (
    <Card className="mb-4 print:shadow-none print:border-2">
      <CardHeader className="pb-2 pt-3 px-3 sm:px-4">
        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Overall Performance Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0">
        {/* Top stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          <div className="bg-muted/50 p-2 sm:p-3 rounded-md text-center">
            <p className="text-xs text-muted-foreground">Total Subjects</p>
            <p className="text-lg sm:text-xl font-bold" data-testid="text-subjects-count">{totalSubjects}</p>
          </div>
          <div className="bg-muted/50 p-2 sm:p-3 rounded-md text-center">
            <p className="text-xs text-muted-foreground">Total Marks</p>
            <p className="text-lg sm:text-xl font-bold" data-testid="text-total-score">
              {totalObtained}<span className="text-sm font-normal text-muted-foreground">/{totalMax}</span>
            </p>
          </div>
          <div className="bg-muted/50 p-2 sm:p-3 rounded-md text-center">
            <p className="text-xs text-muted-foreground">Average Score</p>
            <p className="text-lg sm:text-xl font-bold" data-testid="text-average">{reportCard.averagePercentage || 0}%</p>
          </div>
          <div className="bg-primary/10 p-2 sm:p-3 rounded-md text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Award className="w-3 h-3" /> Class Position
            </p>
            <p className="text-lg sm:text-xl font-bold text-primary" data-testid="text-position">
              {formatPosition(reportCard.position)}{' '}
              <span className="text-sm font-normal text-muted-foreground">of {reportCard.totalStudentsInClass}</span>
            </p>
          </div>
          <div className="bg-muted/50 p-2 sm:p-3 rounded-md text-center col-span-2 sm:col-span-1">
            <p className="text-xs text-muted-foreground">Final Grade</p>
            <Badge className={`text-sm sm:text-base ${getGradeColor(reportCard.overallGrade)}`} data-testid="badge-grade">
              {reportCard.overallGrade || '-'}
            </Badge>
          </div>
        </div>

        {/* Class statistics row */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-3">
          <div className="bg-green-50 dark:bg-green-900/20 p-2 sm:p-3 rounded-md text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <TrendingUp className="w-3 h-3 text-green-600" /> Class Highest
            </p>
            <p className="text-lg sm:text-xl font-bold text-green-600" data-testid="text-class-highest">
              {classStats.highestScore}%
            </p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 p-2 sm:p-3 rounded-md text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <TrendingDown className="w-3 h-3 text-red-600" /> Class Lowest
            </p>
            <p className="text-lg sm:text-xl font-bold text-red-600" data-testid="text-class-lowest">
              {classStats.lowestScore}%
            </p>
          </div>
          <div className="bg-primary/5 p-2 sm:p-3 rounded-md text-center">
            <p className="text-xs text-muted-foreground">Class Average</p>
            <p className="text-lg sm:text-xl font-bold text-primary" data-testid="text-class-average">
              {classStats.classAverage}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
