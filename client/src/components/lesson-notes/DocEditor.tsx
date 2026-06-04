/**
 * DocEditor — full-page rich document editor (Google Docs / Notion style)
 * Tiptap v3 — BubbleMenu was removed; replaced with a custom floating toolbar.
 * NEVER pass [disabled] as a dep to useEditor (causes commandManager crash).
 */

import { useEffect, useRef, useCallback, useState } from 'react';
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
import Color from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link as LinkIcon, Link2Off, Image as ImageIcon, Minus, Undo, Redo,
  Table as TableIcon, Rows, Columns, Trash2, Highlighter,
  ChevronDown, Baseline, Type,
} from 'lucide-react';

// ── Custom FontSize extension ──────────────────────────────────────────────

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.fontSize || null,
          renderHTML: (attrs: any) => attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }: any) =>
        chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize: () => ({ chain }: any) =>
        chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

// ── Drag-drop / paste image handler ──────────────────────────────────────

const DropPaste = Extension.create({
  name: 'dropPaste',
  addProseMirrorPlugins() {
    const handleFile = (file: File, view: any) => {
      if (!file.type.startsWith('image/')) return false;
      if (file.size > 15 * 1024 * 1024) return false;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target?.result as string;
        if (!src) return;
        const node = view.state.schema.nodes.image?.create({ src, alt: file.name });
        if (!node) return;
        view.dispatch(view.state.tr.replaceSelectionWith(node));
      };
      reader.readAsDataURL(file);
      return true;
    };
    return [
      new Plugin({
        props: {
          handleDrop(view: any, event: DragEvent) {
            const file = Array.from(event.dataTransfer?.files ?? []).find((f: any) => f.type.startsWith('image/')) as File | undefined;
            if (!file) return false;
            event.preventDefault();
            return handleFile(file, view);
          },
          handlePaste(view: any, event: ClipboardEvent) {
            const file = Array.from(event.clipboardData?.files ?? []).find((f: any) => f.type.startsWith('image/')) as File | undefined;
            if (!file) return false;
            return handleFile(file, view);
          },
        },
      }),
    ];
  },
});

// ── Toolbar helpers ────────────────────────────────────────────────────────

function TBtn({
  title, onClick, active, disabled, children, danger, small,
}: {
  title: string; onClick: () => void; active?: boolean;
  disabled?: boolean; children: React.ReactNode; danger?: boolean; small?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); if (!disabled) onClick(); }}
          disabled={disabled}
          className={[
            'inline-flex items-center justify-center rounded transition-colors select-none shrink-0',
            small ? 'h-6 w-6 text-xs' : 'h-7 w-7 text-sm',
            disabled ? 'opacity-30 cursor-not-allowed' :
            active ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' :
            danger ? 'hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500' :
            'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300',
          ].join(' ')}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs z-[100]">{title}</TooltipContent>
    </Tooltip>
  );
}

function TSep({ small }: { small?: boolean }) {
  return <div className={`bg-gray-200 dark:bg-gray-600 mx-0.5 shrink-0 ${small ? 'w-px h-4' : 'w-px h-5'}`} />;
}

function TSelect({
  value, onChange, options, width = 'w-24', title,
}: {
  value: string; onChange: (v: string) => void;
  options: { label: string; value: string }[]; width?: string; title: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`relative ${width} shrink-0`}>
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            onMouseDown={e => e.stopPropagation()}
            title={title}
            className="w-full h-7 pl-2 pr-6 text-xs rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 appearance-none cursor-pointer hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
          >
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs z-[100]">{title}</TooltipContent>
    </Tooltip>
  );
}

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
];

const FONT_SIZES = [
  '10px', '11px', '12px', '13px', '14px', '15px', '16px', '18px',
  '20px', '22px', '24px', '28px', '32px', '36px', '48px', '60px', '72px',
].map(s => ({ label: s.replace('px', ''), value: s }));

const TEXT_COLORS = [
  '#000000', '#374151', '#6b7280', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#ffffff',
];

