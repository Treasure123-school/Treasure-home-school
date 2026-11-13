import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import type { ExamManager } from './useExamManager';
import { QuestionFormDialog } from './QuestionFormDialog';
import { QuestionsList } from './QuestionsList';

/** Manage-questions modal shell. */
export function QuestionModal({ m }: { m: ExamManager }) {
  const { setIsQuestionAdderOpen, selectedExam, setSelectedExam, examQuestions } = m;
  return (
    <>
      {/* Question Management Modal */}
      {selectedExam && (
        <Dialog open={!!selectedExam} onOpenChange={(open) => { if (!open) setSelectedExam(null); }}>
          <DialogContent aria-describedby={undefined} className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Questions - {selectedExam.name}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div className="text-sm text-muted-foreground">
                  {examQuestions.length} questions • {selectedExam.totalMarks} total marks
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  {/* 3-Way Question Adder button */}
                  <Button
                    variant="default"
                    onClick={() => setIsQuestionAdderOpen(true)}
                    data-testid="button-add-questions"
                    className="w-full sm:w-auto"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Questions
                  </Button>
                  <QuestionFormDialog m={m} />
                </div>
              </div>              <QuestionsList m={m} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
