import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Exam } from '@shared/schema';
import type { ExamForm } from './schemas';
import { toast } from '@/hooks/use-toast';

/** Auto-split from ExamManagement.tsx — see git history for original context. */
export function useExamMutations({ setIsExamDialogOpen, setEditingExam, resetExam, setCurrentStep, setDeletingExamIds, pendingDeletionsRef, selectedExam, setSelectedExam, setEditingQuestion, togglingExamsRef, setExamToggling }: { setIsExamDialogOpen: any; setEditingExam: any; resetExam: any; setCurrentStep: any; setDeletingExamIds: any; pendingDeletionsRef: any; selectedExam: any; setSelectedExam: any; setEditingQuestion: any; togglingExamsRef: any; setExamToggling: any }) {
    // Create exam mutation
  const createExamMutation = useMutation({
    mutationFn: async (examData: ExamForm) => {
      const response = await apiRequest('POST', '/api/exams', examData);
      if (!response.ok) throw new Error('Failed to create exam');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Exam created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/exams'] });
      setIsExamDialogOpen(false);
      setEditingExam(null);
      resetExam();
      setCurrentStep(1);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create exam",
        variant: "destructive",
      });
    },
  });

  // Update exam mutation
  const updateExamMutation = useMutation({
    mutationFn: async ({ examId, examData }: { examId: number; examData: Partial<ExamForm> }) => {
      const response = await apiRequest('PATCH', `/api/exams/${examId}`, examData);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update exam');
      }
      return response.json();
    },
    onMutate: async ({ examId, examData }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/exams'] });
      const previousExams = queryClient.getQueryData(['/api/exams']);

      queryClient.setQueryData(['/api/exams'], (old: Exam[] | undefined) => {
        if (!old) return old;
        return old.map((exam) =>
          exam.id === examId ? { ...exam, ...examData } : exam
        );
      });

      return { previousExams };
    },
    onSuccess: (updatedExam) => {
      queryClient.setQueryData(['/api/exams'], (old: Exam[] | undefined) => {
        if (!old) return old;
        return old.map((exam) =>
          exam.id === updatedExam.id ? updatedExam : exam
        );
      });

      toast({
        title: "Success",
        description: "Exam updated successfully",
      });
      setIsExamDialogOpen(false);
      setEditingExam(null);
      resetExam();
      setCurrentStep(1);
    },
    onError: (error: any, variables, context: any) => {
      if (context?.previousExams) {
        queryClient.setQueryData(['/api/exams'], context.previousExams);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update exam",
        variant: "destructive",
      });
    },
  });

  // Publish/Unpublish exam mutation with optimistic update
  const togglePublishMutation = useMutation({
    mutationFn: async ({ examId, isPublished }: { examId: number; isPublished: boolean }) => {
      const response = await apiRequest('PATCH', `/api/exams/${examId}/publish`, { isPublished });
      if (!response.ok) throw new Error('Failed to update exam publish status');
      return response.json();
    },
    onMutate: async ({ examId, isPublished }) => {
      // Track this exam's in-flight action explicitly, keyed by its own id, so a
      // second toggle on a different exam can never clear or overwrite this one's
      // pending label. Recording it here (before the cache flips) is what lets the
      // button correctly say "Publishing..." vs "Unpublishing..." — reading it back
      // off exam.isPublished after the optimistic update would always show the
      // opposite word, since that field is already the new value.
      setExamToggling(examId, isPublished ? 'publish' : 'unpublish');

      await queryClient.cancelQueries({ queryKey: ['/api/exams'] });
      const previousExams = queryClient.getQueryData(['/api/exams']);

      // Optimistically update the exam's published status for instant feedback
      queryClient.setQueryData(['/api/exams'], (old: any) => {
        if (!old) return old;
        return old.map((exam: any) =>
          exam.id === examId ? { ...exam, isPublished } : exam
        );
      });

      // Immediate toast — fires before server responds for instant user feedback
      toast({
        title: isPublished ? "Published" : "Unpublished",
        description: isPublished
          ? "Exam published. Students can now access it."
          : "Exam unpublished. Students can no longer access it.",
      });

      return { previousExams };
    },
    onSuccess: (data) => {
      // Silent cache reconciliation — merge authoritative server data (publishedAt, etc.)
      // without triggering a refetch. Toast already fired in onMutate.
      queryClient.setQueryData(['/api/exams'], (old: any) => {
        if (!old) return old;
        return old.map((exam: any) =>
          exam.id === data.id ? { ...exam, ...data } : exam
        );
      });
    },
    onError: (error: any, variables, context: any) => {
      if (context?.previousExams) {
        queryClient.setQueryData(['/api/exams'], context.previousExams);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update exam publish status",
        variant: "destructive",
      });
    },
    onSettled: (_data, _error, variables) => {
      // Clear only THIS exam's toggling state once its own request finishes,
      // success or failure — guarantees the button never gets stuck reading
      // "Publishing..."/"Unpublishing..." forever, and never clears a different
      // exam's still-in-flight toggle if multiple are triggered concurrently.
      setExamToggling(variables.examId, null);
    },
  });

  // Delete exam mutation — confirm-first (not optimistic).
  // The frontend never touches the exams list until the backend has actually
  // returned a success status for the DELETE request. This guarantees the
  // item can never flicker back in: it simply never leaves until the server
  // confirms it's really gone. Uses the smart deletion system on the backend,
  // which cascade-deletes all related data.
  const deleteExamMutation = useMutation({
    mutationFn: async (examId: number) => {
      try {
        const response = await apiRequest('DELETE', `/api/exams/${examId}`);
        // 404 means the exam is already gone from the database (stale cache).
        // Goal achieved — treat it as success.
        if (response.status === 404) return null;
        if (!response.ok) {
          // Read the actual server error so the toast shows a meaningful message
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.message || `Failed to delete exam (${response.status})`);
        }
        // Handle both 204 (legacy) and 200 with deletion stats
        if (response.status === 204) return null;
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 0) {
          return response.json();
        }
        return null;
      } catch (error) {
        // Re-throw so react-query's onError handles the UI feedback consistently,
        // whether the failure was a thrown network error or a non-OK response above.
        throw error instanceof Error ? error : new Error('Failed to delete exam');
      }
    },
    onMutate: async (examId) => {
      // Mark this deletion as pending to prevent the Realtime socket from
      // re-adding it while the request is in flight. Intentionally does NOT
      // remove the item from the cache — it must stay visible until the
      // backend confirms success, so there is nothing to roll back on error.
      pendingDeletionsRef.current.add(examId);
      setDeletingExamIds((prev: any) => new Set(prev).add(examId));
    },
    onSuccess: (_, examId) => {
      // Clear pending/in-flight flags
      pendingDeletionsRef.current.delete(examId);
      setDeletingExamIds((prev: any) => { const next = new Set(prev); next.delete(examId); return next; });

      // Only now — after the backend confirmed the deletion — remove it from the UI.
      queryClient.setQueryData<Exam[]>(['/api/exams'], (old) =>
        old?.filter((e) => e.id !== examId) ?? []
      );

      if (selectedExam?.id === examId) {
        setSelectedExam(null);
        setEditingExam(null);
        setEditingQuestion(null);
      }

      toast({ title: "Success", description: "Exam deleted successfully" });

      // Silent background invalidations — these never block the UI
      queryClient.invalidateQueries({ queryKey: ['/api/exams/question-counts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/exam-results'] });
      queryClient.invalidateQueries({ queryKey: ['/api/exam-sessions'] });
    },
    onError: (error: any, examId) => {
      // Remove from pending flags — the item was never hidden, so nothing to restore
      pendingDeletionsRef.current.delete(examId);
      setDeletingExamIds((prev: any) => { const next = new Set(prev); next.delete(examId); return next; });

      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete exam. Please try again.",
        variant: "destructive",
      });
    },
  });

  return { createExamMutation, updateExamMutation, togglePublishMutation, deleteExamMutation };
}
