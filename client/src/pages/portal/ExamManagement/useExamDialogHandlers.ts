import { FileText, Settings, Check, Calendar } from 'lucide-react';
import type { Exam, Class, Subject } from '@shared/schema.pg';
import type { ExamForm } from './schemas';
import { toast } from '@/hooks/use-toast';

/** Auto-split from ExamManagement.tsx — see git history for original context. */
export function useExamDialogHandlers({ editingExam, setEditingExam, setIsExamDialogOpen, resetExam, setExamValue, setCurrentStep, currentStep, isStandalone, triggerExam, createExamMutation, updateExamMutation }: { editingExam: any; setEditingExam: any; setIsExamDialogOpen: any; resetExam: any; setExamValue: any; setCurrentStep: any; currentStep: any; isStandalone: any; triggerExam: any; createExamMutation: any; updateExamMutation: any }) {
    const onSubmitExam = (data: ExamForm) => {
    if (editingExam) {
      const examData = {
        ...data,
        teacherInChargeId: data.teacherInChargeId || null,
      };
      updateExamMutation.mutate({ examId: editingExam.id, examData });
    } else {
      createExamMutation.mutate(data);
    }
  };

  // Function to open edit dialog with exam data
  const handleEditExam = (exam: Exam) => {
    setEditingExam(exam);

    // Format date for the input field (YYYY-MM-DD format)
    const formatDate = (dateValue: string | Date | null | undefined): string => {
      if (!dateValue) return '';
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    };

    // Format datetime-local for input fields (returns string for HTML input)
    const formatDateTime = (dateValue: string | Date | null | undefined): string => {
      if (!dateValue) return '';
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return '';
      return date.toISOString().slice(0, 16);
    };

    // Parse date to Date object for schema validation
    const parseToDate = (dateValue: string | Date | null | undefined): Date | undefined => {
      if (!dateValue) return undefined;
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return undefined;
      return date;
    };

    // Populate form with exam data
    resetExam({
      assessmentCategory: (exam as any).assessmentCategory || 'academic',
      name: exam.name || '',
      date: formatDate(exam.date),
      classId: exam.classId ?? undefined,
      subjectId: exam.subjectId ?? undefined,
      termId: exam.termId || undefined,
      examType: (exam.examType as 'test' | 'exam') || 'exam',
      teacherInChargeId: exam.teacherInChargeId && exam.teacherInChargeId !== exam.createdBy
        ? exam.teacherInChargeId
        : undefined,
      instructions: exam.instructions || '',
      timerMode: (exam.timerMode as 'individual' | 'global') || 'individual',
      timeLimit: exam.timeLimit || 60,
      totalMarks: exam.totalMarks || 100,
      startTime: parseToDate(exam.startTime),
      endTime: parseToDate(exam.endTime),
      isPublished: exam.isPublished || false,
      shuffleQuestions: exam.shuffleQuestions || false,
      autoGradingEnabled: exam.autoGradingEnabled !== false,
      showCorrectAnswers: exam.showCorrectAnswers ?? true,
      passingScore: exam.passingScore || 60,
      gradingScale: exam.gradingScale || 'active',
      purpose: (exam as any).purpose || undefined,
      venue: (exam as any).venue || undefined,
      targetType: (exam as any).targetType || undefined,
      registrationFee: (exam as any).registrationFee ?? undefined,
      registrationOpen: (exam as any).registrationOpen || false,
      registrationDeadline: (exam as any).registrationDeadline || undefined,
      candidateType: (exam as any).candidateType || undefined,
      generateAdmitCards: (exam as any).generateAdmitCards || false,
      generateCandidateNumbers: (exam as any).generateCandidateNumbers || false,
      certificateEnabled: (exam as any).certificateEnabled || false,
      leaderboardEnabled: (exam as any).leaderboardEnabled || false,
    });

    setCurrentStep(1);
    setIsExamDialogOpen(true);
  };

  // Handle dialog close to reset editingExam state
  const handleExamDialogClose = (open: boolean) => {
    setIsExamDialogOpen(open);
    if (!open) {
      setEditingExam(null);
      resetExam();
      setCurrentStep(1);
    }
  };

  const EXAM_STEPS = [
    { id: 1, title: 'Assessment Details', icon: FileText },
    { id: 2, title: isStandalone ? 'Configuration' : 'Academic & Timing', icon: Calendar },
    { id: 3, title: 'Options & Grading', icon: Settings },
    { id: 4, title: 'Review & Create', icon: Check },
  ];

  const handleNext = async () => {
    let fieldsToValidate: (keyof ExamForm)[] = [];
    if (currentStep === 3) {
      setCurrentStep(4);
      return;
    }
    if (currentStep === 1) {
      fieldsToValidate = ['name', 'date', 'examType'];
      if (!isStandalone) fieldsToValidate.push('classId', 'subjectId');
    }
    if (currentStep === 2) {
      fieldsToValidate = ['totalMarks', 'timeLimit'];
      if (!isStandalone) fieldsToValidate.push('termId');
    }
    const valid = await triggerExam(fieldsToValidate);
    if (valid) setCurrentStep((s: number) => s + 1);
  };

  const onInvalidExam = (errors: any) => {
    const errorFields = Object.keys(errors);
    const friendlyFieldNames = {
      classId: 'Class',
      subjectId: 'Subject',
      termId: 'Academic Term',
      totalMarks: 'Total Marks',
      date: 'Exam Date',
      name: 'Exam Name'
    };
    const errorMessages = errorFields.map(field => {
      const friendlyName = friendlyFieldNames[field as keyof typeof friendlyFieldNames] || field;
      return `${friendlyName}: ${errors[field].message}`;
    }).join(', ');
    toast({
      title: "Please Fix Required Fields",
      description: errorMessages || "Please check all required fields and try again",
      variant: "destructive",
    });
  };

  return { onSubmitExam, handleEditExam, handleExamDialogClose, EXAM_STEPS, handleNext, onInvalidExam };
}
