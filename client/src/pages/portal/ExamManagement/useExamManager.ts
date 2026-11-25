import { useMemo, useCallback } from 'react';
import type { Exam } from '@shared/schema.pg';
import { useExamState } from './useExamState';
import { useExamQueries } from './useExamQueries';
import { useExamRealtime } from './useExamRealtime';
import { useExamMutations } from './useExamMutations';
import { useQuestionQueries } from './useQuestionQueries';
import { useDeleteQuestionMutation } from './useDeleteQuestionMutation';
import { useCreateQuestionMutation } from './useCreateQuestionMutation';
import { useUpdateQuestionMutation } from './useUpdateQuestionMutation';
import { useExamDialogHandlers } from './useExamDialogHandlers';
import { useQuestionDialogHandlers } from './useQuestionDialogHandlers';
import { useBulkCsv } from './useBulkCsv';
import { downloadCSVTemplate } from './csvTemplate';

/** Composes all exam-management state, queries, mutations and handlers. */
export function useExamManager() {
  const S = useExamState();
  const {
    user, selectedExam, setSelectedExam, editingExam, setEditingExam, editingQuestion, setEditingQuestion,
    pendingDeletionsRef, pendingQuestionDeletionsRef, togglingExamsRef, setExamToggling,
    watchExam, setExamValue, resetExam, resetQuestion, watchQuestion, setQuestionValue,
    isExamDialogOpen, isQuestionAdderOpen, setIsQuestionAdderOpen, deletingExam, setDeletingExam,
    deletingExamIds, setDeletingExamIds, questionToDelete, setQuestionToDelete, currentStep, setCurrentStep,
    editingImageUrl, setEditingImageUrl, previewExam, isStandalone,
    registerExam, handleExamSubmit, examErrors, examControl, triggerExam,
    registerQuestion, handleQuestionSubmit, questionErrors, questionControl, triggerQuestion,
    watchTimerMode, questionType, options,
  } = S;

  const Q = useExamQueries({ watchExam, setExamValue, isExamDialogOpen, editingExam });
  const { exams, loadingExams, classes, classesLoading, subjects, subjectsLoading, allClasses, allSubjects,
    selectedClassId, teachers, loadingTeachers, availableGradingScales, activeGradingScaleName, currentTerm, terms } = Q;

  // Realtime socket sync for exams + exam_questions (side-effect only)
  useExamRealtime({
    selectedExam, setSelectedExam, setEditingExam, editingQuestion, setEditingQuestion,
    pendingDeletionsRef, pendingQuestionDeletionsRef, togglingExamsRef, setExamToggling,
  });

  const { createExamMutation, updateExamMutation, togglePublishMutation, deleteExamMutation } = useExamMutations({
    setIsExamDialogOpen: S.setIsExamDialogOpen, setEditingExam, resetExam, setCurrentStep,
    setDeletingExamIds, pendingDeletionsRef, selectedExam, setSelectedExam, setEditingQuestion,
    togglingExamsRef, setExamToggling,
  });

  const QQ = useQuestionQueries({ selectedExam, previewExam, pendingQuestionDeletionsRef, exams });
  const { examQuestions, loadingQuestions, previewQuestions, loadingPreviewQuestions, questionCounts, adjustQuestionCountCache } = QQ;

  const { deleteQuestionMutation, handleConfirmDeleteQuestion } = useDeleteQuestionMutation({
    selectedExam, editingQuestion, setEditingQuestion, pendingQuestionDeletionsRef, adjustQuestionCountCache, setQuestionToDelete,
  });

  const { createQuestionMutation } = useCreateQuestionMutation({
    setIsQuestionDialogOpen: S.setIsQuestionDialogOpen, setEditingImageUrl, resetQuestion, adjustQuestionCountCache,
  });

  const { updateQuestionMutation } = useUpdateQuestionMutation({
    selectedExam, setEditingQuestion: S.setEditingQuestion, setEditingImageUrl, resetQuestion, setIsQuestionDialogOpen: S.setIsQuestionDialogOpen,
  });

  const EH = useExamDialogHandlers({
    editingExam, setEditingExam, setIsExamDialogOpen: S.setIsExamDialogOpen, resetExam, setExamValue,
    setCurrentStep, currentStep, isStandalone, triggerExam, createExamMutation, updateExamMutation,
  });
  const { onSubmitExam, handleEditExam, handleExamDialogClose, EXAM_STEPS, handleNext, onInvalidExam } = EH;

  const QH = useQuestionDialogHandlers({
    selectedExam, examQuestions, editingQuestion, setEditingQuestion, setEditingImageUrl, options, editingImageUrl,
    setIsQuestionDialogOpen: S.setIsQuestionDialogOpen, resetQuestion, watchQuestion, setQuestionValue,
    createQuestionMutation, updateQuestionMutation,
  });
  const { handleEditQuestion, onInvalidQuestion, onSubmitQuestion, addOption, removeOption, updateOption } = QH;

  const CSV = useBulkCsv({ selectedExam, adjustQuestionCountCache });
  const { csvUploadMutation, handleCSVUpload } = CSV;

  // ── Filtering / sorting / display helpers (verbatim from original) ──
  const filteredExams = useMemo(() => {
    const filtered = exams.filter((exam: Exam) => {
      if (S.searchTerm && !exam.name.toLowerCase().includes(S.searchTerm.toLowerCase())) return false;
      if (S.classFilter !== 'all' && String(exam.classId ?? '') !== S.classFilter) return false;
      if (S.termFilter !== 'all' && String(exam.termId ?? '') !== S.termFilter) return false;
      if (S.categoryFilter !== 'all' && exam.assessmentCategory !== S.categoryFilter) return false;
      if (S.statusFilter === 'published' && !exam.isPublished) return false;
      if (S.statusFilter === 'draft' && exam.isPublished) return false;
      return true;
    });

    const sorted = [...filtered].sort((a: Exam, b: Exam) => {
      switch (S.sortBy) {
        case 'name-asc': return a.name.localeCompare(b.name);
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'date-asc': return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'date-desc': return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'duration-asc': return (a.timeLimit ?? 0) - (b.timeLimit ?? 0);
        case 'duration-desc': return (b.timeLimit ?? 0) - (a.timeLimit ?? 0);
        default: return 0;
      }
    });

    return sorted;
  }, [exams, S.searchTerm, S.classFilter, S.termFilter, S.categoryFilter, S.statusFilter, S.sortBy]);

  const hasActiveFilters = S.classFilter !== 'all' || S.termFilter !== 'all' || S.categoryFilter !== 'all' || S.statusFilter !== 'all';

  const clearAllFilters = () => {
    S.setClassFilter('all'); S.setTermFilter('all'); S.setCategoryFilter('all'); S.setStatusFilter('all'); S.setSortBy('date-desc');
  };

  const getClassNameById = useCallback((classId: number) => {
    const classItem = allClasses.find((c: any) => c.id === classId);
    return classItem?.name || 'Unknown Class';
  }, [allClasses]);

  const getSubjectNameById = useCallback((subjectId: number) => {
    const subject = allSubjects.find((s: any) => s.id === subjectId);
    return subject?.name || 'Unknown Subject';
  }, [allSubjects]);

  return {
    user,
    isExamDialogOpen: S.isExamDialogOpen, setIsExamDialogOpen: S.setIsExamDialogOpen,
    isQuestionDialogOpen: S.isQuestionDialogOpen, setIsQuestionDialogOpen: S.setIsQuestionDialogOpen,
    isQuestionAdderOpen, setIsQuestionAdderOpen,
    searchTerm: S.searchTerm, setSearchTerm: S.setSearchTerm,
    classFilter: S.classFilter, setClassFilter: S.setClassFilter,
    termFilter: S.termFilter, setTermFilter: S.setTermFilter,
    categoryFilter: S.categoryFilter, setCategoryFilter: S.setCategoryFilter,
    statusFilter: S.statusFilter, setStatusFilter: S.setStatusFilter,
    sortBy: S.sortBy, setSortBy: S.setSortBy,
    selectedExam, setSelectedExam, editingExam, setEditingExam, editingQuestion, setEditingQuestion,
    editingImageUrl, setEditingImageUrl, previewExam, setPreviewExam: S.setPreviewExam,
    deletingExam, setDeletingExam, deletingExamIds, setDeletingExamIds, questionToDelete, setQuestionToDelete,
    currentStep, setCurrentStep, togglingExams: S.togglingExams,
    watchTimerMode, questionType, options, selectedClassId,
    watchDuration: S.watchDuration, watchGlobalStartTime: S.watchGlobalStartTime,
    watchAssessmentCategory: S.watchAssessmentCategory, isStandalone,
    registerExam, handleExamSubmit, examErrors, examControl, setExamValue, resetExam, watchExam, triggerExam,
    registerQuestion, handleQuestionSubmit, questionErrors, questionControl, setQuestionValue, resetQuestion, watchQuestion, triggerQuestion,
    exams, loadingExams, classes, classesLoading, subjects, subjectsLoading, allClasses, allSubjects,
    teachers, loadingTeachers, availableGradingScales, activeGradingScaleName, currentTerm, terms,
    examQuestions, loadingQuestions, previewQuestions, loadingPreviewQuestions, questionCounts,
    createExamMutation, updateExamMutation, togglePublishMutation, deleteExamMutation,
    deleteQuestionMutation, createQuestionMutation, updateQuestionMutation,
    csvUploadMutation, downloadCSVTemplate, handleCSVUpload,
    handleConfirmDeleteQuestion, handleEditQuestion, onSubmitExam, handleEditExam, handleExamDialogClose,
    EXAM_STEPS, handleNext, onInvalidExam, onInvalidQuestion, onSubmitQuestion, addOption, removeOption, updateOption,
    filteredExams, hasActiveFilters, clearAllFilters, getClassNameById, getSubjectNameById,
  };
}

export type ExamManager = ReturnType<typeof useExamManager>;
