import { z } from 'zod';
import { insertExamSchema, insertExamQuestionSchema } from '@shared/schema.pg';

// Form schemas - Use the shared insertExamSchema which has proper preprocessing
export const examFormSchema = insertExamSchema.omit({ 
  createdBy: true,
  allowRetakes: true,
  shuffleOptions: true,
  enableProctoring: true,
  lockdownMode: true,
  requireWebcam: true,
  requireFullscreen: true,
  maxTabSwitches: true
});

export const questionFormSchema = insertExamQuestionSchema
  .omit({ examId: true, orderNumber: true }) // These are added later in onSubmitQuestion
  .extend({
    // Handle NaN values from frontend forms with valueAsNumber: true
    points: z.preprocess((val: any) => {
      if (val === '' || val === null || val === undefined || Number.isNaN(val)) return 1;
      return val;
    }, z.coerce.number().int().min(1, "Points must be at least 1").default(1)),

    // Enhanced fields for theory questions
    instructions: z.string().optional(),
    sampleAnswer: z.string().optional(),

    options: z.array(z.object({
      optionText: z.string().min(1, 'Option text is required'),
      isCorrect: z.boolean(),
      // Enhanced option fields
      partialCreditValue: z.preprocess((val: any) => {
        if (val === '' || val === null || val === undefined || Number.isNaN(val)) return 0;
        return val;
      }, z.coerce.number().min(0).default(0)).optional(),
      explanationText: z.string().optional(),
    })).optional(),
  }).refine((data) => {
    if (data.questionType === 'multiple_choice') {
      if (!data.options || data.options.length < 2) {
        return false;
      }
      const nonEmptyOptions = data.options.filter(opt => opt.optionText.trim() !== '');
      if (nonEmptyOptions.length < 2) {
        return false;
      }
      const hasCorrectAnswer = nonEmptyOptions.some(opt => opt.isCorrect);
      return hasCorrectAnswer;
    }
    // Enhanced validation for theory questions
    if (data.questionType === 'essay' && data.questionText && data.questionText.length < 20) {
      return false;
    }
    return true;
  }, {
    message: "Multiple choice questions require at least 2 non-empty options with one marked as correct. Essay questions need detailed question text (20+ characters).",
    path: ["options"]
  });

export type ExamForm = z.infer<typeof examFormSchema>;
export type QuestionForm = z.infer<typeof questionFormSchema>;
