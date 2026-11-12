import { useState } from 'react';
import { queryClient } from '@/lib/queryClient';
import { EmptyState, PageHeader } from '@/components/shared';
import ExamQuestionAdder from '../ExamQuestionAdder';
import { AssessmentList } from '../assessments/AssessmentList';
import { DeleteAssessmentDialog } from '../assessments/DeleteAssessmentDialog';
import { BookOpen, Clipboard } from 'lucide-react';
import type { Exam } from '@shared/schema';
import { useExamManager } from './useExamManager';
import { ExamWizardDialog } from './ExamWizardDialog';
import { Toolbar } from './Toolbar';
import { QuestionModal } from './QuestionModal';
import { PreviewDialog } from './PreviewDialog';

/** Assessment Management — split from a 2,937-line monolith; see folder modules. */
export default function ExamManagement() {
  const m = useExamManager();
  const { user, setIsExamDialogOpen, isQuestionAdderOpen, setIsQuestionAdderOpen, searchTerm, setSearchTerm, selectedExam, setSelectedExam, setPreviewExam, deletingExam, setDeletingExam, deletingExamIds, togglingExams, exams, loadingExams, questionCounts, togglePublishMutation, deleteExamMutation, handleEditExam, filteredExams, getClassNameById, getSubjectNameById } = m;

  if (!user) {
    return <div>Please log in to access the exam management portal.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessment Management"
        description="Create and manage academic and standalone assessments"
        icon={Clipboard}
        actions={<ExamWizardDialog m={m} />}
      />

      <Toolbar m={m} />

            {/* Assessments Table/Cards */}
      <AssessmentList
        exams={filteredExams}
        isLoading={loadingExams}
        searchTerm={searchTerm}
        questionCounts={questionCounts}
        togglingExams={togglingExams}
        deletingExamIds={deletingExamIds}
        onManageQuestions={(exam) => setSelectedExam(exam)}
        onTogglePublish={(exam) => togglePublishMutation.mutate({ examId: exam.id, isPublished: !exam.isPublished })}
        onPreview={(exam) => setPreviewExam(exam)}
        onEditSettings={(exam) => handleEditExam(exam)}
        onRequestDelete={(exam) => setDeletingExam(exam)}
        onClearSearch={() => setSearchTerm('')}
        onCreateFirst={() => setIsExamDialogOpen(true)}
        getClassNameById={getClassNameById}
        getSubjectNameById={getSubjectNameById}
      />

            {/* Empty state guidance when no exam is selected */}
      {!selectedExam && (
        <EmptyState
          icon={BookOpen}
          title="Select an Exam to Manage Questions"
          description="To add questions or upload CSV files, please select an exam from the list above by clicking the Manage Questions button."
          className="mt-6 bg-card rounded-lg border border-border"
        />
      )}

            {/* 3-Way Question Adder Dialog */}
            {selectedExam && (
              <ExamQuestionAdder
                open={isQuestionAdderOpen}
                onOpenChange={setIsQuestionAdderOpen}
                examId={selectedExam.id}
                examClassId={selectedExam.classId ?? undefined}
                examSubjectId={selectedExam.subjectId ?? undefined}
                onQuestionsAdded={() => {
                  queryClient.invalidateQueries({ queryKey: ['/api/exam-questions', selectedExam.id] });
                  queryClient.invalidateQueries({ queryKey: ['/api/exams/question-counts'] });
                }}
              />
            )}

            {/* Delete Exam Confirmation Modal — shared by both the mobile card and
                desktop table actions menu (see AssessmentActionsMenu). The mutation
                only fires on confirm, and the item only leaves the list once the
                backend responds with success (see deleteExamMutation above). */}
            <DeleteAssessmentDialog
              exam={deletingExam}
              isDeleting={deletingExam ? deletingExamIds.has(deletingExam.id) : false}
              onCancel={() => setDeletingExam(null)}
              onConfirm={(exam) => {
                setDeletingExam(null);
                if (!deletingExamIds.has(exam.id)) {
                  deleteExamMutation.mutate(exam.id);
                }
              }}
            />
    </div>
  );
}
