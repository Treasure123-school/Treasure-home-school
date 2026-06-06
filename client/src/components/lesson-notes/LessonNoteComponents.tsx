/**
 * LessonNoteComponents.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Small, reusable UI components used by LessonNoteEditorPage:
 *   • SaveIndicator  — shows save state in the toolbar
 *   • AIProgressBanner — top bar during text + image generation
 *   • RegenPanel — floating "regenerate diagram" popup
 */

import { CloudOff, Clock, CheckCircle2, Sparkles, Loader2, RefreshCw, X } from 'lucide-react';
import type { RegenFig } from './diagramHelpers';

// ── SaveIndicator ──────────────────────────────────────────────────────────────

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'saved') return (
    <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
      <CheckCircle2 className="h-3.5 w-3.5" />Saved
    </span>
  );
  if (status === 'saving') return (
    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…
    </span>
  );
  if (status === 'error') return (
    <span className="flex items-center gap-1 text-xs text-red-500">
      <CloudOff className="h-3.5 w-3.5" />Error saving
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs text-amber-500 dark:text-amber-400">
      <Clock className="h-3.5 w-3.5" />Unsaved
    </span>
  );
}

// ── AIProgressBanner ───────────────────────────────────────────────────────────

const SECTION_NAMES = ['Objectives', 'Introduction', 'Content', 'Evaluation', 'Assignment', 'Summary'];

function formatElapsed(s: number): string {
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function AIProgressBanner({
  elapsed,
  completedSections,
  isDone,
  imgTotal,
  imgDone,
}: {
  elapsed: number;
  completedSections: number;
  isDone: boolean;
  imgTotal: number;
  imgDone: number;
}) {
  const imgsLoading  = isDone && imgTotal > 0 && imgDone < imgTotal;
  const imgsAllDone  = isDone && imgTotal > 0 && imgDone >= imgTotal;
  const allComplete  = imgsAllDone || (isDone && imgTotal === 0);

  const textPct = isDone ? 100 : Math.round((completedSections / 6) * 92);
  const imgPct  = imgTotal > 0 ? Math.round((imgDone / imgTotal) * 100) : 0;

  const label = imgsLoading
    ? `Generating diagram ${imgDone + 1} of ${imgTotal}…`
    : imgsAllDone
    ? `✅ All ${imgTotal} diagram${imgTotal > 1 ? 's' : ''} ready — review and save`
    : isDone
    ? 'Generation complete — review and save your note'
    : completedSections < 6
    ? `Writing ${SECTION_NAMES[completedSections]}…`
    : 'Finalising…';

  const showImgBar = isDone && imgTotal > 0;

  return (
    <div className="shrink-0 border-b border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-background px-4 py-2.5">
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
          allComplete ? 'bg-green-100 dark:bg-green-900/30' : 'bg-primary/10'
        }`}>
          {allComplete
            ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            : <Sparkles className="h-4 w-4 text-primary animate-pulse" />}
        </div>

        {/* Labels + bars */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-foreground truncate">{label}</span>
            <span className="text-xs text-muted-foreground ml-3 shrink-0 tabular-nums">
              {!isDone && `${completedSections}/6 · ${elapsed === 0 ? 'starting…' : formatElapsed(elapsed)}`}
              {showImgBar && `🖼 ${imgDone}/${imgTotal}`}
            </span>
          </div>

          {/* Text generation bar */}
          {!isDone && (
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
              <div
                className="h-1 rounded-full transition-all duration-700 bg-primary"
                style={{ width: `${textPct}%` }}
              />
            </div>
          )}

          {/* Image generation bar */}
          {showImgBar && (
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden mt-0.5">
              <div
                className={`h-1 rounded-full transition-all duration-500 ${imgsAllDone ? 'bg-green-500' : 'bg-amber-400'}`}
                style={{ width: `${imgPct}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── RegenPanel ─────────────────────────────────────────────────────────────────

export function RegenPanel({
  fig,
  busy,
  onClose,
  onRegen,
}: {
  fig: RegenFig;
  busy: boolean;
  onClose: () => void;
  onRegen: (figId: string, prompt: string, heading: string) => void;
}) {
  return (
    <div
      className="absolute z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 w-64"
      style={{ top: fig.top, left: Math.max(8, fig.left) }}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 leading-snug line-clamp-2">
          {fig.heading}
        </span>
        <button
          onClick={onClose}
          className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mt-0.5"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <button
        disabled={busy}
        onClick={() => onRegen(fig.figId, fig.prompt, fig.heading)}
        className="flex items-center justify-center gap-2 w-full text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg px-3 py-2 font-semibold transition-colors"
      >
        {busy
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <RefreshCw className="h-3.5 w-3.5" />}
        {busy ? 'Regenerating…' : 'Regenerate Diagram'}
      </button>
    </div>
  );
}
