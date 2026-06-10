/**
 * StartScreen.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * "New Lesson Note" creation start screen.
 * Styled to match the clean card aesthetic used across the portal
 * (e.g. My Attendance page) — white cards, subtle borders, inline header icon.
 */

import { BookOpen, Sparkles, Pencil, Loader2, GraduationCap, BookMarked, Calendar } from 'lucide-react';

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
  const contextPills = [
    context.className   && { icon: GraduationCap, label: context.className },
    context.subjectName && { icon: BookMarked,    label: context.subjectName },
    context.termName    && { icon: Calendar,      label: context.termName },
  ].filter(Boolean) as { icon: typeof GraduationCap; label: string }[];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 pt-6 pb-16">
      <div className="w-full max-w-xl mx-auto space-y-4">

        {/* Page header — inline icon + title (matches attendance page style) */}
        <div className="flex items-center gap-3 mb-1">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/5 shrink-0">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">New Lesson Note</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Fill in the topic then choose how to write</p>
          </div>
        </div>

        {/* Context pills row */}
        {contextPills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {contextPills.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full text-xs font-medium text-gray-600 dark:text-gray-300"
              >
                <Icon className="w-3.5 h-3.5 text-primary/70" />
                {label}
              </span>
            ))}
          </div>
        )}

        {/* Topic input card */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Topic <span className="text-rose-500">*</span>
          </label>
          <input
            value={title}
            onChange={e => onTitleChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && title.trim()) onManual(); }}
            autoFocus
            placeholder="e.g. Fishery: Types of Fish and Fishing Methods"
            className="w-full border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition"
            data-testid="input-topic"
          />
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            Be specific — a clear topic gives better AI results.
          </p>
        </div>

        {/* Mode cards — 2-column grid matching stat card layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          {/* AI Generate card */}
          <button
            onClick={() => { if (title.trim()) onAI(); }}
            disabled={aiLoading || !title.trim()}
            className="group bg-white dark:bg-gray-900 border-2 border-primary/30 dark:border-primary/20 hover:border-primary dark:hover:border-primary/60 rounded-2xl p-5 text-left transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-generate-ai"
          >
            {/* Icon row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 dark:bg-primary/5">
                {aiLoading
                  ? <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  : <Sparkles className="w-5 h-5 text-primary" />}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 dark:bg-primary/5 px-2 py-0.5 rounded-full">
                Recommended
              </span>
            </div>
            {/* Text */}
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
              {aiLoading ? 'Generating…' : 'Generate with AI'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Instantly fill the document with curriculum-aligned content.
            </p>
          </button>

          {/* Write manually card */}
          <button
            onClick={onManual}
            className="group bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 rounded-2xl p-5 text-left transition-all shadow-sm hover:shadow-md"
            data-testid="button-write-manually"
          >
            {/* Icon row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800">
                <Pencil className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </div>
            </div>
            {/* Text */}
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Write Manually</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Open the full-page editor and write your lesson note from scratch.
            </p>
          </button>

        </div>

        {/* Helper hint */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-600 pt-1">
          You can always switch to manual editing after AI generates the note.
        </p>

      </div>
    </div>
  );
}
