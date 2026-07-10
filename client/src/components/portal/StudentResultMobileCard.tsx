import { Badge } from '@/components/ui/badge';
import { StudentRowActionsMenu, type StudentRowAction } from '@/components/portal/StudentRowActionsMenu';

interface StudentResultMobileCardProps {
  position: number;
  studentName: string;
  admissionNumber?: string | null;
  score: number;
  maxScore: number;
  scorePercent: number;
  percentColorClass: string;
  grade?: string | null;
  gradeColor?: string;
  passed: boolean;
  actions?: StudentRowAction[];
  testId?: string;
}

/** Card representation of a single student's exam result, used on mobile in place of table rows. */
export function StudentResultMobileCard({
  position,
  studentName,
  admissionNumber,
  score,
  maxScore,
  scorePercent,
  percentColorClass,
  grade,
  gradeColor,
  passed,
  actions,
  testId,
}: StudentResultMobileCardProps) {
  return (
    <div
      className="rounded-lg border p-3 flex items-start gap-3"
      data-testid={testId}
    >
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${position <= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-muted text-muted-foreground'}`}>
        #{position}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{studentName}</p>
            {admissionNumber && <p className="text-xs text-muted-foreground truncate">{admissionNumber}</p>}
          </div>
          {actions && actions.length > 0 && (
            <StudentRowActionsMenu actions={actions} testId={testId ? `${testId}-actions` : undefined} />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm">
          <span className="text-muted-foreground">{score}/{maxScore}</span>
          <span className={`font-semibold ${percentColorClass}`}>{scorePercent}%</span>
          {grade && (
            <Badge variant="outline" style={{ borderColor: gradeColor, color: gradeColor }}>{grade}</Badge>
          )}
          <Badge
            variant={passed ? 'default' : 'destructive'}
            className={passed ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : ''}
          >
            {passed ? 'Pass' : 'Fail'}
          </Badge>
        </div>
      </div>
    </div>
  );
}
