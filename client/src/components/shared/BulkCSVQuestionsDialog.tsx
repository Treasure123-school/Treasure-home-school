/**
 * BulkCSVQuestionsDialog / BulkCSVUploadPanel
 *
 * Reusable CSV bulk-upload UI for adding questions (exam or question bank).
 *
 * Two exports:
 *   • BulkCSVUploadPanel  — raw content block, embed inside an existing dialog/tab
 *   • BulkCSVQuestionsDialog — standalone dialog wrapper (use from a button click)
 *
 * Usage – inside a tab (ExamQuestionAdder):
 *   <BulkCSVUploadPanel
 *     onUpload={questions => mutation.mutate(questions)}
 *     isPending={mutation.isPending}
 *     onCancel={() => onOpenChange(false)}
 *   />
 *
 * Usage – standalone dialog (QuestionBankManager):
 *   <BulkCSVQuestionsDialog
 *     open={open} onOpenChange={setOpen}
 *     onUpload={questions => mutation.mutate(questions)}
 *     isPending={mutation.isPending}
 *     showDifficulty
 *     title="Bulk Upload to Question Bank"
 *   />
 */

import { useRef, useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge }  from '@/components/ui/badge';
import { AlertTriangle, Download, FileUp, Upload } from 'lucide-react';
import { parseCSVWithHeaders, makeColumnGetter } from '@/lib/csvParser';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ParsedQuestion {
  questionText:   string;
  questionType:   string;
  points:         number;
  difficulty?:    string;
  instructions?:  string;
  sampleAnswer?:  string;
  expectedAnswer?: string;
  options?: Array<{ optionText: string; isCorrect: boolean }>;
}

// ─── Internal CSV helpers ─────────────────────────────────────────────────────

function buildTemplateCSV(showDifficulty: boolean): string {
  const dCol  = showDifficulty ? ',Difficulty' : '';
  const dEasy = showDifficulty ? ',easy'       : '';
  const dHard = showDifficulty ? ',hard'       : '';
  return (
    `QuestionText,Type,OptionA,OptionB,OptionC,OptionD,CorrectAnswer,Points,Instructions,SampleAnswer${dCol}\n` +
    `"What is 2 + 2?",multiple_choice,"2","3","4","5","C",1,"Choose the correct answer","4"${dEasy}\n` +
    `"Read the passage below and answer the question that follows.

The sun rose slowly over the quiet village, casting long shadows across the dusty road.

According to the passage, when did the sun rise?",multiple_choice,"At noon","Slowly, over the village","At midnight","During a storm","B",2,"Multi-line passages are supported — just keep the whole cell quoted",""${dEasy}\n` +
    `"Explain photosynthesis.",essay,"","","","","",10,"Write a detailed explanation","Photosynthesis is the process by which..."${dHard}`
  );
}

// ─── Internal hook — all state & logic ───────────────────────────────────────

