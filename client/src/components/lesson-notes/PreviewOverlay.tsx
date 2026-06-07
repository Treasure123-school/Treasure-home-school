/**
 * PreviewOverlay.tsx
 * Full-screen print preview overlay for a lesson note.
 */

import { useMemo } from 'react';
import DOMPurify from 'dompurify';
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

  const brandColor = settings?.primaryColor || '#3b82f6';

  const safeHtml = useMemo(() => {
    if (!content) return '';
    const clean = DOMPurify.sanitize(content, {
      ADD_TAGS: ['table', 'thead', 'tbody', 'tr', 'th', 'td', 'colgroup', 'col', 'figure', 'figcaption'],
      ADD_ATTR: ['target', 'rel', 'href', 'src', 'alt', 'width', 'height', 'style', 'class', 'colspan', 'rowspan', 'align'],
      ALLOW_DATA_ATTR: false,
      FORCE_BODY: true,
    });
    return clean
      .replace(/·\s*click to regenerate/gi, '')
      .replace(/·\s*regenerating…/gi, '')
      .replace(/cursor:\s*pointer/gi, 'cursor:default');
  }, [content]);

  return (
    <div className="fixed inset-0 z-50 bg-gray-200 dark:bg-gray-900 overflow-auto print:bg-white">

      {/* Action bar — hidden in print */}
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
          className="flex items-center gap-1.5 text-sm bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded transition-colors"
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
            <p className="text-xl font-bold text-gray-900">{settings?.schoolName || 'School Name'}</p>
            {settings?.schoolAddress && (
              <p className="text-xs text-gray-500 mt-0.5">{settings.schoolAddress}</p>
            )}
            <div className="inline-block mt-3 border rounded px-3 py-1"
              style={{ background: `${brandColor}10`, borderColor: `${brandColor}40` }}>
              <span className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: brandColor }}>Lesson Note</span>
            </div>
          </div>

          {/* Meta row */}
          {(meta.className || meta.subjectName || meta.termName) && (
            <div className="border-b border-gray-100 px-12 py-3 flex flex-wrap gap-6 text-xs text-gray-500">
              {meta.className   && <span><strong className="text-gray-700">Class:</strong> {meta.className}</span>}
              {meta.subjectName && <span><strong className="text-gray-700">Subject:</strong> {meta.subjectName}</span>}
              {meta.termName    && <span><strong className="text-gray-700">Term:</strong> {meta.termName}</span>}
            </div>
          )}

          {/* Content — note already starts with H1 title, no separate heading needed */}
          <div
            className="px-12 py-8 preview-content"
            style={{ '--preview-heading-color': brandColor } as React.CSSProperties}
            dangerouslySetInnerHTML={{ __html: safeHtml }}
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
        .preview-content h1 { font-size: 1.75rem; font-weight: 700; line-height: 1.25; margin: 0.75em 0 0.4em; color: var(--preview-heading-color, #3b82f6) !important; border-bottom: 2px solid currentColor; padding-bottom: 0.25em; }
        .preview-content h2 { font-size: 1.25rem; font-weight: 700; line-height: 1.3; margin: 1em 0 0.35em; color: var(--preview-heading-color, #3b82f6) !important; }
        .preview-content h3 { font-size: 1.05rem; font-weight: 600; line-height: 1.4; margin: 0.8em 0 0.3em; color: var(--preview-heading-color, #3b82f6) !important; }
        .preview-content h4 { font-size: 0.95rem; font-weight: 600; line-height: 1.4; margin: 0.7em 0 0.25em; color: var(--preview-heading-color, #3b82f6) !important; }
        .preview-content p  { margin: 0.35em 0; line-height: 1.7; color: #111827; }
        .preview-content ul { list-style: disc; padding-left: 1.5em; margin: 0.4em 0; }
        .preview-content ol { list-style: decimal; padding-left: 1.5em; margin: 0.4em 0; }
        .preview-content li { margin: 0.15em 0; line-height: 1.65; color: #111827; }
        .preview-content table { border-collapse: collapse; width: 100%; margin: 0.75em 0; font-size: 0.875rem; }
        .preview-content th { background: #f8fafc; font-weight: 600; border: 1px solid #cbd5e1; padding: 0.4rem 0.6rem; text-align: left; }
        .preview-content td { border: 1px solid #cbd5e1; padding: 0.4rem 0.6rem; color: #111827; }
        .preview-content strong { font-weight: 700; }
        .preview-content em { font-style: italic; }
        .preview-content a { color: #2563eb; text-decoration: underline; }
        .preview-content figure { margin: 1.25em 0 1.5em; text-align: center; }
        .preview-content figure img { max-width: 100%; border-radius: 8px; border: 1px solid #e5e7eb; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        .preview-content figcaption { font-size: 0.75rem; color: #6b7280; margin-top: 0.5em; font-style: italic; }
        .preview-content blockquote { border-left: 4px solid #e5e7eb; padding-left: 1em; margin: 0.75em 0; font-style: italic; color: #6b7280; }
        .preview-content hr { border: none; border-top: 1px solid #e5e7eb; margin: 1em 0; }
        .preview-content code { background: #f1f5f9; padding: 0.1em 0.35em; border-radius: 3px; font-family: monospace; font-size: 0.875em; }
        .preview-content pre { background: #f1f5f9; padding: 1em; border-radius: 6px; overflow-x: auto; }
        .preview-content pre code { background: none; padding: 0; }
      `}</style>
    </div>
  );
}
