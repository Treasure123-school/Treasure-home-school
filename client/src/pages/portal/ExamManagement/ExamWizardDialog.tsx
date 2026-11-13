import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import type { Exam } from '@shared/schema.pg';
import type { ExamManager } from './useExamManager';
import { StepDetails } from './wizard/StepDetails';
import { StepTiming } from './wizard/StepTiming';
import { StepOptions } from './wizard/StepOptions';
import { StepReview } from './wizard/StepReview';

/** 4-step create/edit assessment wizard (trigger + steps + navigation). */
export function ExamWizardDialog({ m }: { m: ExamManager }) {
  const { isExamDialogOpen, editingExam, setEditingExam, currentStep, setCurrentStep, handleExamSubmit, resetExam, createExamMutation, updateExamMutation, onSubmitExam, handleExamDialogClose, EXAM_STEPS, handleNext, onInvalidExam } = m;
  return (
    <>
          <Dialog open={isExamDialogOpen} onOpenChange={handleExamDialogClose}>
            <DialogTrigger asChild>
              <Button
                data-testid="button-create-exam"
                className="w-full sm:w-auto"
                onClick={() => {
                  // Always start a fresh wizard when creating (not editing) a new assessment
                  setEditingExam(null);
                  resetExam();
                  setCurrentStep(1);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Assessment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingExam ? 'Edit Assessment' : 'Create New Assessment'}</DialogTitle>
              </DialogHeader>

              {/* Step Indicator */}
              <div className="flex items-center gap-0 mb-1">
                {EXAM_STEPS.map((step, i) => (
                  <div key={step.id} className={`flex items-center ${i < EXAM_STEPS.length - 1 ? 'flex-1' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors flex-shrink-0 ${
                      currentStep > step.id ? 'bg-primary border-primary text-primary-foreground' :
                      currentStep === step.id ? 'border-primary text-primary' :
                      'border-muted-foreground/30 text-muted-foreground'
                    }`}>
                      {currentStep > step.id ? <Check className="h-3 w-3" /> : step.id}
                    </div>
                    {i < EXAM_STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 ${currentStep > step.id ? 'bg-primary' : 'bg-muted-foreground/20'}`} />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs font-medium text-primary mb-3">{EXAM_STEPS[currentStep - 1].title}</p>

              <div className="space-y-4">

                {/* ── Step 1: Assessment Details ── */}
                {currentStep === 1 && <StepDetails m={m} />}
                {currentStep === 2 && <StepTiming m={m} />}
                {currentStep === 3 && <StepOptions m={m} />}
                {currentStep === 4 && <StepReview m={m} />}
              {/* Navigation */}
              <div className="flex justify-between pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => currentStep > 1 ? setCurrentStep(s => s - 1) : handleExamDialogClose(false)}>
                  {currentStep === 1 ? 'Cancel' : <><ChevronLeft className="w-4 h-4 mr-1" />Previous</>}
                </Button>
                {currentStep < 4 ? (
                  <Button type="button" onClick={handleNext}>
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button type="button"
                    onClick={() => handleExamSubmit(onSubmitExam, onInvalidExam)()}
                    disabled={editingExam ? updateExamMutation.isPending : createExamMutation.isPending}
                    data-testid="button-submit-exam">
                    {editingExam
                      ? (updateExamMutation.isPending ? 'Updating...' : 'Update Exam')
                      : (createExamMutation.isPending ? 'Creating...' : 'Create Exam')}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
    </>
  );
}
