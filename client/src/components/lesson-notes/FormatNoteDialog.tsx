/**
 * FormatNoteDialog
 * Shows a preview of the smart-formatted lesson note with statistics,
 * and lets the admin apply or discard the formatting.
 */

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatLessonNote, totalChanges } from '@/lib/lessonNoteFormatter';
import type { FormatStats } from '@/lib/lessonNoteFormatter';
import {
  Wand2, CheckCircle2, X, Loader2,
  Heading2, List, ListOrdered, Table2,
  FlaskConical, Sigma, MessageSquare, BookOpen,
  AlertTriangle,
} from 'lucide-react';

interface FormatNoteDialogProps {
  open: boolean;
  onClose: () => void;
  currentHtml: string;
  onApply: (formattedHtml: string) => void;
}

interface StatRow {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}

function StatCard({ icon, label, value, color }: StatRow) {
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${value > 0 ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700' : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 opacity-50'}`}>
      <div className={`shrink-0 ${color}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{label}</p>
        <p className={`text-sm font-bold ${value > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>{value}</p>
      </div>
    </div>
  );
}

export default function FormatNoteDialog({ open, onClose, currentHtml, onApply }: FormatNoteDialogProps) {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ html: string; stats: FormatStats } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Run the formatter when dialog opens
  useEffect(() => {
    if (!open) { setResult(null); return; }
    if (!currentHtml?.trim()) {
      setResult({ html: '', stats: { headings: 0, orderedLists: 0, unorderedLists: 0, tables: 0, equations: 0, callouts: 0, mcqBlocks: 0, chemFormulas: 0 } });
      return;
    }

    setProcessing(true);
    // Defer to next tick so UI renders "Processing…" first
    const timer = setTimeout(() => {
      try {
        const r = formatLessonNote(currentHtml);
        setResult(r);
      } catch {
        setResult(null);
      } finally {
        setProcessing(false);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [open, currentHtml]);

  const stats = result?.stats;
  const changes = stats ? totalChanges(stats) : 0;
  const isEmpty = !currentHtml?.trim();

  const statRows: StatRow[] = stats ? [
    { icon: <Heading2 className="h-4 w-4" />,      label: 'Headings',        value: stats.headings,      color: 'text-blue-500' },
    { icon: <ListOrdered className="h-4 w-4" />,   label: 'Numbered Lists',  value: stats.orderedLists,  color: 'text-indigo-500' },
    { icon: <List className="h-4 w-4" />,          label: 'Bullet Lists',    value: stats.unorderedLists, color: 'text-violet-500' },
    { icon: <Table2 className="h-4 w-4" />,        label: 'Tables',          value: stats.tables,        color: 'text-cyan-600' },
    { icon: <FlaskConical className="h-4 w-4" />,  label: 'Chem Formulas',   value: stats.chemFormulas,  color: 'text-emerald-500' },
    { icon: <Sigma className="h-4 w-4" />,         label: 'Equations',       value: stats.equations,     color: 'text-purple-500' },
    { icon: <MessageSquare className="h-4 w-4" />, label: 'Callout Blocks',  value: stats.callouts,      color: 'text-amber-500' },
    { icon: <BookOpen className="h-4 w-4" />,      label: 'MCQ Blocks',      value: stats.mcqBlocks,     color: 'text-rose-500' },
  ] : [];

  function handleApply() {
    if (!result?.html) return;
    onApply(result.html);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* Header */}
        <DialogHeader className="shrink-0 px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800 flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
              <Wand2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">Smart Format Preview</DialogTitle>
              <p className="text-xs text-gray-500 dark:text-gray-400">Review the formatted result before applying it to your note</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">

          {/* Left panel: stats */}
          <div className="shrink-0 lg:w-64 border-b lg:border-b-0 lg:border-r border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Formatting Statistics</p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {processing ? (
                <div className="flex items-center gap-2 px-2 py-4 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analysing…
                </div>
              ) : isEmpty ? (
                <div className="flex flex-col items-center gap-2 px-2 py-6 text-center text-xs text-gray-400">
                  <AlertTriangle className="h-6 w-6 text-amber-400" />
                  <span>The editor is empty. Paste or type your lesson note content first, then click Format Note.</span>
                </div>
              ) : (
                <>
                  {/* Summary badge */}
                  <div className={`px-3 py-2.5 rounded-lg mb-2 ${changes > 0 ? 'bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800' : 'bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'}`}>
                    <p className={`text-xs font-semibold ${changes > 0 ? 'text-violet-700 dark:text-violet-400' : 'text-gray-500'}`}>
                      {changes > 0 ? `✨ ${changes} formatting element${changes !== 1 ? 's' : ''} detected` : 'No special formatting detected'}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                      {changes > 0 ? 'Original content is fully preserved.' : 'Content will be cleaned up but unchanged.'}
                    </p>
                  </div>

                  {statRows.map(row => (
                    <StatCard key={row.label} {...row} />
                  ))}
                </>
              )}
            </div>

            {/* Action buttons */}
            <div className="shrink-0 p-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
              <Button
                className="w-full h-8 text-xs gap-1.5 bg-violet-600 hover:bg-violet-700 text-white font-semibold"
                disabled={processing || !result?.html || isEmpty}
                onClick={handleApply}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Apply Formatting
              </Button>
              <Button
                variant="outline"
                className="w-full h-8 text-xs gap-1.5"
                onClick={onClose}
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
            </div>
          </div>

          {/* Right panel: formatted preview */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <div className="shrink-0 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Preview</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">This is how your note will look after formatting is applied</p>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-950 p-6">
              {processing ? (
                <div className="flex items-center justify-center h-32 gap-2 text-sm text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processing your content…
                </div>
              ) : isEmpty ? (
                <div className="flex items-center justify-center h-32 text-sm text-gray-400">
                  Nothing to preview — editor is empty.
                </div>
              ) : (
                <div className="max-w-3xl mx-auto bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-700 rounded-lg px-10 py-8">
                  <div
                    ref={previewRef}
                    className="format-preview-root"
                    dangerouslySetInnerHTML={{ __html: result?.html || '' }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preview styles (scoped to this dialog) */}
        <style>{`
          .format-preview-root { min-height: 100px; font-family: Georgia, serif; font-size: 1rem; line-height: 1.75; color: #111; }
          .format-preview-root > * + * { margin-top: 0.4em; }
          .format-preview-root p  { margin: 0 0 0.35em; line-height: 1.75; }
          .format-preview-root h1 { font-size: 1.8rem; font-weight: 700; margin: 0.9em 0 0.35em; color: #1d4ed8; border-bottom: 2px solid #dbeafe; padding-bottom: 0.2em; }
          .format-preview-root h2 { font-size: 1.35rem; font-weight: 700; margin: 0.85em 0 0.3em; color: #1d4ed8; border-bottom: 1px solid #dbeafe; padding-bottom: 0.15em; }
          .format-preview-root h3 { font-size: 1.1rem; font-weight: 600; margin: 0.75em 0 0.25em; color: #1e40af; }
          .format-preview-root ol { list-style: decimal; padding-left: 1.75em; margin: 0.4em 0; }
          .format-preview-root ul { list-style: disc; padding-left: 1.75em; margin: 0.4em 0; }
          .format-preview-root li { margin: 0.2em 0; line-height: 1.7; }
          .format-preview-root li > p { margin: 0; }
          .format-preview-root blockquote { margin: 0.75em 0; border-radius: 0 6px 6px 0; padding: 0.75em 1em; }
          .format-preview-root table { border-collapse: collapse; width: 100%; margin: 0.75em 0; font-size: 0.9rem; }
          .format-preview-root strong { font-weight: 700; }
          .format-preview-root sub { font-size: 0.75em; vertical-align: sub; }
          .dark .format-preview-root { color: #e5e7eb; }
          .dark .format-preview-root h1,
          .dark .format-preview-root h2,
          .dark .format-preview-root h3 { color: #93c5fd; border-bottom-color: #1e3a5f; }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
