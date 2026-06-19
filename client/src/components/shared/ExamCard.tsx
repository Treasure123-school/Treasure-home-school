import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BookOpen, CheckCircle, FileText, GraduationCap,
  User, Clock, Calendar, Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Exam } from '@shared/schema';

interface ExamCardProps {
  exam: Exam;
  className: string;
  subjectName: string;
  teacherName?: string;
  /** Label + handler for the primary footer button. Defaults to "View Details". */
  primaryLabel?: string;
  primaryIcon?: React.ElementType;
  onView?: () => void;
  /** Optional icon button rendered to the right of the primary button (e.g. a ⋮ menu). */
  secondaryAction?: React.ReactNode;
  'data-testid'?: string;
}

export function ExamCard({
  exam,
  className,
  subjectName,
  teacherName,
  primaryLabel = 'View Details',
  primaryIcon: PrimaryIcon = Eye,
  onView,
  secondaryAction,
  'data-testid': testId,
}: ExamCardProps) {
  const showFooter = onView || secondaryAction;

  return (
    <Card
      className="group hover:border-primary/40 hover:shadow-sm transition-all"
      data-testid={testId}
    >
      <CardContent className="p-4 space-y-3">
        {/* Name + status badge */}
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm leading-snug">
            {exam.name}
          </p>
          {exam.isPublished ? (
            <Badge className="shrink-0 bg-green-600 text-white text-[10px]">
              <CheckCircle className="h-3 w-3 mr-1" /> Published
            </Badge>
          ) : (
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              <FileText className="h-3 w-3 mr-1" /> Draft
            </Badge>
          )}
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <GraduationCap className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{className}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{subjectName}</span>
          </div>
          {teacherName && (
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{teacherName}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>{exam.timeLimit ? `${exam.timeLimit} min` : 'N/A'}</span>
          </div>
          {exam.date && (
            <div className="flex items-center gap-1.5 col-span-2">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>{format(new Date(exam.date), 'MMM dd, yyyy')}</span>
            </div>
          )}
        </div>

        {/* Footer — matches ExamManagement card pattern: outline flex-1 + optional icon btn */}
        {showFooter && (
          <div className="pt-1 border-t border-border/50 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onView}
            >
              <PrimaryIcon className="h-4 w-4 mr-1.5" />
              {primaryLabel}
            </Button>
            {secondaryAction}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