const HIGHLIGHT_COLORS = [
  '#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#fed7aa', '#e9d5ff',
];

// ── Color Picker ──────────────────────────────────────────────────────────

function ColorPicker({ value, colors, onChange, icon: Icon, title }: {
  value: string; colors: string[]; onChange: (c: string) => void; icon: any; title: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative shrink-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); setOpen(o => !o); }}
            className="inline-flex flex-col items-center justify-center h-7 w-7 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Icon className="h-3.5 w-3.5 text-gray-700 dark:text-gray-300" />
            <div className="w-4 h-1 rounded-sm mt-0.5 border border-gray-200 dark:border-gray-600" style={{ background: value || '#000' }} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs z-[100]">{title}</TooltipContent>
      </Tooltip>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-[100] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-2.5">
          <div className="grid grid-cols-6 gap-1.5">
            {colors.map(c => (
              <button key={c} type="button"
                onMouseDown={e => { e.preventDefault(); onChange(c); setOpen(false); }}
                className="w-6 h-6 rounded border border-gray-200 dark:border-gray-600 hover:scale-110 transition-transform"
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Custom:</span>
            <input type="color" value={value || '#000000'}
              onChange={e => onChange(e.target.value)}
              className="w-7 h-7 rounded cursor-pointer border border-gray-200 p-0.5 bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Floating selection toolbar (replaces BubbleMenu removed in Tiptap v3) ──

function FloatingSelectionMenu({ editor }: { editor: any }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!editor) return;

    const updatePosition = () => {
      const { state } = editor;
      const { selection } = state;
      if (selection.empty || editor.isDestroyed) { setPos(null); return; }

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { setPos(null); return; }

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!rect.width) { setPos(null); return; }

      // Find the editor's paper container for relative positioning
      const editorEl = editor.view.dom as HTMLElement;
      const paperEl = editorEl.closest('.doc-paper') as HTMLElement | null;
      if (!paperEl) return;
      containerRef.current = paperEl;

      const paperRect = paperEl.getBoundingClientRect();
      setPos({
        top: rect.top - paperRect.top - 44, // 44 = menu height + 8px gap
        left: Math.max(0, rect.left - paperRect.left + rect.width / 2 - 150), // center on selection
      });
    };

    const onSelectionChange = () => {
      // Small delay so the selection is stable
      requestAnimationFrame(updatePosition);
    };

    editor.on('selectionUpdate', onSelectionChange);
    document.addEventListener('selectionchange', onSelectionChange);
    return () => {
      editor.off('selectionUpdate', onSelectionChange);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [editor]);

  if (!pos || !editor || editor.isDestroyed) return null;

  const applyLink = () => {
    if (linkUrl) editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl, target: '_blank' }).run();
    setShowLink(false);
    setLinkUrl('');
  };

  return (
    <div
      ref={menuRef}
      className="absolute z-50 flex items-center gap-0.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-1.5 py-1 pointer-events-auto"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={e => e.preventDefault()}
    >
      {showLink ? (
        <div className="flex items-center gap-1 px-1">
          <input
            autoFocus value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') applyLink(); if (e.key === 'Escape') setShowLink(false); }}
            placeholder="https://…"
            className="text-xs border border-gray-200 rounded px-2 py-1 w-44 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <button onMouseDown={e => { e.preventDefault(); applyLink(); }}
            className="text-xs bg-blue-600 text-white rounded px-2 py-1 hover:bg-blue-700">OK</button>
          <button onMouseDown={e => { e.preventDefault(); setShowLink(false); }}
            className="text-xs text-gray-500 hover:text-gray-700 px-1 leading-none">✕</button>
        </div>
      ) : (
        <>
          <TBtn small title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}><Bold className="h-3 w-3" /></TBtn>
          <TBtn small title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}><Italic className="h-3 w-3" /></TBtn>
          <TBtn small title="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')}><Underline className="h-3 w-3" /></TBtn>
          <TBtn small title="Strike" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')}><Strikethrough className="h-3 w-3" /></TBtn>
          <TSep small />
          <TBtn small title="Highlight" onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')}><Highlighter className="h-3 w-3" /></TBtn>
          <TSep small />
          <TBtn small title="Link" onClick={() => { setLinkUrl(editor.getAttributes('link').href || ''); setShowLink(true); }} active={editor.isActive('link')}><LinkIcon className="h-3 w-3" /></TBtn>
          {editor.isActive('link') && <TBtn small title="Remove Link" onClick={() => editor.chain().focus().unsetLink().run()}><Link2Off className="h-3 w-3" /></TBtn>}
        </>
      )}
    </div>
  );
}

