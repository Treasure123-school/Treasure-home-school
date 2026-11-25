import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { ExamQuestion } from '@shared/schema.pg';
import { toast } from '@/hooks/use-toast';

/** Auto-split from ExamManagement.tsx — see git history for original context. */
export function useDeleteQuestionMutation({ selectedExam, editingQuestion, setEditingQuestion, pendingQuestionDeletionsRef, adjustQuestionCountCache, setQuestionToDelete }: { selectedExam: any; editingQuestion: any; setEditingQuestion: any; pendingQuestionDeletionsRef: any; adjustQuestionCountCache: any; setQuestionToDelete: any }) {
  const deleteQuestionMutation = useMutation({
    mutationFn: async (questionId: number) => {
      const response = await apiRequest('DELETE', `/api/exam-questions/${questionId}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to delete question');
      }
      return null;
    },
    onMutate: async () => {
      const examId = selectedExam?.id;
      if (examId) {
        await queryClient.cancelQueries({ queryKey: ['/api/exam-questions', examId] });
      }
      return { examId };
    },
    onSuccess: (_, questionId, context) => {
      pendingQuestionDeletionsRef.current.delete(questionId);
      if (editingQuestion?.id === questionId) setEditingQuestion(null);

      const examId = (context as { examId?: number } | undefined)?.examId ?? selectedExam?.id;
      if (examId) {
        queryClient.setQueryData<ExamQuestion[]>(['/api/exam-questions', examId], (old) =>
          old?.filter((q) => q.id !== questionId) ?? []
        );
        adjustQuestionCountCache(examId, -1);
      }

      toast({ title: 'Question deleted', description: 'Question removed successfully.' });
      void queryClient.invalidateQueries({ queryKey: ['/api/exams/question-counts'] }).catch(() => {});
      void queryClient.invalidateQueries({ queryKey: ['/api/question-options', questionId] }).catch(() => {});
    },
    onError: (error: any, questionId) => {
      pendingQuestionDeletionsRef.current.delete(questionId);
      toast({
        title: 'Deletion Failed',
        description: error.message || 'Failed to delete question. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleConfirmDeleteQuestion = useCallback((questionId: number) => {
    if (deleteQuestionMutation.isPending) return;
    deleteQuestionMutation.mutate(questionId, {
      onSuccess: () => setQuestionToDelete(null),
    });
  }, [deleteQuestionMutation, setQuestionToDelete]);

  return { deleteQuestionMutation, handleConfirmDeleteQuestion };
}
