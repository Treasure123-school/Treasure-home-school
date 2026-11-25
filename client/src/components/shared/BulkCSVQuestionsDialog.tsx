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
 *     onUpload={(questions, done) => mutation.mutate(questions, { onSuccess: () => done() })}
 *     isPending={mutation.isPending}
 *     onCancel={() => onOpenChange(false)}
 *   />
 *
 * Usage – standalone dialog (QuestionBankManager):
 *   <BulkCSVQuestionsDialog
 *     open={open} onOpenChange={setOpen}
 *     onUpload={(questions, done) => mutation.mutate(questions, { onSuccess: () => done() })}
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
import { AlertTriangle, ArrowRight, CheckCircle2, Download, FileUp, Eye, Loader2, Plus, Upload } from 'lucide-react';
import { parseCSVWithHeaders, makeColumnGetter } from '@/lib/csvParser';
import { CSVQuestionPreview } from './CSVQuestionPreview';

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

function useBulkCSVUpload(showDifficulty: boolean, onParsed?: () => void) {
  const { toast }    = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onParsedRef  = useRef(onParsed);
  onParsedRef.current = onParsed;
  const [preview, setPreview] = useState<ParsedQuestion[]>([]);
  const [errors,  setErrors]  = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [readingName, setReadingName] = useState('');
  const dragDepth = useRef(0);

  function reset() {
    setPreview([]); setErrors([]); setIsDragOver(false); dragDepth.current = 0;
    setIsReading(false); setReadingName('');
  }

  function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return void toast({ title: 'Invalid File', description: 'Please select a .csv file', variant: 'destructive' });
    }
    if (isReading) return;

    setIsReading(true);
    setReadingName(file.name);
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
        if (questions.length > 0) onParsedRef.current?.();

        if (questions.length === 0 && rowErrors.length > 0) {
          toast({ title: 'No valid questions', description: `All ${rowErrors.length} rows had errors.`, variant: 'destructive' });
        }
      } catch (err: any) {
        toast({ title: 'Parse Error', description: err.message, variant: 'destructive' });
      } finally {
        setIsReading(false);
        setReadingName('');
      }
    };
    reader.onerror = () => {
      setIsReading(false);
      setReadingName('');
      toast({ title: 'File Read Error', description: 'Could not read that file. Please try again.', variant: 'destructive' });
    };
    reader.readAsText(file);
  }

  function handleCSVFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) processFile(file);
  }

  function hasFiles(e: React.DragEvent<HTMLLabelElement>) {
    return Array.from(e.dataTransfer.types).includes('Files');
  }

  function handleDragEnter(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    if (!hasFiles(e)) return;
    dragDepth.current += 1;
    setIsDragOver(true);
  }

  function handleDragOver(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    if (hasFiles(e)) e.dataTransfer.dropEffect = 'copy';
  }

  function handleDragLeave(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    if (dragDepth.current === 0) return;
    dragDepth.current -= 1;
    if (dragDepth.current === 0) setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
    else toast({ title: 'Invalid File', description: 'Please drop a .csv file', variant: 'destructive' });
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

  return {
    fileInputRef, preview, errors, reset, handleCSVFile, downloadTemplate,
    isDragOver, isReading, readingName, handleDragEnter, handleDragOver, handleDragLeave, handleDrop,
  };
}

/** Owns the file picker, preview and completion surfaces. */
function useCSVUploadFlow(showDifficulty: boolean) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [complete, setComplete] = useState(false);
  const upload = useBulkCSVUpload(showDifficulty, () => setPreviewOpen(true));
  function reset() { upload.reset(); setPreviewOpen(false); setComplete(false); }
  function markComplete() { setComplete(true); }
  return { ...upload, previewOpen, setPreviewOpen, complete, markComplete, reset };
}

// ─── Internal content renderer (file selection surface) ──────────────────────

function CSVUploadContent({
  fileInputRef,
  preview,
  errors,
  handleCSVFile,
  downloadTemplate,
  isDragOver,
  isReading,
  readingName,
  handleDragEnter,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  showDifficulty,
  onPreview,
  onCancel,
  serverErrors,
}: {
  fileInputRef:     React.RefObject<HTMLInputElement>;
  preview:          ParsedQuestion[];
  errors:           string[];
  handleCSVFile:    (e: React.ChangeEvent<HTMLInputElement>) => void;
  downloadTemplate: () => void;
  isDragOver:       boolean;
  isReading:        boolean;
  readingName?:     string;
  handleDragEnter:  (e: React.DragEvent<HTMLLabelElement>) => void;
  handleDragOver:   (e: React.DragEvent<HTMLLabelElement>) => void;
  handleDragLeave:  (e: React.DragEvent<HTMLLabelElement>) => void;
  handleDrop:       (e: React.DragEvent<HTMLLabelElement>) => void;
  showDifficulty:   boolean;
  onPreview:        () => void;
  onCancel?:        () => void;
  serverErrors?:    string[];
}) {
  const allErrorCount = errors.length + (serverErrors?.length ?? 0);

  return (
    <div className="space-y-4">

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="w-4 h-4 mr-1.5" /> Download Template
        </Button>
      </div>

      {/* Drop zone — clicking anywhere in it opens the same hidden file input */}
      <label
        data-testid="csv-dropzone"
        data-drag-active={isDragOver || undefined}
        aria-busy={isReading || undefined}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
          isReading
            ? 'pointer-events-none border-primary/50 bg-primary/5'
            : isDragOver
            ? 'border-primary bg-primary/5 cursor-pointer'
            : 'border-muted-foreground/30 bg-muted/30 hover:border-primary/50 hover:bg-muted/50 cursor-pointer'
        }`}
      >
        {isReading ? (
          <div role="status" className="flex flex-col items-center gap-1.5">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-sm font-medium">Reading CSV…</span>
            {readingName && <span className="max-w-full truncate text-xs text-muted-foreground">{readingName}</span>}
          </div>
        ) : (
          <>
            <FileUp className={`w-6 h-6 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className="text-sm font-medium">
              {isDragOver ? 'Drop your CSV here' : 'Drag & drop your CSV here'}
            </span>
            <span className="text-xs text-muted-foreground">
              or <span className="text-primary underline underline-offset-2">browse files</span>
            </span>
          </>
        )}
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVFile} data-testid="csv-file-input" disabled={isReading} />
      </label>

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

      {/* Ready-to-review summary — full preview opens in its own dialog */}
      {preview.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border rounded-lg p-3 bg-muted/30">
          <span className="text-sm font-medium">
            {preview.length} question{preview.length !== 1 ? 's' : ''} ready
          </span>
          <Button size="sm" onClick={onPreview} data-testid="csv-open-preview">
            <Eye className="w-4 h-4 mr-1.5" /> Review full preview
          </Button>
        </div>
      )}

      {/* Row errors (parse-time + server-side combined) */}
      {allErrorCount > 0 && (
        <div className="border border-destructive/30 rounded-lg p-2.5 bg-destructive/5">
          <p className="text-xs font-medium text-destructive flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            {allErrorCount} row error{allErrorCount !== 1 ? 's' : ''} skipped — details in the full preview
          </p>
        </div>
      )}

      {onCancel && (
        <div className="flex justify-end pt-1">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      )}
    </div>
  );
}