function useBulkCSVUpload(showDifficulty: boolean) {
  const { toast }    = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ParsedQuestion[]>([]);
  const [errors,  setErrors]  = useState<string[]>([]);

  function reset() { setPreview([]); setErrors([]); }

  function handleCSVFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return void toast({ title: 'Invalid File', description: 'Please select a .csv file', variant: 'destructive' });
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string;
        // Parse the whole file as one RFC-4180 document (not line-by-line) so
        // quoted fields containing embedded line breaks (reading passages,
        // poems, multi-paragraph instructions) stay intact as a single field
        // instead of being shredded into extra broken rows.
        const { headers: rawHeaders, rows } = parseCSVWithHeaders(csv);
        const headers = rawHeaders.map(h => h.toLowerCase());
        const questions: ParsedQuestion[] = [];
        const rowErrors: string[]         = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const get = makeColumnGetter(headers, row);
          const rowNum = i + 2; // +1 for header row, +1 for 1-based display

          const questionText = get('questiontext');
          const rawTypeRaw   = get('type')?.toLowerCase().replace(/[-\s]/g, '_') || 'essay';
          // Reject deprecated question types
          const rawType = rawTypeRaw;
          if (!['multiple_choice', 'essay'].includes(rawType)) {
            rowErrors.push(`Row ${rowNum}: Invalid question type "${rawType}". Please use 'multiple_choice' or 'essay'.`); continue;
          }
          const points       = parseInt(get('points')) || 1;

          if (!questionText || questionText.length < 5) {
            rowErrors.push(`Row ${rowNum}: Question text too short (min 5 chars)`); continue;
          }

          const q: ParsedQuestion = { questionText, questionType: rawType, points };

          if (showDifficulty) {
            const diff = get('difficulty')?.toLowerCase();
            q.difficulty = ['easy', 'medium', 'hard'].includes(diff) ? diff : 'medium';
          }
          if (get('instructions'))  q.instructions  = get('instructions');
          if (get('sampleanswer'))  q.sampleAnswer   = get('sampleanswer');

          if (rawType === 'multiple_choice') {
            const opts    = ['optiona', 'optionb', 'optionc', 'optiond'].map(get).filter(Boolean);
            const correct = get('correctanswer')?.toUpperCase();
            if (opts.length < 2) { rowErrors.push(`Row ${rowNum}: MCQ needs at least 2 options`); continue; }
            q.options = opts.map((text, idx) => ({
              optionText: text,
              isCorrect:  String.fromCharCode(65 + idx) === correct,
            }));
            if (!q.options.some(o => o.isCorrect)) {
              rowErrors.push(`Row ${rowNum}: No correct answer marked (use A, B, C, or D)`); continue;
            }
          } else {
            // For non-MCQ, treat CorrectAnswer as the expected answer
            const ca = get('correctanswer');
            if (ca) q.expectedAnswer = ca;
          }

          questions.push(q);
        }

        setPreview(questions);
        setErrors(rowErrors);

        if (questions.length === 0 && rowErrors.length > 0) {
          toast({ title: 'No valid questions', description: `All ${rowErrors.length} rows had errors.`, variant: 'destructive' });
        }
      } catch (err: any) {
        toast({ title: 'Parse Error', description: err.message, variant: 'destructive' });
      }
    };
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const csv  = buildTemplateCSV(showDifficulty);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = window.URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = showDifficulty ? 'question_bank_template.csv' : 'exam_questions_template.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  return { fileInputRef, preview, errors, reset, handleCSVFile, downloadTemplate };
}

// ─── Internal content renderer (shared by both exports) ──────────────────────

