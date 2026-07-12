/**
 * ManualQuestionFields — shared question form fields used by both
 * the Exam "Add Questions" modal (Manual tab) and the Question Bank
 * "Add / Edit Question" dialog.
 *
 * Handles: question text, type, points, instructions, image upload,
 * MCQ options (single correct answer via radio), essay sample answer.
 *
 * Bank-specific fields (bankId, difficulty, topic, etc.) are left
 * to the parent dialog.
 *
 * Option text uses a contentEditable div instead of <input type="text">
 * so that mobile browsers (Chrome/Kiwi) never render their native focus ring.
 */

import { useRef, useEffect } from "react";
import { Textarea }   from "@/components/ui/textarea";
import { Input }      from "@/components/ui/input";
import { Label }      from "@/components/ui/label";
import { Button }     from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { QuestionImageUpload } from "@/components/question/QuestionImageUpload";
import { Plus, Trash2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuestionOption {
  optionText: string;
  isCorrect:  boolean;
}

export const DEFAULT_OPTIONS: QuestionOption[] = [
  { optionText: "", isCorrect: false },
  { optionText: "", isCorrect: false },
  { optionText: "", isCorrect: false },
  { optionText: "", isCorrect: false },
];

export const QUESTION_TYPE_OPTS = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "essay",           label: "Essay" },
] as const;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ManualQuestionFieldsProps {
  questionText:          string;
  onQuestionTextChange:  (v: string) => void;
  questionType:          string;
  onQuestionTypeChange:  (v: string) => void;
  points:                string | number;
  onPointsChange:        (v: string | number) => void;
  instructions:          string;
  onInstructionsChange:  (v: string) => void;
  imageUrl:              string | null;
  onImageUrlChange:      (v: string | null) => void;

  options:               QuestionOption[];
  onOptionsChange:       (opts: QuestionOption[]) => void;

  sampleAnswer?:         string;
  onSampleAnswerChange?: (v: string) => void;
  showSampleAnswer?:     boolean;

  disabled?:             boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ManualQuestionFields({
  questionText,  onQuestionTextChange,
  questionType,  onQuestionTypeChange,
  points,        onPointsChange,
  instructions,  onInstructionsChange,
  imageUrl,      onImageUrlChange,
  options,       onOptionsChange,
  sampleAnswer,  onSampleAnswerChange,
  showSampleAnswer = false,
  disabled = false,
}: ManualQuestionFieldsProps) {
  const isMCQ = questionType === "multiple_choice";

  // Refs for the contentEditable option divs.
  // We sync state → DOM only when the element is NOT focused, so the cursor
  // position is never disturbed while the user is typing.
  const optionDivRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    options.forEach((opt, i) => {
      const el = optionDivRefs.current[i];
      if (el && el !== document.activeElement && el.textContent !== opt.optionText) {
        el.textContent = opt.optionText;
      }
    });
  }); // runs after every render — cheap guard above keeps it safe

  // ── option helpers ──
  const setOptionText = (i: number, text: string) =>
    onOptionsChange(options.map((o, j) => j === i ? { ...o, optionText: text } : o));

  const setCorrectOption = (i: number) =>
    onOptionsChange(options.map((o, j) => ({ ...o, isCorrect: j === i })));

  const removeOption = (i: number) =>
    onOptionsChange(options.filter((_, j) => j !== i));

  const addOption = () =>
    onOptionsChange([...options, { optionText: "", isCorrect: false }]);

  return (
    <div className="space-y-4">

      {/* Question Text */}
      <div>
        <Label>
          Question Text <span className="text-destructive">*</span>
        </Label>
        <Textarea
          value={questionText}
          onChange={(e) => onQuestionTextChange(e.target.value)}
          placeholder="Enter your question..."
          rows={3}
          disabled={disabled}
          className="mt-1.5"
        />
      </div>

      {/* Type + Points */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Type</Label>
          <Select value={questionType} onValueChange={onQuestionTypeChange} disabled={disabled}>
            <SelectTrigger className="mt-1.5 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {QUESTION_TYPE_OPTS.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Points</Label>
          <Input
            type="number"
            value={points}
            onChange={(e) => onPointsChange(e.target.value)}
            min="1"
            max="100"
            disabled={disabled}
            className="mt-1.5 h-9"
          />
        </div>
      </div>

      {/* Instructions */}
      <div>
        <Label className="text-xs font-semibold text-foreground/70">
          Instructions{" "}
          <span className="text-muted-foreground font-normal">
            (optional — shown to student above this question)
          </span>
        </Label>
        <Textarea
          value={instructions}
          onChange={(e) => onInstructionsChange(e.target.value)}
          placeholder="e.g. Choose the best answer. / Study the diagram below. / Simplify the expression."
          rows={2}
          disabled={disabled}
          className="resize-none mt-1.5"
        />
      </div>

      {/* Image */}
      <QuestionImageUpload
        value={imageUrl}
        onChange={onImageUrlChange}
        disabled={disabled}
      />

      {/* MCQ options */}
      {isMCQ && (
        <div className="border-t pt-3 space-y-2">
          <Label className="text-xs font-semibold text-foreground/70">
            Answer Options{" "}
            <span className="text-muted-foreground font-normal">(select the correct one)</span>
          </Label>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                  opt.isCorrect
                    ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
                    : "border-border"
                }`}
              >
                {/* Single-correct radio */}
                <input
                  type="radio"
                  name="correct-option"
                  checked={opt.isCorrect}
                  onChange={() => setCorrectOption(i)}
                  disabled={disabled}
                  className="w-4 h-4 accent-primary flex-shrink-0"
                />

                {/*
                  contentEditable div — NOT a form element, so mobile browsers
                  (Chrome / Kiwi) never apply their native focus ring here.
                  DOM content is managed via refs; React state is updated on input.
                */}
                <div
                  ref={(el) => { optionDivRefs.current[i] = el; }}
                  contentEditable={!disabled}
                  suppressContentEditableWarning
                  role="textbox"
                  aria-label={`Option ${String.fromCharCode(65 + i)}`}
                  data-placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  onInput={(e) => {
                    const text = (e.currentTarget as HTMLDivElement).textContent ?? "";
                    setOptionText(i, text);
                  }}
                  onKeyDown={(e) => {
                    // Keep it single-line
                    if (e.key === "Enter") e.preventDefault();
                  }}
                  onPaste={(e) => {
                    // Strip formatting on paste
                    e.preventDefault();
                    const plain = e.clipboardData.getData("text/plain").replace(/\n/g, " ");
                    document.execCommand("insertText", false, plain);
                  }}
                  className={[
                    "flex-1 min-w-0 text-sm text-foreground cursor-text select-text",
                    "whitespace-nowrap overflow-hidden",
                    // Placeholder via CSS attr()
                    "empty:before:content-[attr(data-placeholder)]",
                    "empty:before:text-muted-foreground/60",
                    "empty:before:pointer-events-none",
                    disabled ? "opacity-50 cursor-not-allowed" : "",
                  ].join(" ")}
                  style={{ outline: "none" }}
                />

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  disabled={disabled || options.length <= 2}
                  title={options.length <= 2 ? "Minimum 2 options required" : "Remove option"}
                  className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {options.length < 6 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addOption}
              disabled={disabled}
              className="h-7 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" /> Add option
            </Button>
          )}
        </div>
      )}

      {/* Essay — sample answer */}
      {!isMCQ && showSampleAnswer && (
        <div>
          <Label>Sample Answer</Label>
          <Textarea
            value={sampleAnswer ?? ""}
            onChange={(e) => onSampleAnswerChange?.(e.target.value)}
            placeholder="Reference answer for grading"
            rows={3}
            disabled={disabled}
            className="mt-1.5"
          />
        </div>
      )}
    </div>
  );
}