// ─── Completion surface ───────────────────────────────────────────────────────

function CSVUploadComplete({
  count,
  onDone,
  onContinue,
}: {
  count:      number;
  onDone:     () => void;
  onContinue: () => void;
}) {
  return (
    <div data-testid="csv-upload-complete" className="flex flex-col items-center gap-4 py-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle2 className="h-8 w-8 text-primary" />
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Upload complete</h3>
        <p className="text-sm text-muted-foreground">
          {count} question{count !== 1 ? 's' : ''} added successfully.
        </p>
      </div>
      <div className="flex w-full flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
        <Button onClick={onDone} data-testid="csv-upload-manage">
          Manage Questions <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={onContinue} data-testid="csv-upload-continue">
          <Plus className="mr-1.5 h-4 w-4" /> Continue Adding
        </Button>
      </div>
    </div>
  );
}

// ─── Export 1: Panel — embed inside an existing dialog or tab ─────────────────

export interface BulkCSVUploadPanelProps {
  onUpload:        (questions: ParsedQuestion[], onComplete: () => void) => void;
  isPending:       boolean;
  showDifficulty?: boolean;
  onCancel?:       () => void;
  onDone?:         () => void;
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
  onDone,
  serverErrors,
}: BulkCSVUploadPanelProps) {
  const flow = useCSVUploadFlow(showDifficulty);
  if (flow.complete) {
    return (
      <CSVUploadComplete
        count={flow.preview.length}
        onDone={onDone ?? onCancel ?? (() => {})}
        onContinue={flow.reset}
      />
    );
  }
  return flow.previewOpen ? (
    <CSVQuestionPreview
      questions={flow.preview}
      errors={flow.errors}
      serverErrors={serverErrors}
      onUpload={(questions) => onUpload(questions, flow.markComplete)}
      onBack={() => flow.setPreviewOpen(false)}
      isPending={isPending}
      showDifficulty={showDifficulty}
    />
  ) : (
    <CSVUploadContent
      {...flow}
      showDifficulty={showDifficulty}
      onPreview={() => flow.setPreviewOpen(true)}
      onCancel={onCancel}
      serverErrors={serverErrors}
    />
  );
}

// ─── Export 2: Dialog — standalone, triggered by a button ─────────────────────

export interface BulkCSVQuestionsDialogProps {
  open:            boolean;
  onOpenChange:    (open: boolean) => void;
  onUpload:        (questions: ParsedQuestion[], onComplete: () => void) => void;
  isPending:       boolean;
  title?:          string;
  showDifficulty?: boolean;
  onDone?:         () => void;
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
  onDone,
  serverErrors,
}: BulkCSVQuestionsDialogProps) {
  const flow = useCSVUploadFlow(showDifficulty);

  // Reset whenever the dialog opens
  useEffect(() => { if (open) flow.reset(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className={flow.previewOpen
          ? 'max-w-3xl max-h-[92dvh] overflow-y-auto'
          : 'max-w-lg max-h-[90vh] overflow-y-auto'}
      >
        {!flow.previewOpen && (
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              {title}
            </DialogTitle>
          </DialogHeader>
        )}
        {flow.complete ? (
          <CSVUploadComplete
            count={flow.preview.length}
            onDone={onDone ?? (() => onOpenChange(false))}
            onContinue={flow.reset}
          />
        ) : flow.previewOpen ? (
          <CSVQuestionPreview
            questions={flow.preview}
            errors={flow.errors}
            serverErrors={serverErrors}
            onUpload={(questions) => onUpload(questions, flow.markComplete)}
            onBack={() => flow.setPreviewOpen(false)}
            isPending={isPending}
            showDifficulty={showDifficulty}
          />
        ) : (
          <CSVUploadContent
            {...flow}
            showDifficulty={showDifficulty}
            onPreview={() => flow.setPreviewOpen(true)}
            onCancel={() => onOpenChange(false)}
            serverErrors={serverErrors}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
