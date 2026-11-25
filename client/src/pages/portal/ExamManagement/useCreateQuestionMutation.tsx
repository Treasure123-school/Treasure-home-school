import { useMutation } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { QuestionForm } from './schemas';
import { toast } from '@/hooks/use-toast';

/** Auto-split from ExamManagement.tsx — see git history for original context. */
export function useCreateQuestionMutation({ setIsQuestionDialogOpen, setEditingImageUrl, resetQuestion, adjustQuestionCountCache }: { setIsQuestionDialogOpen: any; setEditingImageUrl: any; resetQuestion: any; adjustQuestionCountCache: any }) {
    // Create question mutation with no retries to prevent circuit breaker amplification
  const createQuestionMutation = useMutation({
    retry: false, // Disable retries for question creation to prevent circuit breaker amplification
    mutationFn: async (questionData: QuestionForm & { examId: number }) => {
      const response = await apiRequest('POST', '/api/exam-questions', questionData);

      // apiRequest already handles error classification for non-OK responses
      const result = await response.json();
      return result;
    },
    onSuccess: (createdQuestion, variables) => {
      const examId = createdQuestion?.examId ? Number(createdQuestion.examId) : variables.examId;
      adjustQuestionCountCache(examId, 1);
      queryClient.invalidateQueries({ queryKey: ['/api/exam-questions', examId] });
      queryClient.invalidateQueries({ queryKey: ['/api/exams/question-counts'], exact: false });
      if (createdQuestion?.id) {
        queryClient.invalidateQueries({ queryKey: ['/api/question-options', createdQuestion.id] });
      }
      setIsQuestionDialogOpen(false);
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
        description: "Question added successfully",
      });
    },
    onError: (error: any) => {
      if (error?.message?.includes('Circuit breaker is OPEN')) {
        toast({
          title: "Connection Issue",
          description: "Connection temporarily unavailable. Please wait a moment and try again.",
          variant: "destructive",
          duration: 8000,
        });
      } else if (error?.errorType === 'auth') {
        toast({
          title: "Authentication Error",
          description: "Please log out and log back in to continue.",
          variant: "destructive",
        });
      } else if (error?.errorType === 'timeout') {
        toast({
          title: "Request Timeout",
          description: "The request took too long. Please try again.",
          variant: "destructive",
        });
      } else if (error?.errorType === 'network') {
        toast({
          title: "Network Error",
          description: "Please check your internet connection and try again.",
          variant: "destructive",
        });
      } else if (error?.errorType === 'client') {
        toast({
          title: "Invalid Question Data",
          description: (
            <div className="space-y-2">
              <p>{error.message || "Please check your question data and try again."}</p>
              <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-800">
                <p className="text-xs font-medium">Quick Checklist:</p>
                <ul className="text-xs space-y-1 mt-1">
                  <li>• Question text is at least 5 characters</li>
                  <li>• Multiple choice has at least 2 options</li>
                  <li>• One option is marked as correct</li>
                  <li>• Point value is assigned</li>
                </ul>
              </div>
            </div>
          ),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to Create Question",
          description: (
            <div className="space-y-2">
              <p>{error.message || "Unable to save the question. Please review and try again."}</p>
              <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-800">
                <p className="text-xs font-medium">Need help?</p>
                <p className="text-xs mt-1">
                  • Check all required fields are filled<br />
                  • Ensure proper question format<br />
                  • Contact admin if issue persists
                </p>
              </div>
            </div>
          ),
          variant: "destructive",
        });
      }
    },
  });

  return { createQuestionMutation };
}
