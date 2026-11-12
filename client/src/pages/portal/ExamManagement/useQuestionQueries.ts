import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Exam, ExamQuestion } from '@shared/schema';

/** Auto-split from ExamManagement.tsx — see git history for original context. */
export function useQuestionQueries({ selectedExam, previewExam, pendingQuestionDeletionsRef, exams }: { selectedExam: any; previewExam: any; pendingQuestionDeletionsRef: any; exams: any }) {
    const { data: rawExamQuestions = [], isLoading: loadingQuestions } = useQuery<ExamQuestion[]>({
    queryKey: ['/api/exam-questions', selectedExam?.id],
    enabled: !!selectedExam?.id,
  });

  // Filter out questions that are pending deletion to prevent race conditions
  const examQuestions = rawExamQuestions.filter((question: ExamQuestion) => !pendingQuestionDeletionsRef.current.has(question.id));

  const { data: rawPreviewQuestions = [], isLoading: loadingPreviewQuestions } = useQuery<ExamQuestion[]>({
    queryKey: ['/api/exam-questions', previewExam?.id],
    enabled: !!previewExam?.id,
  });

  // Filter out questions that are pending deletion to prevent race conditions in preview
  const previewQuestions = rawPreviewQuestions.filter((question: ExamQuestion) => !pendingQuestionDeletionsRef.current.has(question.id));

  // Stable, memoized exam ID list — prevents the question-counts query key from
  // changing on every render (which would trigger spurious refetches)
  const examIds = useMemo(() => exams.map((exam: Exam) => exam.id), [exams]);

  // Fetch question counts for all exams
  const { data: questionCounts = {} } = useQuery<Record<number, number>>({
    queryKey: ['/api/exams/question-counts', examIds],
    enabled: examIds.length > 0,
    queryFn: async () => {
      const examIds = exams.map((exam: Exam) => exam.id);
      if (examIds.length === 0) return {};

      const queryString = examIds.map((id: number) => `examIds=${id}`).join('&');
      const response = await apiRequest('GET', `/api/exams/question-counts?${queryString}`);
      if (!response.ok) throw new Error('Failed to fetch question counts');
      return response.json();
    },
  });

  // Optimistically bump a single exam's question-count badge in every cached
  // copy of the question-counts map (the cache key includes the exam-id list,
  // so multiple variants of the query can be cached at once). This is what
  // makes the "X questions" badge on each exam card/row update the instant a
  // question is added/deleted, instead of waiting for the background
  // invalidation + refetch below to complete. Negative deltas are clamped at 0.
  const adjustQuestionCountCache = useCallback((examId: number | undefined, delta: number) => {
    if (!examId || !delta) return;
    queryClient.setQueriesData<Record<number, number>>(
      { queryKey: ['/api/exams/question-counts'], exact: false },
      (old) => {
        if (!old) return old;
        const current = old[examId] ?? 0;
        return { ...old, [examId]: Math.max(0, current + delta) };
      }
    );
  }, []);

  return { examQuestions, loadingQuestions, previewQuestions, loadingPreviewQuestions, questionCounts, adjustQuestionCountCache };
}
