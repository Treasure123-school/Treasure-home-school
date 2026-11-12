import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { ExamQuestion } from '@shared/schema';
import { toast } from '@/hooks/use-toast';

/** Auto-split from ExamManagement.tsx — see git history for original context. */
export function useDeleteQuestionMutation({ selectedExam, editingQuestion, setEditingQuestion, pendingQuestionDeletionsRef, adjustQuestionCountCache, setQuestionToDelete }: { selectedExam: any; editingQuestion: any; setEditingQuestion: any; pendingQuestionDeletionsRef: any; adjustQuestionCountCache: any; setQuestionToDelete: any }) {
    // Delete question mutation — optimistic update for instant UI feedback.
  // The item disappears immediately; restored automatically if the backend fails.
  const deleteQuestionMutation = useMutation({
    mutationFn: async (questionId: number) => {
      const response = await apiRequest('DELETE', `/api/exam-questions/${questionId}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to delete question');
      }
      return null;
    },
    onMutate: async (questionId) => {
      // Mark as pending to shield against race conditions with Realtime events
      pendingQuestionDeletionsRef.current.add(questionId);

      const examId = selectedExam?.id;

      if (examId) {
        // Cancel any in-flight refetches so they don't overwrite our optimistic removal
        await queryClient.cancelQueries({ queryKey: ['/api/exam-questions', examId] });

        // Snapshot the current list so we can roll back on error
        const snapshot = queryClient.getQueryData<ExamQuestion[]>(['/api/exam-questions', examId]);

        // Immediately remove from cache — user sees it gone right now
        queryClient.setQueryData<ExamQuestion[]>(['/api/exam-questions', examId], (old) =>
          old?.filter((q) => q.id !== questionId) ?? []
        );

        // Immediately decrement the "X questions" badge for this exam — don't
        // wait for the background invalidation to refetch it.
        adjustQuestionCountCache(examId, -1);

        // Immediate success feedback — no waiting for the server
        toast({ title: "Question deleted", description: "Question removed successfully." });

        return { snapshot, examId };
      }

      toast({ title: "Question deleted", description: "Question removed successfully." });
      return { snapshot: undefined, examId: undefined };
    },
    onSuccess: (_, questionId) => {
      pendingQuestionDeletionsRef.current.delete(questionId);
      if (editingQuestion?.id === questionId) setEditingQuestion(null);

      // Defensive: ensure the question is gone even if a socket-triggered refetch
      // restored it between onMutate and now. This is a no-op when the optimistic
      // update already removed it correctly.
      const examId = selectedExam?.id;
      if (examId) {
        queryClient.setQueryData<ExamQuestion[]>(['/api/exam-questions', examId], (old) =>
          old?.filter((q) => q.id !== questionId) ?? []
        );
      }

      // Silent background sync — does not flicker the UI
      queryClient.invalidateQueries({ queryKey: ['/api/exams/question-counts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/question-options', questionId] });
    },
    onError: (error: any, questionId, context) => {
      pendingQuestionDeletionsRef.current.delete(questionId);

      // Roll back optimistic removal — restore exact previous list
      const ctx = context as { snapshot?: ExamQuestion[]; examId?: number } | undefined;
      if (ctx?.snapshot !== undefined && ctx?.examId) {
        queryClient.setQueryData(['/api/exam-questions', ctx.examId], ctx.snapshot);
      }
      // Roll back the optimistic question-count decrement too
      if (ctx?.examId) {
        adjustQuestionCountCache(ctx.examId, 1);
      }

      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete question. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handles confirm-delete: closes the modal immediately then fires the mutation
  // so the user gets instant feedback without waiting for the network.
  const handleConfirmDeleteQuestion = useCallback((questionId: number) => {
    setQuestionToDelete(null); // close confirmation dialog immediately
    deleteQuestionMutation.mutate(questionId);
  }, [deleteQuestionMutation]);

  return { deleteQuestionMutation, handleConfirmDeleteQuestion };
}
