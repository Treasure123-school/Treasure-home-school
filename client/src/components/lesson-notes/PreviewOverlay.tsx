/**
 * PreviewOverlay.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Full-screen preview / print overlay for a lesson note.
 */

import { EyeOff, Printer } from 'lucide-react';
import type { EnrichedNote } from '@/components/lesson-notes/lessonNoteShared';

export interface PreviewOverlayProps {
  title: string;
  content: string;
  settings: any;
  meta: { className: string; subjectName: string; termName: string };
  note: EnrichedNote | undefined;
  onClose: () => void;
}

export function PreviewOverlay({ title, content, settings, meta, note, onClose }: PreviewOverlayProps) {
  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 bg-gray-200 dark:bg-gray-900 overflow-auto print:bg-white">

      {/* Print action bar — hidden in print */}
      <div className="print:hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center gap-3">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
        >
          <EyeOff className="h-4 w-4" />Close Preview
        </button>
        <div className="flex-1" />
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded transition-colors"
        >
          <Printer className="h-4 w-4" />Print / Export PDF
        </button>
      </div>

      {/* Paper */}
      <div className="fixed inset-0 flex items-start justify-center overflow-auto py-8 print:block print:overflow-visible print:py-0">
        <div className="bg-white w-[794px] max-w-full shadow-xl print:shadow-none print:w-full">

          {/* School header */}
          <div className="border-b border-gray-200 px-12 py-6 text-center">
            {settings?.schoolLogoUrl && (
              <img src={settings.schoolLogoUrl} alt="School Logo"
                className="h-16 w-16 mx-auto mb-2 object-contain" />
            )}
            <h1 className="text-xl font-bold text-gray-900">{settings?.schoolName || 'School Name'}</h1>
            {settings?.schoolAddress && (
              <p className="text-xs text-gray-500 mt-0.5">{settings.schoolAddress}</p>
            )}
            <div className="inline-block mt-3 bg-blue-50 border border-blue-200 rounded px-3 py-1">
              <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Lesson Note</span>
            </div>
          </div>

          {/* Meta row */}
          {(meta.className || meta.subjectName || meta.termName) && (
            <div className="border-b border-gray-100 px-12 py-3 flex flex-wrap gap-6 text-xs text-gray-500">
              {meta.className   && <span><strong>Class:</strong> {meta.className}</span>}
              {meta.subjectName && <span><strong>Subject:</strong> {meta.subjectName}</span>}
              {meta.termName    && <span><strong>Term:</strong> {meta.termName}</span>}
            </div>
          )}

          {/* Title */}
          <div className="px-12 pt-6 pb-2">
            <h2 className="text-2xl font-bold text-gray-900 border-b-2 border-blue-200 pb-2">{title}</h2>
          </div>

          {/* Content */}
          <div
            className="px-12 py-8 prose prose-sm max-w-none print-content"
            dangerouslySetInnerHTML={{ __html: content }}
          />

          {/* Footer */}
          <div className="border-t border-gray-100 px-12 py-4 flex items-center justify-between text-xs text-gray-400">
            <span>{settings?.schoolName || ''}</span>
            <span>{today}</span>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body > *:not(.fixed) { display: none !important; }
          .fixed { position: static !important; inset: auto !important; }
        }
        .print-content h1 { font-size: 1.5rem; font-weight: 700; margin: 1em 0 0.4em; }
        .print-content h2 { font-size: 1.2rem; font-weight: 700; margin: 0.9em 0 0.3em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.2em; }
        .print-content h3 { font-size: 1.05rem; font-weight: 600; margin: 0.75em 0 0.25em; }
        .print-content p  { margin: 0.35em 0; line-height: 1.7; }
        .print-content ul { list-style: disc; padding-left: 1.5em; margin: 0.4em 0; }
        .print-content ol { list-style: decimal; padding-left: 1.5em; margin: 0.4em 0; }
        .print-content li { margin: 0.15em 0; }
        .print-content table { border-collapse: collapse; width: 100%; margin: 0.6em 0; font-size: 0.875rem; }
        .print-content th { background: #f8fafc; font-weight: 600; border: 1px solid #cbd5e1; padding: 0.4rem 0.6rem; }
        .print-content td { border: 1px solid #cbd5e1; padding: 0.4rem 0.6rem; }
        .print-content strong { font-weight: 700; }
        .print-content em { font-style: italic; }
        .print-content a { color: #2563eb; text-decoration: underline; }
        .print-content figure img { max-width: 100%; border-radius: 8px; }
      `}</style>
    </div>
  );
}
