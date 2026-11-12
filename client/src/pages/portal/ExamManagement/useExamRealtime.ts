import { useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useSocketIORealtime } from '@/hooks/useSocketIORealtime';
import type { Exam, ExamQuestion } from '@shared/schema';

/** Auto-split from ExamManagement.tsx — see git history for original context. */
export function useExamRealtime({ selectedExam, setSelectedExam, setEditingExam, editingQuestion, setEditingQuestion, pendingDeletionsRef, pendingQuestionDeletionsRef, togglingExamsRef, setExamToggling }: { selectedExam: any; setSelectedExam: any; setEditingExam: any; editingQuestion: any; setEditingQuestion: any; pendingDeletionsRef: any; pendingQuestionDeletionsRef: any; togglingExamsRef: any; setExamToggling: any }) {
    // Enable real-time updates for exams with specific event handlers.
  // skipCacheInvalidation: true prevents the socket from calling refetchQueries after
  // any exams table event. Without this, the server-emitted socket event (triggered by
  // our own togglePublishMutation) races against onSuccess: the hard refetch may fetch
  // stale data and overwrite the optimistic badge flip, causing it to flicker.
  // All cache reconciliation is handled explicitly in onEvent and in onSuccess instead.
  useSocketIORealtime({
    table: 'exams',
    queryKey: ['/api/exams'],
    skipCacheInvalidation: true,
    onEvent: (event) => {
      // Handle exam.deleted event - immediately remove from cache
      if (event.eventType === 'exam.deleted' || (event.operation === 'DELETE' && event.table === 'exams')) {
        const deletedExamId = event.data?.id;
        if (deletedExamId) {
          // Clear pending deletion flag - the delete is now confirmed by backend
          pendingDeletionsRef.current.delete(deletedExamId);

          queryClient.setQueryData(['/api/exams'], (old: Exam[] | undefined) =>
            old?.filter((e) => e.id !== deletedExamId) || []
          );
          // Clear selected exam if it was deleted
          if (selectedExam?.id === deletedExamId) {
            setSelectedExam(null);
            setEditingExam(null);
            setEditingQuestion(null);
          }
        }
      }
      // Handle exam.published / exam.unpublished events - update cache and clear toggle state
      if (event.eventType === 'exam.published' || event.eventType === 'exam.unpublished') {
        const updatedExam = event.data;
        if (updatedExam?.id) {
          // Use ref to get current toggling state (avoids stale closure)
          if (updatedExam.id in togglingExamsRef.current) {
            setExamToggling(updatedExam.id, null);
          }
          queryClient.setQueryData(['/api/exams'], (old: Exam[] | undefined) =>
            old?.map((e) => e.id === updatedExam.id ? updatedExam : e) || []
          );
        }
      }
      // Handle table_change UPDATE events for exams (covers publish/unpublish via emitTableChange)
      if (event.operation === 'UPDATE' && event.table === 'exams') {
        const updatedExam = event.data;
        if (updatedExam?.id) {
          // Use ref to get current toggling state (avoids stale closure)
          if (updatedExam.id in togglingExamsRef.current) {
            setExamToggling(updatedExam.id, null);
          }
        }
      }
    }
  });

  // Enable real-time updates for exam questions when viewing/editing an exam
  // Note: queryKey must match exactly with the useQuery queryKey for cache invalidation to work
  // skipCacheInvalidation=true: we manage all cache updates manually in onEvent and via
  // optimistic mutations. Without this, the hook calls refetchQueries() on every socket
  // event which races with optimistic updates and can restore deleted questions.
  useSocketIORealtime({
    table: 'exam_questions',
    queryKey: ['/api/exam-questions', selectedExam?.id],
    examId: selectedExam?.id,
    enabled: !!selectedExam?.id,
    skipCacheInvalidation: true,
    onEvent: (event) => {
      // Handle question.deleted event - immediately remove from cache
      if (event.eventType === 'question.deleted' || (event.operation === 'DELETE' && event.table === 'exam_questions')) {
        const deletedQuestionId = event.data?.id;
        const eventExamId = event.data?.examId;
        if (deletedQuestionId) {
          // Clear pending deletion flag - the delete is now confirmed by backend
          pendingQuestionDeletionsRef.current.delete(deletedQuestionId);

          if (selectedExam?.id === eventExamId) {
            queryClient.setQueryData(['/api/exam-questions', selectedExam?.id], (old: ExamQuestion[] | undefined) =>
              old?.filter((q) => q.id !== deletedQuestionId) || []
            );
            // Clear editing question if it was deleted
            if (editingQuestion?.id === deletedQuestionId) {
              setEditingQuestion(null);
            }
          }
        }
      }
    }
  });

  return {  };
}
