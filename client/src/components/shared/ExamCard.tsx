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
  onView?: () => void;
  actions?: React.ReactNode;
  'data-testid'?: string;
}

export function ExamCard({
  exam,
  className,
  subjectName,
  teacherName,
  onView,
  actions,
  'data-testid': testId,
}: ExamCardProps) {
  return (
    <Card
      className="group hover:border-primary/40 hover:shadow-sm transition-all"
      data-testid={testId}
    >
      <CardContent className="p-4 space-y-3">
        {/* Name + status */}
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

        {/* Footer */}
        {(onView || actions) && (
          <div className="pt-1 border-t border-border/50">
            {actions ?? (
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-8 text-xs justify-center"
                onClick={onView}
              >
                <Eye className="h-3.5 w-3.5 mr-1.5" /> View Details
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
