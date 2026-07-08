import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Clock, Edit, FileText, Layers, Play } from 'lucide-react';
import type { Exam } from '@shared/schema';
import { AssessmentActionsMenu } from './AssessmentActionsMenu';

export interface AssessmentCardProps {
  exam: Exam;
  questionCount: number;
  isPublishToggling: boolean;
  isDeleting: boolean;
  onManageQuestions: (exam: Exam) => void;
  onTogglePublish: (exam: Exam) => void;
  onPreview: (exam: Exam) => void;
  onEditSettings: (exam: Exam) => void;
  onRequestDelete: (exam: Exam) => void;
  getClassNameById: (classId: number) => string;
  getSubjectNameById: (subjectId: number) => string;
}

function ScheduleBadge({ exam }: { exam: Exam }) {
  const now = new Date();
  const startTime = exam.startTime ? new Date(exam.startTime) : null;
  const endTime = exam.endTime ? new Date(exam.endTime) : null;

  if (exam.timerMode !== 'global' || !startTime || !endTime) return null;

  if (now < startTime) {
    return (
      <Badge variant="outline" className="bg-yellow-50 w-fit">
        <Clock className="w-3 h-3 mr-1" />
        Scheduled
      </Badge>
    );
  }
  if (now >= startTime && now <= endTime) {
    return (
      <Badge variant="default" className="bg-green-600 w-fit">
        <Play className="w-3 h-3 mr-1" />
        Live Now
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="w-fit">
      Ended
    </Badge>
  );
}

/** Single assessment card — mobile layout. Shows title, tags, question count, and actions. */
export function AssessmentCard({
  exam,
  questionCount,
  isPublishToggling,
  isDeleting,
  onManageQuestions,
  onTogglePublish,
  onPreview,
  onEditSettings,
  onRequestDelete,
  getClassNameById,
  getSubjectNameById,
}: AssessmentCardProps) {
  return (
    <div
      className="border border-border rounded-lg p-3 bg-muted/30"
      data-testid={`card-exam-${exam.id}`}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              {exam.assessmentCategory === 'standalone' ? (
                <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300">
                  <Layers className="w-2.5 h-2.5 mr-0.5" />
                  Standalone
                </Badge>
              ) : (
                <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300">
                  <BookOpen className="w-2.5 h-2.5 mr-0.5" />
                  Academic
                </Badge>
              )}
            </div>
            <h3 className="font-medium text-sm truncate">{exam.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {exam.assessmentCategory === 'standalone'
                ? (exam.purpose || exam.venue || 'Standalone Assessment')
                : `${getClassNameById(exam.classId!)} • ${getSubjectNameById(exam.subjectId!)}`}
            </p>
          </div>
          <Badge variant={exam.isPublished ? 'default' : 'secondary'} className="ml-2 flex-shrink-0">
            {exam.isPublished ? 'Published' : 'Draft'}
          </Badge>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-3">
            <span>{new Date(exam.date).toLocaleDateString()}</span>
            {exam.timeLimit && (
              <div className="flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                {exam.timeLimit}m
              </div>
            )}
          </div>
          <div className="flex items-center">
            <FileText className="w-3 h-3 mr-1" />
            {questionCount}
          </div>
        </div>

        <ScheduleBadge exam={exam} />

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onManageQuestions(exam)}
            data-testid={`button-manage-questions-${exam.id}`}
            className="flex-1"
          >
            <Edit className="w-4 h-4 mr-1" />
            Questions
          </Button>

          <AssessmentActionsMenu
            exam={exam}
            variant="mobile"
            isPublishToggling={isPublishToggling}
            isDeleting={isDeleting}
            onManageQuestions={onManageQuestions}
            onTogglePublish={onTogglePublish}
            onPreview={onPreview}
            onEditSettings={onEditSettings}
            onRequestDelete={onRequestDelete}
          />
        </div>
      </div>
    </div>
  );
}
