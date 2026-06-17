import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExt from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';

export interface SectionEditorHandle {
  getHTML: () => string;
}

interface SectionEditorProps {
  content: string;
  onChange: (html: string) => void;
  onFocused: (editor: any) => void;
  onBlurred?: () => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: string;
  enableTable?: boolean;
  enableImage?: boolean;
  genKey?: number;
}

export default function SectionEditor({
  content,
  onChange,
  onFocused,
  onBlurred,
  placeholder = 'Type here…',
  disabled = false,
  minHeight = '72px',
  enableTable = false,
  enableImage = false,
}: SectionEditorProps) {
  const extensions = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      bulletList: { HTMLAttributes: { class: 'se-ul' } },
      orderedList: { HTMLAttributes: { class: 'se-ol' } },
      horizontalRule: { HTMLAttributes: { class: 'se-hr' } },
    }),
    UnderlineExt,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Link.configure({ openOnClick: false, HTMLAttributes: { class: 'se-link' } }),
    ...(enableImage
      ? [Image.configure({ HTMLAttributes: { class: 'se-img' }, allowBase64: true })]
      : []),
    ...(enableTable
      ? [
          Table.configure({ resizable: false, HTMLAttributes: { class: 'se-table' } }),
          TableRow,
          TableHeader.configure({ HTMLAttributes: { class: 'se-th' } }),
          TableCell.configure({ HTMLAttributes: { class: 'se-td' } }),
        ]
      : []),
  ];

  // Do NOT pass [disabled] as deps — that's a Tiptap v2 pattern that causes
  // editor destroy/recreate cycles in v3, which sets commandManager to null
  // mid-flight and causes "Cannot read properties of null (reading 'commands')".
  const editor = useEditor({
    extensions,
    content: content || '',
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'se-root focus:outline-none',
        style: `min-height:${minHeight}`,
        'data-placeholder': placeholder,
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onFocus: ({ editor }) => onFocused(editor),
    onBlur: () => onBlurred?.(),
  });

  // Handle disabled changes without recreating the editor
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  const prevContent = useRef(content);
  useEffect(() => {
    // Guard: editor must exist and must not be in a destroyed/transitional state
    if (!editor || editor.isDestroyed) return;
    if (content !== prevContent.current) {
      prevContent.current = content;
      if (!editor.isFocused) {
        try {
          editor.commands.setContent(content || '');
        } catch {
          // Editor may be in a transitional state; ignore and let next render handle it
        }
      }
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <>
      <EditorContent editor={editor} />
      <style>{`
        .se-root p.is-editor-empty:first-child::before {
          color: #9ca3af; content: attr(data-placeholder); float: left;
          height: 0; pointer-events: none; font-style: italic;
        }
        .se-root p          { margin: 0.25rem 0; line-height: 1.7; font-size: 0.9rem; }
        .se-root h1         { font-size: 1.4rem; font-weight: 700; margin: 0.6rem 0 0.3rem; }
        .se-root h2         { font-size: 1.2rem; font-weight: 600; margin: 0.5rem 0 0.25rem; }
        .se-root h3         { font-size: 1.05rem; font-weight: 600; margin: 0.4rem 0 0.2rem; }
        .se-root .se-ul     { list-style: disc; padding-left: 1.4rem; margin: 0.25rem 0; }
        .se-root .se-ol     { list-style: decimal; padding-left: 1.4rem; margin: 0.25rem 0; }
        .se-root li         { margin: 0.1rem 0; font-size: 0.9rem; line-height: 1.65; }
        .se-root .se-link   { color: #2563eb; text-decoration: underline; }
        .se-root .se-img    { max-width: 100%; height: auto; border-radius: 0.5rem; margin: 0.5rem 0; display: block; }
        .se-root .se-hr     { border: none; border-top: 1px solid #e5e7eb; margin: 0.6rem 0; }
        .se-root strong     { font-weight: 600; }
        .se-root em         { font-style: italic; }
        .se-root u          { text-decoration: underline; }
        .se-root blockquote { border-left: 3px solid #3b82f6; padding-left: 0.75rem; margin: 0.4rem 0; color: #6b7280; font-style: italic; }
        .se-root .se-table  { border-collapse: collapse; width: 100%; margin: 0.6rem 0; font-size: 0.875rem; }
        .se-root .se-th     { background: #f9fafb; font-weight: 600; text-align: left; border: 1px solid #d1d5db; padding: 0.4rem 0.6rem; }
        .se-root .se-td     { border: 1px solid #d1d5db; padding: 0.4rem 0.6rem; }
        .se-root .selectedCell:after { background: rgba(59,130,246,0.08); content: ""; position: absolute; left:0;right:0;top:0;bottom:0; pointer-events:none; }
      `}</style>
    </>
  );
}
