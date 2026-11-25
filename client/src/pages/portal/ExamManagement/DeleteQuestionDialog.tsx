import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { QuestionRichText } from '@/components/question/QuestionRichText';
import type { ExamQuestion } from '@shared/schema.pg';

export interface DeleteQuestionDialogProps {
  question: ExamQuestion | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: (questionId: number) => void;
}

export function DeleteQuestionDialog({ question, isDeleting, onCancel, onConfirm }: DeleteQuestionDialogProps) {
  return (
    <ConfirmDialog
      open={!!question}
      onOpenChange={(open) => { if (!open) onCancel(); }}
      title="Delete Question"
      description={
        <>
          Are you sure you want to delete this question? This action cannot be undone.
          {question?.questionText && (
            <QuestionRichText
              as="div"
              text={question.questionText}
              className="mt-2 block rounded-md bg-muted p-2 text-xs text-muted-foreground line-clamp-3"
            />
          )}
        </>
      }
      confirmLabel={isDeleting ? 'Deleting...' : 'Delete Question'}
      loading={isDeleting}
      onConfirm={() => { if (question) onConfirm(question.id); }}
      confirmTestId="button-confirm-delete-question"
    />
  );
}