function CSVUploadContent({
  fileInputRef,
  preview,
  errors,
  handleCSVFile,
  downloadTemplate,
  onUpload,
  isPending,
  showDifficulty,
  onCancel,
  serverErrors,
}: {
  fileInputRef:     React.RefObject<HTMLInputElement>;
  preview:          ParsedQuestion[];
  errors:           string[];
  handleCSVFile:    (e: React.ChangeEvent<HTMLInputElement>) => void;
  downloadTemplate: () => void;
  onUpload:         (questions: ParsedQuestion[]) => void;
  isPending:        boolean;
  showDifficulty:   boolean;
  onCancel?:        () => void;
  serverErrors?:    string[];
}) {
  const mcqCount    = preview.filter(q => q.questionType === 'multiple_choice').length;
  const theoryCount = preview.length - mcqCount;
  const allErrors   = [...errors, ...(serverErrors ?? [])];

  return (
    <div className="space-y-4">

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="w-4 h-4 mr-1.5" /> Download Template
        </Button>
        <label className="cursor-pointer">
          <Button variant="outline" size="sm" asChild>
            <span><FileUp className="w-4 h-4 mr-1.5" /> Choose CSV File</span>
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVFile} />
        </label>
      </div>

      {/* Format hint */}
      <div className="border rounded-lg p-3 bg-muted/30 text-xs space-y-1">
        <p className="font-medium">CSV columns:</p>
        <p className="text-muted-foreground">
          <span className="font-mono">QuestionText</span>,{' '}
          <span className="font-mono">Type</span>{' '}
          <span className="opacity-60">(multiple_choice / essay)</span>,{' '}
          <span className="font-mono">OptionA–D</span>{' '}
          <span className="opacity-60">(MCQ only)</span>,{' '}
          <span className="font-mono">CorrectAnswer</span>{' '}
          <span className="opacity-60">(A/B/C/D for MCQ)</span>,{' '}
          <span className="font-mono">Points</span>
          {showDifficulty && (
            <>, <span className="font-mono">Difficulty</span>{' '}
            <span className="opacity-60">(easy / medium / hard)</span></>
          )}
        </p>
        <p className="text-muted-foreground">Only <strong>multiple_choice</strong> and <strong>essay</strong> are accepted. Download the template for a ready-to-fill example.</p>
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-muted/50 flex items-center justify-between">
            <span className="text-sm font-medium">
              {preview.length} question{preview.length !== 1 ? 's' : ''} ready
            </span>
            <div className="flex items-center gap-1.5">
              {mcqCount > 0    && <Badge variant="secondary" className="text-[10px]">{mcqCount} MCQ</Badge>}
              {theoryCount > 0 && <Badge variant="outline"   className="text-[10px]">{theoryCount} Theory</Badge>}
            </div>
          </div>
          <div className="max-h-44 overflow-y-auto divide-y">
            {preview.slice(0, 10).map((q, i) => (
              <div key={i} className="px-3 py-2 text-xs flex items-center gap-2">
                <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                  {q.questionType === 'multiple_choice' ? 'MCQ' : q.questionType}
                </Badge>
                <span className="flex-1 line-clamp-1 text-muted-foreground">{q.questionText}</span>
                <span className="shrink-0 text-muted-foreground font-medium">{q.points}pt</span>
              </div>
            ))}
            {preview.length > 10 && (
              <div className="px-3 py-2 text-xs text-center text-muted-foreground">
                …and {preview.length - 10} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Row errors (parse-time + server-side combined) */}
      {allErrors.length > 0 && (
        <div className="border border-destructive/30 rounded-lg p-3 bg-destructive/5">
          <p className="text-sm font-medium text-destructive flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-4 h-4" />
            {allErrors.length} row error{allErrors.length !== 1 ? 's' : ''} skipped
            {serverErrors && serverErrors.length > 0 && errors.length > 0 && (
              <span className="text-[10px] font-normal opacity-70 ml-1">
                ({errors.length} parse, {serverErrors.length} server)
              </span>
            )}
          </p>
          <div className="max-h-28 overflow-y-auto space-y-0.5">
            {allErrors.map((err, i) => <p key={i} className="text-xs text-destructive/80">{err}</p>)}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
        )}
        <Button onClick={() => onUpload(preview)} disabled={preview.length === 0 || isPending}>
          {isPending
            ? 'Uploading…'
            : `Upload${preview.length > 0 ? ` ${preview.length}` : ''} Question${preview.length !== 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  );
}

// ─── Export 1: Panel — embed inside an existing dialog or tab ─────────────────

export interface BulkCSVUploadPanelProps {
  onUpload:        (questions: ParsedQuestion[]) => void;
  isPending:       boolean;
  showDifficulty?: boolean;
  onCancel?:       () => void;
  /**
   * Server-side row errors returned after a partial upload — pass these in so
   * they are displayed in the same error section as parse errors.
   */
  serverErrors?:   string[];
}

export function BulkCSVUploadPanel({
  onUpload,
  isPending,
  showDifficulty = false,
  onCancel,
  serverErrors,
}: BulkCSVUploadPanelProps) {
  const state = useBulkCSVUpload(showDifficulty);
  return (
    <CSVUploadContent
      {...state}
      onUpload={onUpload}
      isPending={isPending}
      showDifficulty={showDifficulty}
      onCancel={onCancel}
      serverErrors={serverErrors}
    />
  );
}

// ─── Export 2: Dialog — standalone, triggered by a button ─────────────────────

export interface BulkCSVQuestionsDialogProps {
  open:            boolean;
  onOpenChange:    (open: boolean) => void;
  onUpload:        (questions: ParsedQuestion[]) => void;
  isPending:       boolean;
  title?:          string;
  showDifficulty?: boolean;
  /** Server-side row errors to display after a partial upload. */
  serverErrors?:   string[];
}

export function BulkCSVQuestionsDialog({
  open,
  onOpenChange,
  onUpload,
  isPending,
  title = 'Bulk Upload Questions (CSV)',
  showDifficulty = false,
  serverErrors,
}: BulkCSVQuestionsDialogProps) {
  const state = useBulkCSVUpload(showDifficulty);

  // Reset whenever the dialog opens
  useEffect(() => { if (open) state.reset(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <CSVUploadContent
          {...state}
          onUpload={(questions) => onUpload(questions)}
          isPending={isPending}
          showDifficulty={showDifficulty}
          onCancel={() => onOpenChange(false)}
          serverErrors={serverErrors}
        />
      </DialogContent>
    </Dialog>
  );
}
