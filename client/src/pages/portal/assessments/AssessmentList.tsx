import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Clipboard } from 'lucide-react';
import type { Exam } from '@shared/schema';
import { EmptyState } from '@/components/shared';
import { AssessmentCard } from './AssessmentCard';
import { AssessmentRow } from './AssessmentRow';

export interface AssessmentListProps {
  exams: Exam[];
  isLoading: boolean;
  searchTerm: string;
  questionCounts: Record<number, number>;
  togglingExamId: number | null;
  deletingExamIds: Set<number>;
  onManageQuestions: (exam: Exam) => void;
  onTogglePublish: (exam: Exam) => void;
  onPreview: (exam: Exam) => void;
  onEditSettings: (exam: Exam) => void;
  onRequestDelete: (exam: Exam) => void;
  onClearSearch: () => void;
  onCreateFirst: () => void;
  getClassNameById: (classId: number) => string;
  getSubjectNameById: (subjectId: number) => string;
}

/**
 * AssessmentList — loops through assessment data and renders it as either
 * mobile cards or a desktop table, depending on viewport. Pure rendering:
 * all data fetching and mutation logic lives in the parent (AssessmentPage).
 */
export function AssessmentList({
  exams,
  isLoading,
  searchTerm,
  questionCounts,
  togglingExamId,
  deletingExamIds,
  onManageQuestions,
  onTogglePublish,
  onPreview,
  onEditSettings,
  onRequestDelete,
  onClearSearch,
  onCreateFirst,
  getClassNameById,
  getSubjectNameById,
}: AssessmentListProps) {
  const emptyState = (
    <EmptyState
      title={searchTerm ? 'No assessments match your search' : 'No assessments created yet'}
      description={
        searchTerm
          ? `We couldn't find any assessments matching "${searchTerm}". Try a different search term.`
          : 'Create your first assessment to get started. Choose Academic to link to report cards, or Standalone for mock exams, competitions, and more.'
      }
      icon={Clipboard}
      action={
        searchTerm
          ? { label: 'Clear Search', onClick: onClearSearch }
          : { label: 'Create Your First Assessment', onClick: onCreateFirst }
      }
    />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assessments</CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        {isLoading ? (
          <div className="text-center py-8">Loading exams...</div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="sm:hidden space-y-3">
              {exams.map((exam) => (
                <AssessmentCard
                  key={exam.id}
                  exam={exam}
                  questionCount={questionCounts[exam.id] || 0}
                  isPublishToggling={togglingExamId === exam.id}
                  isDeleting={deletingExamIds.has(exam.id)}
                  onManageQuestions={onManageQuestions}
                  onTogglePublish={onTogglePublish}
                  onPreview={onPreview}
                  onEditSettings={onEditSettings}
                  onRequestDelete={onRequestDelete}
                  getClassNameById={getClassNameById}
                  getSubjectNameById={getSubjectNameById}
                />
              ))}
              {exams.length === 0 && emptyState}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Class / Target</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Questions</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exams.map((exam) => (
                    <AssessmentRow
                      key={exam.id}
                      exam={exam}
                      questionCount={questionCounts[exam.id] || 0}
                      isPublishToggling={togglingExamId === exam.id}
                      isDeleting={deletingExamIds.has(exam.id)}
                      onManageQuestions={onManageQuestions}
                      onTogglePublish={onTogglePublish}
                      onPreview={onPreview}
                      onEditSettings={onEditSettings}
                      onRequestDelete={onRequestDelete}
                      getClassNameById={getClassNameById}
                      getSubjectNameById={getSubjectNameById}
                    />
                  ))}
                  {exams.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        No assessments found. Create your first assessment to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
