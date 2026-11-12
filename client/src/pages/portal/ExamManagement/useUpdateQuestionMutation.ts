import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { ExamQuestion, QuestionOption } from '@shared/schema';
import type { QuestionForm } from './schemas';
import { toast } from '@/hooks/use-toast';

/** Auto-split from ExamManagement.tsx — see git history for original context. */
export function useUpdateQuestionMutation({ selectedExam, setEditingQuestion, setEditingImageUrl, resetQuestion, setIsQuestionDialogOpen }: { selectedExam: any; setEditingQuestion: any; setEditingImageUrl: any; resetQuestion: any; setIsQuestionDialogOpen: any }) {
    // Update question mutation with optimistic update
  const updateQuestionMutation = useMutation({
    retry: false,
    mutationFn: async ({ questionId, questionData }: { questionId: number; questionData: Partial<QuestionForm> }) => {
      const response = await apiRequest('PATCH', `/api/exam-questions/${questionId}`, questionData);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update question');
      }
      return response.json();
    },
    onMutate: async ({ questionId, questionData }) => {
      // Cancel outgoing refetches for both the question list and its options
      await queryClient.cancelQueries({ queryKey: ['/api/exam-questions', selectedExam?.id] });
      await queryClient.cancelQueries({ queryKey: ['/api/question-options', questionId] });

      // Snapshot both caches for complete rollback on error
      const previousQuestions = queryClient.getQueryData<ExamQuestion[]>(['/api/exam-questions', selectedExam?.id]);
      const previousOptions = queryClient.getQueryData<QuestionOption[]>(['/api/question-options', questionId]);

      // Optimistically update the question's own fields (text, type, points, etc.)
      // options are stored in a separate cache and handled below
      const { options, ...safeData } = questionData as any;
      queryClient.setQueryData<ExamQuestion[]>(['/api/exam-questions', selectedExam?.id], (old = []) =>
        old.map(q => q.id === questionId ? { ...q, ...safeData } : q)
      );

      // Optimistically update the question options cache using positional mapping.
      // This makes the correct-answer checkmark update instantly — without this,
      // the QuestionOptions component keeps showing the old isCorrect value until
      // the server refetch completes (which was the visible bug).
      if (options && Array.isArray(options)) {
        const currentOptions = queryClient.getQueryData<QuestionOption[]>(['/api/question-options', questionId]) || [];
        const updatedOptions = currentOptions.map((opt, i) => {
          const formOpt = options[i];
          return formOpt
            ? { ...opt, optionText: formOpt.optionText.trim(), isCorrect: Boolean(formOpt.isCorrect) }
            : opt;
        });
        queryClient.setQueryData(['/api/question-options', questionId], updatedOptions);
      }

      // Immediate toast — fires before server responds for instant feedback
      toast({
        title: "Success",
        description: "Question updated successfully",
      });

      return { previousQuestions, previousOptions, questionId };
    },
    onSuccess: (updatedQuestion) => {
      // Silent reconciliation — merge authoritative server data (IDs, timestamps, etc.)
      // Toast already fired in onMutate.
      queryClient.setQueryData<ExamQuestion[]>(['/api/exam-questions', selectedExam?.id], (old = []) =>
        old.map(q => q.id === updatedQuestion.id ? { ...q, ...updatedQuestion } : q)
      );
      // If the server returns updated options, reconcile them in the options cache.
      // Intentionally NOT using invalidateQueries here — that triggers a background
      // refetch that can race the DB commit and restore the old isCorrect values.
      if (updatedQuestion?.options && Array.isArray(updatedQuestion.options) && updatedQuestion.options.length > 0) {
        queryClient.setQueryData(['/api/question-options', updatedQuestion.id], updatedQuestion.options);
      }
      setIsQuestionDialogOpen(false);
      setEditingQuestion(null);
      setEditingImageUrl(null);
      // Reset form with default values
      resetQuestion({
        questionType: 'multiple_choice',
        points: 1,
        questionText: '',
        instructions: '',
        sampleAnswer: '',
        options: [
          { optionText: '', isCorrect: false },
          { optionText: '', isCorrect: false },
          { optionText: '', isCorrect: false },
          { optionText: '', isCorrect: false },
        ]
      });
    },
    onError: (error: any, _variables, context) => {
      // Rollback the question list cache
      if (context?.previousQuestions) {
        queryClient.setQueryData(['/api/exam-questions', selectedExam?.id], context.previousQuestions);
      }
      // Rollback the options cache so the checkmark reverts too
      if (context?.previousOptions !== undefined && context?.questionId) {
        queryClient.setQueryData(['/api/question-options', context.questionId], context.previousOptions);
      }
      toast({
        title: "Failed to Update Question",
        description: error.message || "Unable to save the question. Please try again.",
        variant: "destructive",
      });
    },
  });

  return { updateQuestionMutation };
}
