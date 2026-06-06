import DOMPurify from 'dompurify';
import { useMemo } from 'react';

interface RichTextViewerProps {
  html: string;
  className?: string;
  brandColor?: string;
}

export default function RichTextViewer({ html, className = '', brandColor = '#3b82f6' }: RichTextViewerProps) {
  const safeHtml = useMemo(() => {
    if (!html) return '';
    return DOMPurify.sanitize(html, {
      ADD_TAGS: [
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'colgroup', 'col',
        'figure', 'figcaption',
      ],
      ADD_ATTR: [
        'target', 'rel', 'href', 'src', 'alt', 'width', 'height', 'style',
        'class', 'colspan', 'rowspan', 'align',
      ],
      ALLOW_DATA_ATTR: false,
      FORCE_BODY: true,
    });
  }, [html]);

  return (
    <>
      <div
        className={`lesson-note-viewer prose prose-sm dark:prose-invert max-w-none ${className}`}
        style={{ '--viewer-heading-color': brandColor } as React.CSSProperties}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
      <style>{`
        @media print { body { background: white; } .lesson-note-viewer { color: black; } }
        .lesson-note-viewer { overflow-x: auto; }
        .lesson-note-viewer h1 { font-size: 1.75rem; font-weight: 700; line-height: 1.2; margin: 1rem 0 0.5rem; color: var(--viewer-heading-color, #3b82f6); }
        .lesson-note-viewer h2 { font-size: 1.375rem; font-weight: 600; line-height: 1.3; margin: 0.875rem 0 0.4rem; color: var(--viewer-heading-color, #3b82f6); }
        .lesson-note-viewer h3 { font-size: 1.125rem; font-weight: 600; line-height: 1.4; margin: 0.75rem 0 0.35rem; color: var(--viewer-heading-color, #3b82f6); }
        .lesson-note-viewer h4 { font-size: 1rem; font-weight: 600; line-height: 1.4; margin: 0.75rem 0 0.35rem; color: var(--viewer-heading-color, #3b82f6); }
        .lesson-note-viewer p { margin: 0.35rem 0; line-height: 1.65; }
        .lesson-note-viewer ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
        .lesson-note-viewer ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
        .lesson-note-viewer li { margin: 0.2rem 0; line-height: 1.6; }
        .lesson-note-viewer table { border-collapse: collapse; width: 100%; margin: 1rem 0; min-width: 320px; }
        .lesson-note-viewer td, .lesson-note-viewer th { border: 1px solid hsl(var(--border)); padding: 0.5rem 0.75rem; }
        .lesson-note-viewer th { background: hsl(var(--muted)); font-weight: 600; }
        .lesson-note-viewer a { color: hsl(var(--primary)); text-decoration: underline; }
        .lesson-note-viewer img { max-width: 100%; height: auto; border-radius: 0.5rem; margin: 0.75rem 0; display: block; }
        .lesson-note-viewer figure { margin: 1.25em 0 1.75em; text-align: center; }
        .lesson-note-viewer figure img { margin-left: auto; margin-right: auto; border: 1px solid #e5e7eb; box-shadow: 0 2px 16px rgba(0,0,0,0.09); }
        .lesson-note-viewer figcaption { font-size: 0.75rem; color: #6b7280; margin-top: 0.5em; font-style: italic; }
        .lesson-note-viewer blockquote { border-left: 4px solid hsl(var(--primary)/0.4); padding-left: 1rem; margin: 0.75rem 0; font-style: italic; color: hsl(var(--muted-foreground)); }
        .lesson-note-viewer hr { border: none; border-top: 1px solid hsl(var(--border)); margin: 1rem 0; }
        .lesson-note-viewer code { background: hsl(var(--muted)); padding: 0.1em 0.3em; border-radius: 3px; font-family: monospace; font-size: 0.875em; }
        .lesson-note-viewer pre { background: hsl(var(--muted)); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
        .lesson-note-viewer pre code { background: none; padding: 0; }
        .lesson-note-viewer strong { font-weight: 600; }
        .lesson-note-viewer em { font-style: italic; }
        .lesson-note-viewer u { text-decoration: underline; }
        .lesson-note-viewer s { text-decoration: line-through; }
      `}</style>
    </>
  );
}
