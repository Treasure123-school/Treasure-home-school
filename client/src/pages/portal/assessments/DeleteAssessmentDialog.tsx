import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Exam } from '@shared/schema';

export interface DeleteAssessmentDialogProps {
  exam: Exam | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: (exam: Exam) => void;
}

/**
 * Single confirmation dialog shared by both the mobile card and desktop table
 * actions menu. Deletion only happens when the user confirms here; the
 * calling mutation then waits for the backend's success response before the
 * assessment actually disappears from the list (see ExamManagement.tsx).
 */
export function DeleteAssessmentDialog({ exam, isDeleting, onCancel, onConfirm }: DeleteAssessmentDialogProps) {
  return (
    <AlertDialog open={!!exam} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Exam</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the exam "{exam?.name}"? This action cannot be undone and will permanently
            remove all exam questions and student results.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isDeleting}
            onClick={() => {
              if (exam) onConfirm(exam);
            }}
          >
            {isDeleting ? 'Deleting...' : 'Delete Exam'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
