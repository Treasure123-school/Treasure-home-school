import DOMPurify from 'dompurify';
import { useMemo } from 'react';

interface RichTextViewerProps {
  html: string;
  className?: string;
}

export default function RichTextViewer({ html, className = '' }: RichTextViewerProps) {
  const safeHtml = useMemo(() => {
    if (!html) return '';
    return DOMPurify.sanitize(html, {
      ADD_TAGS: ['table', 'thead', 'tbody', 'tr', 'th', 'td', 'colgroup', 'col'],
      ADD_ATTR: [
        'target', 'rel', 'href', 'src', 'alt', 'width', 'height', 'style',
        'class', 'colspan', 'rowspan', 'align',
      ],
      ALLOW_DATA_ATTR: false,
    });
  }, [html]);

  return (
    <div
      className={`lesson-note-viewer prose prose-sm dark:prose-invert max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
