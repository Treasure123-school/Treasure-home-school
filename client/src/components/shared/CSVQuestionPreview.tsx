/**
 * CSV question preview "step" shown inside the upload modal.
 * Full question text/options in a fixed-height scroll container, revealing
 * questions in chunks as the user scrolls so large uploads stay responsive.
 */

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowLeft, Check, FileText, Loader2 } from 'lucide-react';
import type { ParsedQuestion } from './BulkCSVQuestionsDialog';

const PAGE_SIZE = 20;

export interface CSVQuestionPreviewProps {
  questions:       ParsedQuestion[];
  errors:          string[];
  serverErrors?:   string[];
  onUpload:        (questions: ParsedQuestion[]) => void;
  onBack:          () => void;
  isPending:       boolean;
  showDifficulty:  boolean;
}

export function CSVQuestionPreview({
  questions,
  errors,
  serverErrors,
  onUpload,
  onBack,
  isPending,
  showDifficulty,
}: CSVQuestionPreviewProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isBusyRef = useRef(false);
  const totalRef = useRef(questions.length);
  totalRef.current = questions.length;

  const mcqCount = questions.filter(q => q.questionType === 'multiple_choice').length;
  const theoryCount = questions.length - mcqCount;
  const allErrors = [...errors, ...(serverErrors ?? [])];

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    isBusyRef.current = false;
  }, [questions]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    isBusyRef.current = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || isBusyRef.current) return;
        isBusyRef.current = true;
        setVisibleCount(count => {
          if (count >= totalRef.current) {
            isBusyRef.current = false;
            return count;
          }
          return count + PAGE_SIZE;
        });
      },
      { threshold: 0, rootMargin: '0px 0px 200px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount]);

  return (
    <div data-testid="csv-preview" className="space-y-3">
      <div className="pb-3 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <FileText className="w-5 h-5 text-primary" />
            Question Preview
          </h3>
          {mcqCount > 0 && <Badge variant="outline">{mcqCount} MCQ</Badge>}
          {theoryCount > 0 && <Badge variant="outline">{theoryCount} Theory</Badge>}
          {allErrors.length > 0 && <Badge variant="destructive">{allErrors.length} row errors</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          Review the full questions and options before uploading. Only the visible questions are rendered; more load as you scroll.
        </p>
      </div>

      {isPending && (
        <div role="status" className="flex items-center gap-2 rounded-md bg-primary/5 px-3 py-2 text-xs text-primary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Uploading your questions… please keep this window open.
        </div>
      )}

      {/* Fixed-height scroll region — the modal itself never grows with the questions */}
      <div
        data-testid="csv-preview-scroll"
        className="h-[58vh] min-h-[260px] max-h-[620px] overflow-y-auto overscroll-auto rounded-lg border bg-muted/20 p-3 space-y-3"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {allErrors.length > 0 && (
          <div className="border border-destructive/30 rounded-lg p-3 bg-destructive/5">
            <p className="text-sm font-medium text-destructive flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-4 h-4" />
              {allErrors.length} row error{allErrors.length !== 1 ? 's' : ''} skipped
            </p>
            <div className="max-h-28 overflow-y-auto space-y-0.5">
              {allErrors.map((err, i) => <p key={i} className="text-xs text-destructive/80">{err}</p>)}
            </div>
          </div>
        )}

        {questions.map((q, i) => i < visibleCount ? (
          <div key={i} data-testid="csv-preview-question" className="border rounded-lg p-3 bg-card space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">{i + 1}</span>
                <Badge variant="outline" className="capitalize">
                  {q.questionType === 'multiple_choice' ? 'MCQ' : q.questionType}
                </Badge>
                {showDifficulty && q.difficulty && (
                  <Badge variant="secondary" className="capitalize">{q.difficulty}</Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground font-medium">{q.points} pt{q.points !== 1 ? 's' : ''}</span>
            </div>

            <p className="text-sm whitespace-pre-wrap break-words">{q.questionText}</p>

            {q.options && q.options.length > 0 && (
              <div className="space-y-1 pl-1">
                {q.options.map((option, oi) => (
                  <div
                    key={oi}
                    className={`flex items-start gap-2 rounded-md px-2 py-1 text-sm ${
                      option.isCorrect
                        ? 'border border-primary/40 bg-primary/5 text-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <span className="font-medium shrink-0">{String.fromCharCode(65 + oi)}.</span>
                    <span className="flex-1 whitespace-pre-wrap break-words">{option.optionText}</span>
                    {option.isCorrect && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </div>
                ))}
              </div>
            )}

            {q.instructions && (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                <span className="font-medium text-foreground">Instructions: </span>{q.instructions}
              </p>
            )}
            {q.expectedAnswer && (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                <span className="font-medium text-foreground">Expected answer: </span>{q.expectedAnswer}
              </p>
            )}
            {q.sampleAnswer && (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                <span className="font-medium text-foreground">Sample answer: </span>{q.sampleAnswer}
              </p>
            )}
          </div>
        ) : null)}

        {visibleCount < questions.length && (
          <div ref={sentinelRef} data-testid="csv-preview-load-more" className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading more questions… ({visibleCount} of {questions.length})
          </div>
        )}
        {visibleCount >= questions.length && questions.length > 0 && (
          <p className="py-3 text-center text-xs text-muted-foreground">All {questions.length} questions shown</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
        <span className="text-xs text-muted-foreground">
          Showing {Math.min(visibleCount, questions.length)} of {questions.length} questions
        </span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} disabled={isPending} aria-label="Choose another file" className="px-2.5 sm:px-3">
            <ArrowLeft className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Choose another file</span>
          </Button>
          <Button
            data-testid="csv-preview-upload"
            onClick={() => onUpload(questions)}
            disabled={questions.length === 0 || isPending}
          >
            {isPending
              ? 'Uploading…'
              : `Upload ${questions.length} Question${questions.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
