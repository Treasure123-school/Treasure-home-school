import { useMutation } from '@tanstack/react-query';
import { Upload, Check } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Exam, ExamQuestion } from '@shared/schema';
import { toast } from '@/hooks/use-toast';
import { parseCSV } from './csvParsing';

/** Auto-split from ExamManagement.tsx — see git history for original context. */
export function useBulkCsv({ selectedExam, adjustQuestionCountCache }: { selectedExam: any; adjustQuestionCountCache: any }) {
    // CSV upload mutation with optimistic updates for instant UI feedback
  const csvUploadMutation = useMutation({
    retry: false,
    mutationFn: async (questions: any[]) => {
      const response = await apiRequest('POST', '/api/exam-questions/bulk', {
        examId: selectedExam?.id,
        questions
      });

      const result = await response.json();
      return result;
    },
    onMutate: async (newQuestions) => {
      // Show loading toast immediately when mutation starts
      toast({
        title: "Uploading Questions",
        description: `Processing ${newQuestions.length} question${newQuestions.length > 1 ? 's' : ''}... please wait.`,
      });

      const queryKey = ['/api/exam-questions', selectedExam?.id];

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousQuestions = queryClient.getQueryData<ExamQuestion[]>(queryKey);

      // Optimistically add new questions with temporary IDs
      const optimisticQuestions = newQuestions.map((q, index) => ({
        id: -(Date.now() + index), // Negative temp ID
        examId: selectedExam!.id,
        questionText: q.questionText,
        questionType: q.questionType,
        points: q.points,
        orderNumber: (previousQuestions?.length || 0) + index + 1,
        imageUrl: null,
        expectedAnswers: null,
        explanationText: null,
        hintText: null,
        partialCreditRules: null,
        instructions: q.instructions,
        sampleAnswer: q.sampleAnswer,
        createdAt: new Date(),
        autoGradable: q.questionType === 'multiple_choice',
        caseSensitive: false,
        allowPartialCredit: false,
        options: q.options || []
      })) as any;

      // Immediately update UI with optimistic data
      queryClient.setQueryData<ExamQuestion[]>(queryKey, (old: ExamQuestion[] | undefined = []) => [...(old || []), ...optimisticQuestions]);

      // Immediately bump the "X questions" badge by the full batch size —
      // corrected down in onSuccess if some rows fail validation server-side.
      const examId = selectedExam?.id;
      adjustQuestionCountCache(examId, newQuestions.length);

      return { previousQuestions, queryKey, examId, optimisticDelta: newQuestions.length };
    },
    onSuccess: async (data, variables, context) => {
      const successMessage = data.errors && data.errors.length > 0
        ? `${data.created} question${data.created !== 1 ? 's' : ''} uploaded successfully. ${data.errors.length} failed.`
        : `${data.created} question${data.created !== 1 ? 's' : ''} uploaded successfully.`;

      toast({
        title: "✓ Upload Complete",
        description: successMessage,
        variant: data.errors && data.errors.length > 0 ? "default" : "default",
      });

      // Replace optimistic data with real data from backend response
      // This ensures instant update even if Socket.IO doesn't fire for bulk inserts
      if (data.questions && Array.isArray(data.questions)) {
        const queryKey = ['/api/exam-questions', selectedExam?.id];

        queryClient.setQueryData<ExamQuestion[]>(queryKey, (old = []) => {
          // Remove optimistic questions (negative IDs) and add real questions from backend
          const nonOptimistic = old.filter(q => q.id > 0);
          return [...nonOptimistic, ...data.questions];
        });

      }

      // Reconcile the optimistic badge count with what the server actually
      // created — if some rows failed validation, `data.created` is lower
      // than the batch size we optimistically added above.
      const actualCreated = typeof data.created === 'number' ? data.created : variables.length;
      const correction = actualCreated - variables.length;
      if (correction !== 0) {
        adjustQuestionCountCache(selectedExam?.id, correction);
      }
      // Background reconciliation with the server's authoritative count
      queryClient.invalidateQueries({ queryKey: ['/api/exams/question-counts'], exact: false });

      if (data.errors && data.errors.length > 0) {
        setTimeout(() => {
          const errorSummary = data.errors.slice(0, 3).join('; ');
          const moreErrors = data.errors.length > 3 ? ` (and ${data.errors.length - 3} more)` : '';

          toast({
            title: `${data.errors.length} Questions Failed Validation`,
            description: `${errorSummary}${moreErrors}. Check browser console for all details.`,
            variant: "destructive",
            duration: 8000,
          });
        }, 2000);
      }
    },
    onError: (error: any, variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousQuestions) {
        queryClient.setQueryData(context.queryKey, context.previousQuestions);
      }
      // Roll back the optimistic question-count bump for the whole batch
      if (context?.examId && context?.optimisticDelta) {
        adjustQuestionCountCache(context.examId, -context.optimisticDelta);
      }
      // Enhanced error handling for CSV uploads using classified error types
      if (error?.message?.includes('Circuit breaker is OPEN')) {
        toast({
          title: "Connection Issue - CSV Upload",
          description: "Connection temporarily unavailable. Please wait a moment and try again.",
          variant: "destructive",
          duration: 8000,
        });
      } else if (error?.errorType === 'auth') {
        toast({
          title: "Authentication Error",
          description: "Your session may have expired. Please log out and log back in.",
          variant: "destructive",
        });
      } else if (error?.errorType === 'timeout') {
        toast({
          title: "Upload Timeout",
          description: "The CSV upload took too long. Try uploading fewer questions at once.",
          variant: "destructive",
        });
      } else if (error?.errorType === 'network') {
        toast({
          title: "Network Error",
          description: "Please check your internet connection and try again.",
          variant: "destructive",
        });
      } else if (error?.errorType === 'client' || (error?.message?.includes('400') && error?.message?.includes('Validation'))) {
        // Extract validation errors from the response if available
        let errorDetails = "Please check your CSV format. Download the template and ensure all required fields are filled.";
        if (error?.errors && Array.isArray(error.errors)) {
          const firstFewErrors = error.errors.slice(0, 2).join('; ');
          errorDetails = `${firstFewErrors}${error.errors.length > 2 ? ' (and more)' : ''}`;
        }
        toast({
          title: "CSV Validation Errors",
          description: errorDetails,
          variant: "destructive",
          duration: 8000,
        });
      } else {
        toast({
          title: "Upload Failed",
          description: error.message || "Unable to upload questions. Please check your CSV format and try again.",
          variant: "destructive",
          duration: 6000,
        });
      }
    },
  });

    // Handle CSV file upload
  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file || !selectedExam) {
      if (!selectedExam) {
        toast({
          title: "No Exam Selected",
          description: "Please select an exam first before uploading questions.",
          variant: "destructive",
        });
      }
      event.target.value = '';
      return;
    }
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid File Type",
        description: "Please select a CSV file (.csv extension).",
        variant: "destructive",
      });
      event.target.value = '';
      return;
    }
    // Validate file size (max 1MB)
    if (file.size > 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "CSV file must be smaller than 1MB.",
        variant: "destructive",
      });
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string;

        if (!csv || csv.trim().length === 0) {
          throw new Error('CSV file is empty');
        }
        const questions = parseCSV(csv);

        csvUploadMutation.mutate(questions);
      } catch (error: any) {
        toast({
          title: "CSV Format Error",
          description: error.message || "Failed to parse CSV file. Please check the format and try again.",
          variant: "destructive",
          duration: 8000,
        });
      }
    };

    reader.onerror = () => {
      toast({
        title: "File Read Error",
        description: "Failed to read the CSV file. Please try again.",
        variant: "destructive",
      });
    };

    reader.readAsText(file);

    // Reset the input
    event.target.value = '';
  };

  return { csvUploadMutation, handleCSVUpload };
}
