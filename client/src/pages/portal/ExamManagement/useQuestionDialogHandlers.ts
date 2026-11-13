import { Check } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import type { Exam, ExamQuestion } from '@shared/schema.pg';
import type { QuestionForm } from './schemas';
import { toast } from '@/hooks/use-toast';

/** Auto-split from ExamManagement.tsx — see git history for original context. */
export function useQuestionDialogHandlers({ selectedExam, examQuestions, editingQuestion, setEditingQuestion, setEditingImageUrl, options, editingImageUrl, setIsQuestionDialogOpen, resetQuestion, watchQuestion, setQuestionValue, createQuestionMutation, updateQuestionMutation }: { selectedExam: any; examQuestions: any; editingQuestion: any; setEditingQuestion: any; setEditingImageUrl: any; options: any; editingImageUrl: any; setIsQuestionDialogOpen: any; resetQuestion: any; watchQuestion: any; setQuestionValue: any; createQuestionMutation: any; updateQuestionMutation: any }) {
    // Function to open edit dialog with question data
  const handleEditQuestion = async (question: ExamQuestion) => {
    setEditingQuestion(question);

    // Fetch options if it's a multiple choice question
    let questionOptions: any[] = [];
    if (question.questionType === 'multiple_choice') {
      try {
        const response = await apiRequest('GET', `/api/question-options/${question.id}`);
        if (response.ok) {
          questionOptions = await response.json();
        }
      } catch (error) {
        console.error('Failed to fetch question options:', error);
      }
    }

    // Populate form with question data
    resetQuestion({
      questionText: question.questionText || '',
      questionType: question.questionType as any || 'multiple_choice',
      points: question.points || 1,
      instructions: (question as any).instructions || '',
      sampleAnswer: (question as any).sampleAnswer || '',
      options: questionOptions.length > 0
        ? questionOptions.map((opt: any) => ({
          optionText: opt.optionText || '',
          isCorrect: opt.isCorrect || false,
        }))
        : [
          { optionText: '', isCorrect: false },
          { optionText: '', isCorrect: false },
          { optionText: '', isCorrect: false },
          { optionText: '', isCorrect: false },
        ],
    });

    setEditingImageUrl((question as any).imageUrl || null);
    setIsQuestionDialogOpen(true);
  };

    const onInvalidQuestion = (errors: any) => {
    const errorFields = Object.keys(errors);
    const errorMessages = errorFields.map(field => `${field}: ${errors[field].message}`).join(', ');
    toast({
      title: "Question Validation Error",
      description: errorMessages || "Please check all required fields",
      variant: "destructive",
    });
  };

  const onSubmitQuestion = (data: QuestionForm) => {

    if (!selectedExam) {
      toast({
        title: "No Exam Selected",
        description: "Please select an exam before adding questions",
        variant: "destructive",
      });
      return;
    }
    // Enhanced validation for question text
    if (!data.questionText || data.questionText.trim().length < 5) {
      toast({
        title: "Invalid Question",
        description: "Question text must be at least 5 characters long",
        variant: "destructive",
      });
      return;
    }

    // Prepare the question data
    const questionData: any = {
      ...data,
      questionText: data.questionText.trim(),
      points: data.points || 1,
      imageUrl: editingImageUrl || null,
    };

    // For multiple choice questions, filter out empty options and validate
    if (data.questionType === 'multiple_choice' && data.options) {
      const validOptions = data.options
        .filter((option: any) => option.optionText && option.optionText.trim() !== '')
        .map((option: any, index: any) => ({
          optionText: option.optionText.trim(),
          isCorrect: option.isCorrect
          // orderNumber is automatically set by the backend
        }));

      // Validate multiple choice requirements
      if (validOptions.length < 2) {
        toast({
          title: "Invalid Options",
          description: "Multiple choice questions require at least 2 non-empty options",
          variant: "destructive",
        });
        return;
      }
      const hasCorrectAnswer = validOptions.some((opt: any) => opt.isCorrect);
      if (!hasCorrectAnswer) {
        toast({
          title: "No Correct Answer",
          description: "Please mark at least one option as correct",
          variant: "destructive",
        });
        return;
      }
      questionData.options = validOptions;
    } else {
      // For non-multiple choice questions, don't send options
      delete questionData.options;
    }

    // Check if we're editing or creating
    if (editingQuestion) {
      updateQuestionMutation.mutate({
        questionId: editingQuestion.id,
        questionData,
      });
    } else {
      const nextOrderNumber = examQuestions.length + 1;
      createQuestionMutation.mutate({
        ...questionData,
        examId: selectedExam.id,
        orderNumber: nextOrderNumber,
      });
    }
  };

  const addOption = () => {
    const currentOptions = options || [];
    setQuestionValue('options', [...currentOptions, { optionText: '', isCorrect: false }]);
  };

  const removeOption = (index: number) => {
    const currentOptions = options || [];
    const newOptions = currentOptions.filter((_: any, i: any) => i !== index);
    setQuestionValue('options', newOptions);
  };

  const updateOption = (index: number, field: 'optionText' | 'isCorrect', value: string | boolean) => {
    const currentOptions = options || [];
    const newOptions = [...currentOptions];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setQuestionValue('options', newOptions);
  };

  return { handleEditQuestion, onInvalidQuestion, onSubmitQuestion, addOption, removeOption, updateOption };
}
