/**
 * PreviewOverlay.tsx
 * Lesson note preview rendered inside a Dialog — portal layout (sidebar + header) remains visible.
 */

import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { Printer } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { EnrichedNote } from '@/components/lesson-notes/lessonNoteShared';

export interface PreviewOverlayProps {
  open: boolean;
  title: string;
  content: string;
  settings: any;
  meta: { className: string; subjectName: string; termName: string };
  note: EnrichedNote | undefined;
  onClose: () => void;
}

export function PreviewOverlay({ open, title, content, settings, meta, onClose }: PreviewOverlayProps) {
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
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* Dialog header — title + print action */}
        <DialogHeader className="shrink-0 flex-row items-center justify-between border-b px-5 py-3 space-y-0">
          <DialogTitle className="text-sm font-semibold truncate pr-4">
            {title || 'Lesson Note Preview'}
          </DialogTitle>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 shrink-0 print:hidden"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            Print / Export PDF
          </Button>
        </DialogHeader>

        {/* Scrollable paper area */}
        <div className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-900 py-6 px-4 print:bg-white print:p-0 print:overflow-visible">
          <div className="bg-white shadow-md mx-auto w-full max-w-[794px] print:shadow-none print:w-full">

            {/* School header */}
            <div className="border-b border-gray-200 px-10 py-6 text-center">
              {settings?.schoolLogoUrl && (
                <img
                  src={settings.schoolLogoUrl}
                  alt="School Logo"
                  className="h-16 w-16 mx-auto mb-2 object-contain"
                />
              )}
              <p className="text-xl font-bold text-gray-900">
                {settings?.schoolName || 'School Name'}
              </p>
              {settings?.schoolAddress && (
                <p className="text-xs text-gray-500 mt-0.5">{settings.schoolAddress}</p>
              )}
              <div
                className="inline-block mt-3 border rounded px-3 py-1"
                style={{ background: `${brandColor}10`, borderColor: `${brandColor}40` }}
              >
                <span
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: brandColor }}
                >
                  Lesson Note
                </span>
              </div>
            </div>

            {/* Meta row */}
            {(meta.className || meta.subjectName || meta.termName) && (
              <div className="border-b border-gray-100 px-10 py-3 flex flex-wrap gap-6 text-xs text-gray-500">
                {meta.className   && <span><strong className="text-gray-700">Class:</strong> {meta.className}</span>}
                {meta.subjectName && <span><strong className="text-gray-700">Subject:</strong> {meta.subjectName}</span>}
                {meta.termName    && <span><strong className="text-gray-700">Term:</strong> {meta.termName}</span>}
              </div>
            )}

            {/* Content */}
            <div
              className="px-10 py-8 preview-content"
              style={{ '--preview-heading-color': brandColor } as React.CSSProperties}
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />

            {/* Footer */}
            <div className="border-t border-gray-100 px-10 py-4 flex items-center justify-between text-xs text-gray-400">
              <span>{settings?.schoolName || ''}</span>
              <span>{today}</span>
            </div>
          </div>
        </div>

      </DialogContent>

      <style>{`
        @media print {
          body > *:not([data-radix-dialog-content]) { display: none !important; }
          [data-radix-dialog-overlay] { display: none !important; }
          [data-radix-dialog-content] {
            position: static !important;
            max-width: none !important;
            height: auto !important;
            transform: none !important;
            box-shadow: none !important;
            border: none !important;
          }
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
    </Dialog>
  );
}
