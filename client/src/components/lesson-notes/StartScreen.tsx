/**
 * StartScreen.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The "choose generation mode" screen shown when creating a new lesson note.
 */

import { useLocation } from 'wouter';
import { BookOpen, Sparkles, Pencil, Loader2 } from 'lucide-react';

export interface StartScreenProps {
  title: string;
  onTitleChange: (t: string) => void;
  onManual: () => void;
  onAI: () => void;
  aiLoading: boolean;
  context: { className: string; subjectName: string; termName: string };
}

export function StartScreen({
  title,
  onTitleChange,
  onManual,
  onAI,
  aiLoading,
  context,
}: StartScreenProps) {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center px-4 pt-8 pb-16">
      <div className="w-full max-w-xl">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 dark:bg-primary/5 rounded-2xl mb-4">
            <BookOpen className="h-7 w-7 text-primary dark:text-primary/70" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Lesson Note</h1>
          {context.className && (
            <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm">
              {[context.className, context.subjectName, context.termName].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {/* Topic input */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-4 shadow-sm">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Topic <span className="text-rose-500">*</span>
          </label>
          <input
            value={title}
            onChange={e => onTitleChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && title.trim()) onManual(); }}
            autoFocus
            placeholder="e.g. Fishery: Types of Fish and Fishing Methods"
            className="w-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-3 text-base text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
          />
        </div>

        {/* Mode buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* AI Generate */}
          <button
            onClick={() => { if (title.trim()) onAI(); }}
            disabled={aiLoading || !title.trim()}
            className="group relative bg-gradient-to-br from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 text-white rounded-xl p-5 text-left transition-all shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2 mb-2.5">
              {aiLoading
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <Sparkles className="h-5 w-5" />}
              <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
                Recommended
              </span>
            </div>
            <h3 className="text-base font-bold mb-1">Generate with AI</h3>
            <p className="text-primary/30 text-sm leading-relaxed">
              Instantly fill the document with AI-generated, curriculum-aligned content.
            </p>
          </button>

          {/* Write manually */}
          <button
            onClick={onManual}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-primary/60 dark:hover:border-primary text-gray-800 dark:text-gray-200 rounded-xl p-5 text-left transition-all shadow-sm hover:shadow-md"
          >
            <div className="flex items-center gap-2 mb-2.5">
              <Pencil className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </div>
            <h3 className="text-base font-bold mb-1">Write Manually</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
              Open the full-page editor and write your lesson note from scratch.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
