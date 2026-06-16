/**
 * PasteEnhancePanel — collapsible panel where the user pastes their own
 * lesson note text. On submit the parent calls the AI enhance-paste endpoint.
 */

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ClipboardEdit, Loader2, X, Wand2, AlertTriangle } from 'lucide-react';

interface PasteEnhancePanelProps {
  text: string;
  onChange: (v: string) => void;
  onEnhance: () => void;
  onClose: () => void;
  loading: boolean;
}

const MIN_CHARS = 80;
const MAX_CHARS = 12000;

export default function PasteEnhancePanel({
  text,
  onChange,
  onEnhance,
  onClose,
  loading,
}: PasteEnhancePanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chars = text.length;
  const tooShort = chars > 0 && chars < MIN_CHARS;
  const tooLong  = chars > MAX_CHARS;
  const canSubmit = chars >= MIN_CHARS && !tooLong && !loading;

  return (
    <div className="shrink-0 border-b border-teal-100 dark:border-teal-900/40 bg-teal-50 dark:bg-teal-950/20 px-4 py-3 space-y-2.5">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardEdit className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
          <span className="text-xs font-semibold text-teal-700 dark:text-teal-300">
            Paste &amp; Enhance with AI
          </span>
          <span className="hidden sm:inline text-[11px] text-teal-500 dark:text-teal-500">
            — paste your own note and AI will rewrite it professionally
          </span>
        </div>
        <button
          className="text-teal-400 hover:text-teal-600 dark:hover:text-teal-300 p-0.5 transition-colors"
          onClick={onClose}
          disabled={loading}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Instructions */}
      <p className="text-[11px] text-teal-600 dark:text-teal-400 leading-relaxed">
        Paste your handwritten or typed lesson note below — as rough as you like. The AI will
        preserve <strong>all</strong> your facts and examples, fix the language, add structure,
        and write out the full note in the editor.
      </p>

      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          className={[
            'w-full text-xs rounded-lg border px-3 py-2.5 resize-y',
            'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100',
            'placeholder-gray-400 dark:placeholder-gray-600',
            'focus:outline-none focus:ring-2 transition-colors',
            tooLong
              ? 'border-red-300 dark:border-red-700 focus:ring-red-400/50'
              : tooShort
              ? 'border-amber-300 dark:border-amber-700 focus:ring-amber-400/50'
              : 'border-teal-200 dark:border-teal-800 focus:ring-teal-400/50',
          ].join(' ')}
          rows={7}
          maxLength={MAX_CHARS + 500}
          placeholder={`Paste your lesson note here…\n\nExample:\n  Acid-Base Reactions\n  An acid is a substance that donates protons. A base accepts protons.\n  H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O\n  Types of acids: strong acids (HCl, H₂SO₄), weak acids (CH₃COOH)…`}
          value={text}
          onChange={e => onChange(e.target.value)}
          disabled={loading}
          spellCheck
        />

        {/* Character counter */}
        <div className={[
          'absolute bottom-2 right-2.5 text-[10px] font-mono select-none pointer-events-none',
          tooLong  ? 'text-red-500' :
          tooShort && chars > 0 ? 'text-amber-500' : 'text-gray-300 dark:text-gray-600',
        ].join(' ')}>
          {chars.toLocaleString()} / {MAX_CHARS.toLocaleString()}
        </div>
      </div>

      {/* Validation hints */}
      {tooShort && (
        <p className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          Please paste at least {MIN_CHARS} characters of your lesson note.
        </p>
      )}
      {tooLong && (
        <p className="flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          Note is too long ({chars.toLocaleString()} chars). Please trim to {MAX_CHARS.toLocaleString()} characters max.
        </p>
      )}

      {/* Action row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          className="h-8 text-xs gap-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold"
          disabled={!canSubmit}
          onClick={onEnhance}
        >
          {loading
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enhancing…</>
            : <><Wand2 className="h-3.5 w-3.5" /> Enhance with AI</>
          }
        </Button>

        {!loading && text && (
          <button
            className="text-xs text-teal-500 dark:text-teal-400 hover:underline"
            onClick={() => onChange('')}
          >
            Clear
          </button>
        )}

        {loading && (
          <p className="text-[11px] text-teal-500 dark:text-teal-400 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            AI is rewriting your note — this may take 30–60 seconds…
          </p>
        )}
      </div>
    </div>
  );
}