// ── Word / character count ─────────────────────────────────────────────────

function countWords(html: string): { words: number; chars: number; readingTime: string } {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return { words: 0, chars: 0, readingTime: '< 1 min' };
  const words = text.split(/\s+/).filter(Boolean).length;
  const chars = text.replace(/\s/g, '').length;
  const mins = Math.max(1, Math.round(words / 200));
  const readingTime = mins === 1 ? '~1 min read' : `~${mins} min read`;
  return { words, chars, readingTime };
}

// ── Main DocEditor component ───────────────────────────────────────────────

export interface DocEditorProps {
  content: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onEditorReady?: (editor: any) => void;
}

export default function DocEditor({ content, onChange, disabled = false, placeholder, onEditorReady }: DocEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null!);
  const [textColor, setTextColor] = useState('#000000');
  const [hlColor, setHlColor] = useState('#fef08a');
  const [wordStats, setWordStats] = useState(() => countWords(content));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        bulletList: { HTMLAttributes: { class: 'doc-ul' } },
        orderedList: { HTMLAttributes: { class: 'doc-ol' } },
        horizontalRule: { HTMLAttributes: { class: 'doc-hr' } },
      }),
      UnderlineExt,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'doc-link' } }),
      Image.configure({ HTMLAttributes: { class: 'doc-img' }, allowBase64: true }),
      Table.configure({ resizable: true, HTMLAttributes: { class: 'doc-table' } }),
      TableRow,
      TableHeader.configure({ HTMLAttributes: { class: 'doc-th' } }),
      TableCell.configure({ HTMLAttributes: { class: 'doc-td' } }),
      DropPaste,
    ],
    content: content || '',
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'doc-root focus:outline-none',
        ...(placeholder ? { 'data-placeholder': placeholder } : {}),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
      setWordStats(countWords(html));
    },
    onCreate: ({ editor }) => { onEditorReady?.(editor); },
  });

  // Sync disabled without recreating editor (Tiptap v3 pattern)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  // Sync content changed externally (AI generation, etc.)
  const prevContent = useRef(content);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (content !== prevContent.current) {
      prevContent.current = content;
      if (!editor.isFocused) {
        try { editor.commands.setContent(content || '', false); } catch { /* transitional */ }
        setWordStats(countWords(content));
      }
    }
  }, [content, editor]);

  const e = editor && !editor.isDestroyed ? editor : null;

  const insertImage = useCallback((file: File) => {
    if (!e) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target?.result as string;
      if (src) e.chain().focus().setImage({ src, alt: file.name }).run();
    };
    reader.readAsDataURL(file);
  }, [e]);

  const insertLink = useCallback(() => {
    if (!e) return;
    const prev = e.getAttributes('link').href || '';
    const url = window.prompt('Enter URL:', prev);
    if (url === null) return;
    if (url === '') { e.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
    e.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank' }).run();
  }, [e]);

  const getCurrentHeading = () => {
    if (!e) return 'p';
    for (const l of [1, 2, 3, 4] as const) { if (e.isActive('heading', { level: l })) return `h${l}`; }
    return 'p';
  };

  const setBlock = (val: string) => {
    if (!e) return;
    if (val === 'p') e.chain().focus().setParagraph().run();
    else e.chain().focus().toggleHeading({ level: parseInt(val.slice(1)) as 1|2|3|4 }).run();
  };

  if (!editor) {
    return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm bg-gray-100 dark:bg-gray-950">Loading editor…</div>;
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Formatting Toolbar ── */}
      {!disabled && (
        <div className="shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          {/* Row 1: History · Block style · Font · Size · Colors */}
          <div className="flex items-center flex-wrap gap-0.5 px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
            <TBtn title="Undo (Ctrl+Z)" onClick={() => e?.chain().focus().undo().run()} disabled={!e?.can().undo()}>
              <Undo className="h-3.5 w-3.5" />
            </TBtn>
            <TBtn title="Redo (Ctrl+Y)" onClick={() => e?.chain().focus().redo().run()} disabled={!e?.can().redo()}>
              <Redo className="h-3.5 w-3.5" />
            </TBtn>
            <TSep />
            <TSelect title="Block style" value={getCurrentHeading()} width="w-32" onChange={setBlock}
              options={[
                { label: 'Paragraph', value: 'p' },
                { label: 'Heading 1', value: 'h1' },
                { label: 'Heading 2', value: 'h2' },
                { label: 'Heading 3', value: 'h3' },
                { label: 'Heading 4', value: 'h4' },
              ]}
            />
            <TSep />
            <TSelect title="Font family" value={e?.getAttributes('textStyle')?.fontFamily || ''} width="w-36" onChange={v =>
              v ? e?.chain().focus().setFontFamily(v).run() : e?.chain().focus().unsetFontFamily().run()
            } options={FONT_FAMILIES} />
            <TSep />
            <TSelect title="Font size" value={e?.getAttributes('textStyle')?.fontSize || ''} width="w-16" onChange={v =>
              v ? e?.chain().focus().setFontSize(v).run() : e?.chain().focus().unsetFontSize().run()
            } options={[{ label: 'Size', value: '' }, ...FONT_SIZES]} />
            <TSep />
            <ColorPicker title="Text color" icon={Baseline} value={textColor} colors={TEXT_COLORS}
              onChange={c => { setTextColor(c); e?.chain().focus().setColor(c).run(); }} />
            <ColorPicker title="Highlight color" icon={Highlighter} value={hlColor} colors={HIGHLIGHT_COLORS}
              onChange={c => { setHlColor(c); e?.chain().focus().toggleHighlight({ color: c }).run(); }} />
          </div>

          {/* Row 2: Formatting · Alignment · Lists · Insert */}
          <div className="flex items-center flex-wrap gap-0.5 px-3 py-1">
            <TBtn title="Bold (Ctrl+B)" onClick={() => e?.chain().focus().toggleBold().run()} active={!!e?.isActive('bold')}><Bold className="h-3.5 w-3.5" /></TBtn>
            <TBtn title="Italic (Ctrl+I)" onClick={() => e?.chain().focus().toggleItalic().run()} active={!!e?.isActive('italic')}><Italic className="h-3.5 w-3.5" /></TBtn>
            <TBtn title="Underline (Ctrl+U)" onClick={() => e?.chain().focus().toggleUnderline().run()} active={!!e?.isActive('underline')}><Underline className="h-3.5 w-3.5" /></TBtn>
            <TBtn title="Strikethrough" onClick={() => e?.chain().focus().toggleStrike().run()} active={!!e?.isActive('strike')}><Strikethrough className="h-3.5 w-3.5" /></TBtn>
            <TSep />
            <TBtn title="Align Left" onClick={() => e?.chain().focus().setTextAlign('left').run()} active={!!e?.isActive({ textAlign: 'left' })}><AlignLeft className="h-3.5 w-3.5" /></TBtn>
            <TBtn title="Align Center" onClick={() => e?.chain().focus().setTextAlign('center').run()} active={!!e?.isActive({ textAlign: 'center' })}><AlignCenter className="h-3.5 w-3.5" /></TBtn>
            <TBtn title="Align Right" onClick={() => e?.chain().focus().setTextAlign('right').run()} active={!!e?.isActive({ textAlign: 'right' })}><AlignRight className="h-3.5 w-3.5" /></TBtn>
            <TBtn title="Justify" onClick={() => e?.chain().focus().setTextAlign('justify').run()} active={!!e?.isActive({ textAlign: 'justify' })}><AlignJustify className="h-3.5 w-3.5" /></TBtn>
            <TSep />
            <TBtn title="Bullet List" onClick={() => e?.chain().focus().toggleBulletList().run()} active={!!e?.isActive('bulletList')}><List className="h-3.5 w-3.5" /></TBtn>
            <TBtn title="Numbered List" onClick={() => e?.chain().focus().toggleOrderedList().run()} active={!!e?.isActive('orderedList')}><ListOrdered className="h-3.5 w-3.5" /></TBtn>
            <TSep />
            <TBtn title="Insert / Edit Link" onClick={insertLink} active={!!e?.isActive('link')}><LinkIcon className="h-3.5 w-3.5" /></TBtn>
            {e?.isActive('link') && <TBtn title="Remove Link" onClick={() => e.chain().focus().unsetLink().run()}><Link2Off className="h-3.5 w-3.5" /></TBtn>}
            <TBtn title="Insert Image" onClick={() => imageInputRef.current?.click()}><ImageIcon className="h-3.5 w-3.5" /></TBtn>
            <TBtn title="Horizontal Rule" onClick={() => e?.chain().focus().setHorizontalRule().run()}><Minus className="h-3.5 w-3.5" /></TBtn>
            <TSep />
            <TBtn title="Insert Table (3×3)" onClick={() => e?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
              <TableIcon className="h-3.5 w-3.5" />
            </TBtn>
            {e?.isActive('table') && (
              <>
                <TBtn title="Add Row Below" onClick={() => e.chain().focus().addRowAfter().run()}><Rows className="h-3.5 w-3.5" /></TBtn>
                <TBtn title="Add Column After" onClick={() => e.chain().focus().addColumnAfter().run()}><Columns className="h-3.5 w-3.5" /></TBtn>
                <TBtn title="Delete Table" onClick={() => e.chain().focus().deleteTable().run()} danger><Trash2 className="h-3.5 w-3.5" /></TBtn>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Hidden file input ── */}
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
        onChange={ev => { const f = ev.target.files?.[0]; if (f) insertImage(f); ev.target.value = ''; }} />

      {/* ── Editor canvas ── */}
      <div className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-950 min-h-0">
        <div className="min-h-full py-8 px-4 flex justify-center">
          <div
            className="doc-paper relative w-full max-w-4xl bg-white dark:bg-gray-900 shadow-md border border-gray-200 dark:border-gray-700 min-h-[1056px] px-16 py-14"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            {/* Floating selection toolbar */}
            {e && !disabled && <FloatingSelectionMenu editor={e} />}

            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* ── Status bar: word count + reading time ── */}
      <div className="shrink-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-5 py-1.5 flex items-center gap-4">
        <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
          <Type className="h-3 w-3" />
          <span><strong className="text-gray-600 dark:text-gray-300">{wordStats.words.toLocaleString()}</strong> words</span>
          <span className="text-gray-300 dark:text-gray-600 mx-1">·</span>
          <span><strong className="text-gray-600 dark:text-gray-300">{wordStats.chars.toLocaleString()}</strong> characters</span>
          <span className="text-gray-300 dark:text-gray-600 mx-1">·</span>
          <span>{wordStats.readingTime}</span>
        </div>
      </div>

      {/* ── Editor styles ── */}
      <style>{`
        /* Placeholder */
        .doc-root p.is-editor-empty:first-child::before {
          color: #9ca3af; content: attr(data-placeholder);
          float: left; height: 0; pointer-events: none; font-style: italic;
        }

        /* Typography */
        .doc-root { min-height: 200px; }
        .doc-root > * + * { margin-top: 0.4em; }
        .doc-root p  { line-height: 1.75; font-size: 1rem; margin: 0 0 0.35em; }
        .doc-root h1 { font-size: 2rem;   font-weight: 700; margin: 1.1em 0 0.4em; line-height: 1.25; }
        .doc-root h2 { font-size: 1.5rem; font-weight: 700; margin: 0.9em 0 0.3em; line-height: 1.3; }
        .doc-root h3 { font-size: 1.2rem; font-weight: 600; margin: 0.8em 0 0.25em; }
        .doc-root h4 { font-size: 1.05rem; font-weight: 600; margin: 0.7em 0 0.2em; }
        .doc-root strong { font-weight: 700; }
        .doc-root em    { font-style: italic; }
        .doc-root u     { text-decoration: underline; }
        .doc-root s     { text-decoration: line-through; }
        .doc-root blockquote {
          border-left: 4px solid #3b82f6; padding-left: 1em;
          margin: 0.75em 0; color: #6b7280; font-style: italic;
        }

        /* Lists */
        .doc-root .doc-ul { list-style: disc;    padding-left: 1.75em; margin: 0.4em 0; }
        .doc-root .doc-ol { list-style: decimal; padding-left: 1.75em; margin: 0.4em 0; }
        .doc-root li { margin: 0.2em 0; line-height: 1.7; }
        .doc-root li > p { margin: 0; }

        /* Links */
        .doc-root .doc-link { color: #2563eb; text-decoration: underline; cursor: pointer; }
        .doc-root .doc-link:hover { color: #1d4ed8; }

        /* Images */
        .doc-root .doc-img {
          max-width: 100%; height: auto; display: block;
          margin: 0.75em auto; border-radius: 0.375rem;
          box-shadow: 0 1px 4px rgba(0,0,0,0.12);
        }
        .doc-root .doc-img.ProseMirror-selectednode {
          outline: 2px solid #3b82f6; outline-offset: 2px;
        }

        /* HR */
        .doc-root .doc-hr { border: none; border-top: 2px solid #e5e7eb; margin: 1.25em 0; }

        /* Table */
        .doc-root .doc-table { border-collapse: collapse; width: 100%; margin: 0.75em 0; font-size: 0.9rem; }
        .doc-root .doc-th {
          background: #f8fafc; font-weight: 600; text-align: left;
          border: 1px solid #cbd5e1; padding: 0.5rem 0.75rem; font-size: 0.85rem;
        }
        .doc-root .doc-td { border: 1px solid #cbd5e1; padding: 0.45rem 0.75rem; vertical-align: top; min-width: 4em; }
        .doc-root .selectedCell:after {
          background: rgba(59,130,246,0.1); content: "";
          position: absolute; inset: 0; pointer-events: none;
        }
        .doc-root .column-resize-handle {
          background-color: #3b82f6; bottom: -2px; pointer-events: none;
          position: absolute; right: -2px; top: 0; width: 4px;
        }
        .tableWrapper { overflow-x: auto; }
        .resize-cursor { cursor: col-resize; }

        /* Dark mode */
        .dark .doc-root .doc-th { background: #1e293b; border-color: #334155; }
        .dark .doc-root .doc-td { border-color: #334155; }
        .dark .doc-root .doc-hr { border-top-color: #374151; }
        .dark .doc-root .doc-link { color: #60a5fa; }
        .dark .doc-root blockquote { border-left-color: #3b82f6; color: #9ca3af; }

        /* Mobile */
        @media (max-width: 640px) {
          .doc-paper { padding: 2rem 1.25rem !important; min-height: unset !important; }
          .doc-root h1 { font-size: 1.6rem; }
          .doc-root h2 { font-size: 1.3rem; }
        }

        /* Print */
        @media print {
          .doc-paper { box-shadow: none; border: none; min-height: unset !important; }
        }
      `}</style>
    </div>
  );
}
