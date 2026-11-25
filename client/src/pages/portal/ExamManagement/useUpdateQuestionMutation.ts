import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { ExamQuestion } from '@shared/schema.pg';
import type { QuestionForm } from './schemas';
import { toast } from '@/hooks/use-toast';

/** Auto-split from ExamManagement.tsx — see git history for original context. */
export function useUpdateQuestionMutation({ selectedExam, setEditingQuestion, setEditingImageUrl, resetQuestion, setIsQuestionDialogOpen }: { selectedExam: any; setEditingQuestion: any; setEditingImageUrl: any; resetQuestion: any; setIsQuestionDialogOpen: any }) {
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
    onMutate: async ({ questionId }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/exam-questions', selectedExam?.id] });
      await queryClient.cancelQueries({ queryKey: ['/api/question-options', questionId] });
      return { questionId };
    },
    onSuccess: (updatedQuestion) => {
      const examId = updatedQuestion?.examId ? Number(updatedQuestion.examId) : selectedExam?.id;
      queryClient.setQueryData<ExamQuestion[]>(['/api/exam-questions', examId], (old = []) =>
        old.map(q => q.id === updatedQuestion.id ? { ...q, ...updatedQuestion } : q)
      );
      queryClient.invalidateQueries({ queryKey: ['/api/question-options', updatedQuestion.id] });
      setIsQuestionDialogOpen(false);
      setEditingQuestion(null);
      setEditingImageUrl(null);
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
      toast({
        title: "Success",
        description: "Question updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Update Question",
        description: error.message || "Unable to save the question. Please try again.",
        variant: "destructive",
      });
    },
  });

  return { updateQuestionMutation };
}
