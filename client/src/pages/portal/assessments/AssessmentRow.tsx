import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { BookOpen, Clock, FileText, Layers, Play } from 'lucide-react';
import type { Exam } from '@shared/schema';
import { AssessmentActionsMenu } from './AssessmentActionsMenu';

export interface AssessmentRowProps {
  exam: Exam;
  questionCount: number;
  isPublishToggling: boolean;
  togglingAction: 'publish' | 'unpublish' | null;
  isDeleting: boolean;
  onManageQuestions: (exam: Exam) => void;
  onTogglePublish: (exam: Exam) => void;
  onPreview: (exam: Exam) => void;
  onEditSettings: (exam: Exam) => void;
  onRequestDelete: (exam: Exam) => void;
  getClassNameById: (classId: number) => string;
  getSubjectNameById: (subjectId: number) => string;
}

function ScheduleCell({ exam }: { exam: Exam }) {
  const now = new Date();
  const startTime = exam.startTime ? new Date(exam.startTime) : null;
  const endTime = exam.endTime ? new Date(exam.endTime) : null;

  if (exam.timerMode === 'global' && startTime && endTime) {
    if (now < startTime) {
      return (
        <Badge variant="outline" className="bg-yellow-50">
          <Clock className="w-3 h-3 mr-1" />
          Scheduled
        </Badge>
      );
    }
    if (now >= startTime && now <= endTime) {
      return (
        <Badge variant="default" className="bg-green-600">
          <Play className="w-3 h-3 mr-1" />
          Live Now
        </Badge>
      );
    }
    return <Badge variant="secondary">Ended</Badge>;
  }
  return <span className="text-sm text-muted-foreground">Individual Timer</span>;
}

/** Single assessment row — desktop table layout. */
export function AssessmentRow({
  exam,
  questionCount,
  isPublishToggling,
  togglingAction,
  isDeleting,
  onManageQuestions,
  onTogglePublish,
  onPreview,
  onEditSettings,
  onRequestDelete,
  getClassNameById,
  getSubjectNameById,
}: AssessmentRowProps) {
  return (
    <TableRow data-testid={`row-exam-${exam.id}`}>
      <TableCell className="font-medium">{exam.name}</TableCell>
      <TableCell>
        {exam.assessmentCategory === 'standalone' ? (
          <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300">
            <Layers className="w-3 h-3 mr-1" />
            Standalone
          </Badge>
        ) : (
          <Badge className="text-xs bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300">
            <BookOpen className="w-3 h-3 mr-1" />
            Academic
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {exam.assessmentCategory === 'standalone'
          ? (exam.targetType || exam.venue || '—')
          : getClassNameById(exam.classId!)}
      </TableCell>
      <TableCell>
        {exam.assessmentCategory === 'standalone' ? (exam.purpose || '—') : getSubjectNameById(exam.subjectId!)}
      </TableCell>
      <TableCell>{new Date(exam.date).toLocaleDateString()}</TableCell>
      <TableCell>
        {exam.timeLimit ? (
          <div className="flex items-center">
            <Clock className="w-4 h-4 mr-1" />
            {exam.timeLimit}m
          </div>
        ) : (
          'No limit'
        )}
      </TableCell>
      <TableCell>
        <Badge variant={exam.isPublished ? 'default' : 'secondary'}>{exam.isPublished ? 'Published' : 'Draft'}</Badge>
      </TableCell>
      <TableCell>
        <ScheduleCell exam={exam} />
      </TableCell>
      <TableCell>
        <div className="flex items-center">
          <FileText className="w-4 h-4 mr-1" />
          {questionCount} question{questionCount !== 1 ? 's' : ''}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <AssessmentActionsMenu
          exam={exam}
          variant="desktop"
          isPublishToggling={isPublishToggling}
          togglingAction={togglingAction}
          isDeleting={isDeleting}
          onManageQuestions={onManageQuestions}
          onTogglePublish={onTogglePublish}
          onPreview={onPreview}
          onEditSettings={onEditSettings}
          onRequestDelete={onRequestDelete}
        />
      </TableCell>
    </TableRow>
  );
}
