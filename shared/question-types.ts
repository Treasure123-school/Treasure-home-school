/**
 * Canonical question type definitions — single source of truth.
 * Both frontend and backend import from here.
 *
 * Only TWO question types are supported:
 *   - multiple_choice  (Objective / MCQ)
 *   - essay            (Theory / long-form)
 */

export const QUESTION_TYPE_VALUES = ['multiple_choice', 'essay'] as const;

export type QuestionType = typeof QUESTION_TYPE_VALUES[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Multiple Choice',
  essay:           'Essay',
};

/** UI list for dropdowns — [{value, label}] */
export const QUESTION_TYPE_OPTS = QUESTION_TYPE_VALUES.map((v) => ({
  value: v,
  label: QUESTION_TYPE_LABELS[v],
}));

/** Human-readable display (with fallback for legacy data) */
export function questionTypeLabel(type: string): string {
  return QUESTION_TYPE_LABELS[type as QuestionType] ?? type.replace(/_/g, ' ');
}

/** Returns true when the value is a valid supported type */
export function isValidQuestionType(type: string): type is QuestionType {
  return (QUESTION_TYPE_VALUES as readonly string[]).includes(type);
}
