import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExt from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import { useRef, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Quote, Minus, Link as LinkIcon, Image as ImageIcon, Table as TableIcon,
  Undo, Redo, Heading1, Heading2, Heading3, Pilcrow, Highlighter, Type, Link2Off,
  Rows, Columns, Trash2,
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  disabled?: boolean;
}

function ToolbarBtn({
  onClick, active, disabled, title, children,
}: {
  onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onClick(); }}
          disabled={disabled}
          className={`inline-flex items-center justify-center w-8 h-8 rounded text-sm transition-colors
            ${active
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">{title}</TooltipContent>
    </Tooltip>
  );
}

function ToolbarSep() {
  return <div className="w-px h-5 bg-border mx-0.5 shrink-0" />;
}

export default function RichTextEditor({
  content, onChange, placeholder = 'Start writing…', minHeight = '320px', disabled = false,
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: { HTMLAttributes: { class: 'border-l-4 border-primary/40 pl-4 italic text-muted-foreground my-4' } },
        horizontalRule: { HTMLAttributes: { class: 'my-4 border-border' } },
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        bulletList: { HTMLAttributes: { class: 'list-disc pl-6 my-2 space-y-1' } },
        orderedList: { HTMLAttributes: { class: 'list-decimal pl-6 my-2 space-y-1' } },
        code: { HTMLAttributes: { class: 'bg-muted text-foreground px-1 py-0.5 rounded font-mono text-sm' } },
        codeBlock: { HTMLAttributes: { class: 'bg-muted p-4 rounded-lg font-mono text-sm my-4 overflow-x-auto' } },
      }),
      UnderlineExt,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({ HTMLAttributes: { class: 'max-w-full h-auto rounded-lg my-4 cursor-pointer' }, allowBase64: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline underline-offset-2 hover:opacity-80', target: '_blank', rel: 'noopener noreferrer' } }),
      Table.configure({ resizable: false, HTMLAttributes: { class: 'border-collapse table-auto w-full my-4' } }),
      TableRow,
      TableHeader.configure({ HTMLAttributes: { class: 'bg-muted font-semibold text-left px-3 py-2 border border-border text-sm' } }),
      TableCell.configure({ HTMLAttributes: { class: 'px-3 py-2 border border-border text-sm' } }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true, HTMLAttributes: { class: 'rounded px-0.5' } }),
    ],
    content: content || '',
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none px-6 py-4',
        style: `min-height: ${minHeight}`,
        'data-placeholder': placeholder,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  }, [disabled]);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '', false);
    }
  }, []);

  // Track the visual viewport so the floating toolbar sits above the mobile keyboard
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [vvBottom, setVvBottom] = useState(0);
  useEffect(() => {
    if (disabled) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const offset = window.innerHeight - (vv.height + vv.offsetTop);
      setVvBottom(Math.max(0, offset));
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [disabled]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor) return;
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('Image must be under 10 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (src) editor.chain().focus().setImage({ src, alt: file.name }).run();
    };
    reader.readAsDataURL(file);
  }, [editor]);

  const handleImageFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
    e.target.value = '';
  }, [handleImageUpload]);

  const handleImageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
    if (file) handleImageUpload(file);
  }, [handleImageUpload]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href || '';
    const url = window.prompt('Enter URL:', prev);
    if (url === null) return;
    if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank' }).run();
  }, [editor]);

  const insertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const setColor = useCallback((color: string) => {
    editor?.chain().focus().setColor(color).run();
  }, [editor]);

  const setHighlight = useCallback((color: string) => {
    editor?.chain().focus().toggleHighlight({ color }).run();
  }, [editor]);

  if (!editor) return null;

  const floatingToolbar = (
    <div
      ref={toolbarRef}
      className="fixed left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg px-2 py-1.5 flex flex-wrap items-center gap-0.5 transition-[bottom] duration-75"
      style={{ bottom: vvBottom }}
    >
      <ToolbarBtn title="Undo (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <Undo className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Redo (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        <Redo className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarSep />
      <ToolbarBtn title="Paragraph" onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')}>
        <Pilcrow className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Heading 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })}>
        <Heading1 className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })}>
        <Heading2 className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })}>
        <Heading3 className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarSep />
      <ToolbarBtn title="Bold (Ctrl+B)" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}>
        <Bold className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Italic (Ctrl+I)" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}>
        <Italic className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Underline (Ctrl+U)" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')}>
        <Underline className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')}>
        <Strikethrough className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarSep />
      <ToolbarBtn title="Align Left" onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })}>
        <AlignLeft className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Align Center" onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })}>
        <AlignCenter className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Align Right" onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })}>
        <AlignRight className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Justify" onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })}>
        <AlignJustify className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarSep />
      <ToolbarBtn title="Bullet List" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}>
        <List className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Numbered List" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}>
        <ListOrdered className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarSep />
      <ToolbarBtn title="Blockquote" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')}>
        <Quote className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn title="Horizontal Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarSep />
      <ToolbarBtn title="Insert Table" onClick={insertTable}>
        <TableIcon className="w-3.5 h-3.5" />
      </ToolbarBtn>
      {editor.isActive('table') && (
        <>
          <ToolbarBtn title="Add Row Below" onClick={() => editor.chain().focus().addRowAfter().run()}>
            <Rows className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Add Column After" onClick={() => editor.chain().focus().addColumnAfter().run()}>
            <Columns className="w-3.5 h-3.5" />
          </ToolbarBtn>
          <ToolbarBtn title="Delete Table" onClick={() => editor.chain().focus().deleteTable().run()}>
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </ToolbarBtn>
        </>
      )}
      <ToolbarSep />
      <ToolbarBtn title="Insert / Edit Link" onClick={setLink} active={editor.isActive('link')}>
        <LinkIcon className="w-3.5 h-3.5" />
      </ToolbarBtn>
      {editor.isActive('link') && (
        <ToolbarBtn title="Remove Link" onClick={() => editor.chain().focus().unsetLink().run()}>
          <Link2Off className="w-3.5 h-3.5" />
        </ToolbarBtn>
      )}
      <ToolbarSep />
      <ToolbarBtn title="Insert Image" onClick={() => fileInputRef.current?.click()}>
        <ImageIcon className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarSep />
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative inline-flex items-center">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setHighlight('#fef08a'); }}
              className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-muted transition-colors"
            >
              <Highlighter className="w-3.5 h-3.5" />
            </button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">Highlight</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">
            <label className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-muted cursor-pointer transition-colors">
              <Type className="w-3.5 h-3.5" />
              <input
                type="color"
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                onInput={(e) => setColor((e.target as HTMLInputElement).value)}
                defaultValue="#000000"
              />
            </label>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">Text Color</TooltipContent>
      </Tooltip>
    </div>
  );

  return (
    <>
      {/* Floating toolbar — rendered at document body level so it sits above the mobile keyboard */}
      {!disabled && createPortal(floatingToolbar, document.body)}

      <div className={`border rounded-lg overflow-hidden bg-background ${disabled ? 'opacity-70' : ''}`}>
        {/* Hidden file input for image upload */}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />

        {/* Editor content area — extra bottom padding keeps last line above the floating toolbar */}
        <div
          onDrop={handleImageDrop}
          onDragOver={(e) => e.preventDefault()}
          className="relative"
        >
          <EditorContent editor={editor} />
          {!disabled && <div className="h-24" />}
        </div>

        <style>{`
          .ProseMirror p.is-editor-empty:first-child::before {
            color: hsl(var(--muted-foreground));
            content: attr(data-placeholder);
            float: left;
            height: 0;
            pointer-events: none;
          }
          .ProseMirror h1 { font-size: 1.75rem; font-weight: 700; line-height: 1.2; margin: 1rem 0 0.5rem; }
          .ProseMirror h2 { font-size: 1.375rem; font-weight: 600; line-height: 1.3; margin: 0.875rem 0 0.4rem; }
          .ProseMirror h3 { font-size: 1.125rem; font-weight: 600; line-height: 1.4; margin: 0.75rem 0 0.35rem; }
          .ProseMirror h4 { font-size: 1rem;    font-weight: 600; line-height: 1.4; margin: 0.75rem 0 0.35rem; }
          .ProseMirror p { margin: 0.35rem 0; line-height: 1.65; }
          .ProseMirror ul, .ProseMirror ol { margin: 0.5rem 0 0.5rem 1.5rem; }
          .ProseMirror li { margin: 0.2rem 0; }
          .ProseMirror table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
          .ProseMirror td, .ProseMirror th { border: 1px solid hsl(var(--border)); padding: 0.5rem 0.75rem; min-width: 80px; }
          .ProseMirror th { background: hsl(var(--muted)); font-weight: 600; }
          .ProseMirror .selectedCell:after { background: hsl(var(--primary)/0.1); content: ""; left: 0; right: 0; top: 0; bottom: 0; pointer-events: none; position: absolute; }
          .ProseMirror .column-resize-handle { background-color: hsl(var(--primary)); bottom: -2px; position: absolute; right: -2px; pointer-events: none; top: 0; width: 4px; }
          .ProseMirror a { color: hsl(var(--primary)); text-decoration: underline; }
          .ProseMirror img { max-width: 100%; height: auto; border-radius: 0.5rem; margin: 0.75rem 0; display: block; }
          .ProseMirror img.ProseMirror-selectednode { outline: 2px solid hsl(var(--primary)); outline-offset: 2px; }
          .ProseMirror blockquote { border-left: 4px solid hsl(var(--primary)/0.4); padding-left: 1rem; margin: 0.75rem 0; font-style: italic; color: hsl(var(--muted-foreground)); }
          .ProseMirror hr { border: none; border-top: 1px solid hsl(var(--border)); margin: 1rem 0; }
          .ProseMirror code { background: hsl(var(--muted)); padding: 0.1em 0.3em; border-radius: 3px; font-family: monospace; font-size: 0.875em; }
          .ProseMirror pre { background: hsl(var(--muted)); padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
          .ProseMirror pre code { background: none; padding: 0; }
        `}</style>
      </div>
    </>
  );
}
