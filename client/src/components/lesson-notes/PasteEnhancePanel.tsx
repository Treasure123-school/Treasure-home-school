/**
 * PasteEnhancePanel — dual-mode paste panel.
 *
 * ⚡ Smart Convert  — instant local markdown/structured → HTML (no AI, no wait)
 * ✨ AI Enhance     — AI rewrites rough/unstructured notes into a full lesson plan
 *
 * Auto-detects which mode to recommend based on paste content.
 */

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ClipboardEdit, Loader2, X, Wand2, AlertTriangle, Zap, Info } from 'lucide-react';
import { detectPasteType } from '@/lib/lessonNoteFormatter';

interface PasteEnhancePanelProps {
  text: string;
  onChange: (v: string) => void;
  onEnhance: () => void;
  onSmartConvert: () => void;
  onClose: () => void;
  loading: boolean;
  smartConverting: boolean;
}

const MIN_CHARS = 80;
const MAX_CHARS = 12000;

export default function PasteEnhancePanel({
  text,
  onChange,
  onEnhance,
  onSmartConvert,
  onClose,
  loading,
  smartConverting,
}: PasteEnhancePanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chars = text.length;
  const tooShort = chars > 0 && chars < MIN_CHARS;
  const tooLong  = chars > MAX_CHARS;
  const canSubmit = chars >= MIN_CHARS && !tooLong && !loading && !smartConverting;

  const pasteType = chars >= MIN_CHARS ? detectPasteType(text) : null;
  const isAnyBusy = loading || smartConverting;

  const recommendSmartConvert = pasteType === 'markdown' || pasteType === 'mixed';

  return (
    <div className="shrink-0 border-b border-teal-100 dark:border-teal-900/40 bg-teal-50 dark:bg-teal-950/20 px-4 py-3 space-y-2.5">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardEdit className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
          <span className="text-xs font-semibold text-teal-700 dark:text-teal-300">
            Paste &amp; Format
          </span>
          <span className="hidden sm:inline text-[11px] text-teal-500 dark:text-teal-500">
            — paste your note and choose how to format it
          </span>
        </div>
        <button
          className="text-teal-400 hover:text-teal-600 dark:hover:text-teal-300 p-0.5 transition-colors"
          onClick={onClose}
          disabled={isAnyBusy}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Mode explanation cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
        <div className={`rounded-lg border px-2.5 py-2 space-y-0.5 transition-colors ${recommendSmartConvert ? 'border-teal-300 dark:border-teal-700 bg-white dark:bg-teal-950/30' : 'border-teal-100 dark:border-teal-900 bg-white/50 dark:bg-transparent'}`}>
          <div className="flex items-center gap-1.5 font-semibold text-teal-700 dark:text-teal-300">
            <Zap className="h-3 w-3 text-yellow-500 shrink-0" />
            ⚡ Smart Convert
            {recommendSmartConvert && pasteType && (
              <span className="ml-auto text-[10px] font-normal bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-400 px-1.5 py-0.5 rounded-full">
                Recommended
              </span>
            )}
          </div>
          <p className="text-teal-500 dark:text-teal-500 leading-relaxed">
            Instant. Converts markdown headings, tables, equations, and lists directly. Perfect for well-structured notes from sites like ClassNotes.ng.
          </p>
        </div>

        <div className={`rounded-lg border px-2.5 py-2 space-y-0.5 transition-colors ${!recommendSmartConvert && pasteType ? 'border-teal-300 dark:border-teal-700 bg-white dark:bg-teal-950/30' : 'border-teal-100 dark:border-teal-900 bg-white/50 dark:bg-transparent'}`}>
          <div className="flex items-center gap-1.5 font-semibold text-teal-700 dark:text-teal-300">
            <Wand2 className="h-3 w-3 text-purple-500 shrink-0" />
            ✨ AI Enhance
            {!recommendSmartConvert && pasteType && (
              <span className="ml-auto text-[10px] font-normal bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-400 px-1.5 py-0.5 rounded-full">
                Recommended
              </span>
            )}
          </div>
          <p className="text-teal-500 dark:text-teal-500 leading-relaxed">
            30–60 seconds. AI rewrites rough or unstructured notes into a full professional lesson plan with objectives, content, evaluation, etc.
          </p>
        </div>
      </div>

      {/* Auto-detection hint */}
      {pasteType && (
        <div className="flex items-center gap-1.5 text-[11px] text-teal-600 dark:text-teal-400 bg-teal-100/60 dark:bg-teal-900/30 px-2.5 py-1.5 rounded-md">
          <Info className="h-3 w-3 shrink-0 text-teal-500" />
          {pasteType === 'markdown'
            ? <>Detected <strong>structured / markdown note</strong> — Smart Convert will preserve all headings, tables, and equations perfectly.</>
            : pasteType === 'mixed'
            ? <>Detected <strong>mixed formatting</strong> — Smart Convert recommended, or use AI Enhance to fully rewrite.</>
            : <>Detected <strong>plain / rough text</strong> — AI Enhance will restructure this into a complete lesson plan.</>
          }
        </div>
      )}

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
          rows={8}
          maxLength={MAX_CHARS + 500}
          placeholder={`Paste your lesson note here…\n\nWorks with:\n  • Markdown from ClassNotes.ng, Wikipedia, etc.  (## headings, **bold**, | tables |, > equations)\n  • Plain rough notes  (handwritten, bullet dumps, incomplete sentences)\n  • Chemistry notes  (H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O)`}
          value={text}
          onChange={e => onChange(e.target.value)}
          disabled={isAnyBusy}
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

        {/* Smart Convert — primary when markdown detected */}
        <Button
          size="sm"
          className={[
            'h-8 text-xs gap-1.5 font-semibold',
            recommendSmartConvert || !pasteType
              ? 'bg-teal-600 hover:bg-teal-700 text-white'
              : 'bg-white dark:bg-gray-900 border border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950',
          ].join(' ')}
          disabled={!canSubmit}
          onClick={onSmartConvert}
        >
          {smartConverting
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Converting…</>
            : <><Zap className="h-3.5 w-3.5 text-yellow-400" /> Smart Convert</>
          }
        </Button>

        {/* AI Enhance — primary when plain text detected */}
        <Button
          size="sm"
          className={[
            'h-8 text-xs gap-1.5 font-semibold',
            !recommendSmartConvert && pasteType
              ? 'bg-teal-600 hover:bg-teal-700 text-white'
              : 'bg-white dark:bg-gray-900 border border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950',
          ].join(' ')}
          disabled={!canSubmit}
          onClick={onEnhance}
        >
          {loading
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enhancing…</>
            : <><Wand2 className="h-3.5 w-3.5 text-purple-400" /> AI Enhance</>
          }
        </Button>

        {!isAnyBusy && text && (
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
        {smartConverting && (
          <p className="text-[11px] text-teal-500 dark:text-teal-400 flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Converting…
          </p>
        )}
      </div>
    </div>
  );
}
