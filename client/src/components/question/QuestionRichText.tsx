import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Mark, type Editor } from "@tiptap/core";
import DOMPurify from "dompurify";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered,
  Undo2, Redo2, RemoveFormatting, Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon, Sigma, GripVertical,
} from "lucide-react";
import MathText from "@/components/shared/MathText";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { applyMathToTextNodes } from "@/lib/mathRender";
import "katex/dist/katex.min.css";

const SubscriptMark = Mark.create({
  name: "subscript",
  excludes: "superscript",
  parseHTML() { return [{ tag: "sub" }]; },
  renderHTML() { return ["sub", 0]; },
  addCommands() {
    return { toggleSubscript: () => ({ commands }: any) => commands.toggleMark(this.name) };
  },
});

const SuperscriptMark = Mark.create({
  name: "superscript",
  excludes: "subscript",
  parseHTML() { return [{ tag: "sup" }]; },
  renderHTML() { return ["sup", 0]; },
  addCommands() {
    return { toggleSuperscript: () => ({ commands }: any) => commands.toggleMark(this.name) };
  },
});

const ALLOWED_TAGS = ["p", "br", "strong", "b", "em", "i", "u", "s", "sub", "sup", "ul", "ol", "li", "code"];
const ALLOWED_ATTR: string[] = [];

const FORMULA_INSERTS = [
  { label: "x²", insert: "x²" },
  { label: "x₂", insert: "x₂" },
  { label: "a/b", insert: "a⁄b" },
  { label: "√x", insert: "√x" },
  { label: "π", insert: "π" },
  { label: "θ", insert: "θ" },
  { label: "≤", insert: "≤" },
  { label: "≥", insert: "≥" },
  { label: "≠", insert: "≠" },
  { label: "≈", insert: "≈" },
  { label: "±", insert: "±" },
  { label: "×", insert: "×" },
  { label: "÷", insert: "÷" },
  { label: "°", insert: "°" },
];

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeHtml(value: string): string {
  if (typeof document === "undefined") return value;
  const textarea = document.createElement("textarea");
  let decoded = value;
  for (let i = 0; i < 3; i++) {
    textarea.innerHTML = decoded;
    const next = textarea.value;
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

function sanitizeQuestionHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}

function inlineQuestionHtml(html: string): string {
  return html
    .replace(/<p\b[^>]*>/gi, "")
    .replace(/<\/p>/gi, "<br>")
    .replace(/<ul\b[^>]*>|<ol\b[^>]*>|<\/ul>|<\/ol>|<li\b[^>]*>/gi, "")
    .replace(/<\/li>/gi, "<br>")
    .replace(/(?:<br\s*\/?>)+$/i, "");
}

export function questionTextToHtml(value: string | null | undefined): string {
  const raw = decodeHtml(value || "");
  if (!raw) return "";
  if (looksLikeHtml(raw)) return sanitizeQuestionHtml(raw);
  return raw
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.split("\n").map((line) => escapeHtml(line)).join("<br>")}</p>`)
    .join("");
}

function prepareRichTextDisplayHtml(value: string | null | undefined, inline: boolean): string {
  const html = questionTextToHtml(value);
  if (!html) return "";
  const prepared = inline ? inlineQuestionHtml(html) : html;
  if (typeof document === "undefined") return prepared;
  const container = document.createElement(inline ? "span" : "div");
  container.innerHTML = prepared;
  delete container.dataset.mathApplied;
  applyMathToTextNodes(container);
  return container.innerHTML;
}

export function questionTextToPlainText(value: string | null | undefined): string {
  const raw = decodeHtml(value || "");
  if (!looksLikeHtml(raw)) return raw.trim();
  const doc = new DOMParser().parseFromString(sanitizeQuestionHtml(raw), "text/html");
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

function ToolbarButton({
  title, label, onClick, active, disabled, children,
}: {
  title: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-xs transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
      }`}
    >
      {children}
    </button>
  );
}

function FormulaSelect({
  disabled,
  onInsert,
  onOpenChange,
}: {
  disabled: boolean;
  onInsert: (insert: string) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <div data-formula-select className="flex items-center" onMouseDown={(event) => event.stopPropagation()}>
      <Select
        value={value}
        onValueChange={(next) => {
          setValue("");
          const insert = FORMULA_INSERTS.find((item) => item.label === next)?.insert;
          if (insert) onInsert(insert);
        }}
        onOpenChange={onOpenChange}
      >
        <SelectTrigger
          aria-label="Insert formula"
          title="Insert formula or symbol"
          disabled={disabled}
          className="h-7 w-auto gap-1 px-1.5 text-xs"
        >
          <Sigma className="h-3.5 w-3.5 shrink-0" />
          <SelectValue placeholder="Formula" />
        </SelectTrigger>
        <SelectContent className="max-h-64">
          {FORMULA_INSERTS.map((item) => (
            <SelectItem key={item.label} value={item.label}>{item.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function QuestionSelectionToolbar({
  editor,
  containerRef,
  compact,
  disabled,
  insertFormula,
}: {
  editor: Editor;
  containerRef: RefObject<HTMLElement | null>;
  compact: boolean;
  disabled: boolean;
  insertFormula: (insert: string) => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [customPos, setCustomPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const frozenRef = useRef(false);
  const customPosRef = useRef<{ top: number; left: number } | null>(null);
  const selectionKeyRef = useRef("");
  const dragRef = useRef<{ startX: number; startY: number; top: number; left: number } | null>(null);

  const clearCustomPos = useCallback(() => {
    customPosRef.current = null;
    setCustomPos(null);
  }, []);

  useEffect(() => {
    if (editor.isDestroyed) return;
    let frame = 0;

    const hide = () => {
      clearCustomPos();
      selectionKeyRef.current = "";
      setPos(null);
    };

    const updatePosition = () => {
      if (frozenRef.current || editor.isDestroyed) return;

      const container = containerRef.current;
      const selection = window.getSelection();
      if (!container || editor.state.selection.empty || !editor.isFocused) {
        hide();
        return;
      }
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        hide();
        return;
      }

      const range = selection.getRangeAt(0);
      const editorDom = editor.view.dom as HTMLElement;
      if (!editorDom.contains(range.commonAncestorContainer)) {
        hide();
        return;
      }

      const rect = range.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      if (!rect.width) {
        hide();
        return;
      }

      const selectionKey = `${editor.state.selection.from}:${editor.state.selection.to}`;
      if (selectionKeyRef.current !== selectionKey) {
        selectionKeyRef.current = selectionKey;
        clearCustomPos();
      }
      if (customPosRef.current) return;

      const estimatedWidth = compact ? 360 : 470;
      const visibleWidth = Math.min(estimatedWidth, containerRect.width - 8);
      const rawLeft = rect.left - containerRect.left + rect.width / 2 - visibleWidth / 2;
      const toolbarHeight = menuRef.current?.offsetHeight ?? 68;
      const aboveTop = rect.top - containerRect.top - toolbarHeight - 10;
      const belowTop = rect.bottom - containerRect.top + 10;
      setPos({
        top: aboveTop >= 4 ? aboveTop : belowTop,
        left: Math.max(4, Math.min(rawLeft, Math.max(4, containerRect.width - visibleWidth - 4))),
      });
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updatePosition);
    };

    editor.on("selectionUpdate", schedule);
    editor.on("blur", schedule);
    document.addEventListener("selectionchange", schedule);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);

    return () => {
      cancelAnimationFrame(frame);
      editor.off("selectionUpdate", schedule);
      editor.off("blur", schedule);
      document.removeEventListener("selectionchange", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [editor, containerRef, compact, clearCustomPos]);

  const startDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const origin = customPos || pos;
    if (!origin) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      top: origin.top,
      left: origin.left,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [customPos, pos]);

  const moveDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const container = containerRef.current;
    const menu = menuRef.current;
    if (!drag || !container || !menu) return;

    const containerRect = container.getBoundingClientRect();
    const minTop = 4 - containerRect.top;
    const minLeft = 4 - containerRect.left;
    const maxTop = window.innerHeight - menu.offsetHeight - 4 - containerRect.top;
    const maxLeft = window.innerWidth - menu.offsetWidth - 4 - containerRect.left;
    const next = {
      top: Math.max(minTop, Math.min(drag.top + event.clientY - drag.startY, Math.max(minTop, maxTop))),
      left: Math.max(minLeft, Math.min(drag.left + event.clientX - drag.startX, Math.max(minLeft, maxLeft))),
    };
    customPosRef.current = next;
    setCustomPos(next);
  }, [containerRef]);

  const endDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const displayPos = customPos || pos;
  if (!displayPos || disabled || editor.isDestroyed) return null;

  return (
    <div
      ref={menuRef}
      className="absolute z-50 flex flex-wrap items-center gap-0.5 rounded-md border border-border bg-popover px-1.5 py-1 text-popover-foreground shadow-lg"
      style={{ top: displayPos.top, left: displayPos.left, maxWidth: "calc(100vw - 16px)" }}
      onMouseDown={(event) => {
        if (!(event.target as HTMLElement).closest("[data-formula-select]")) event.preventDefault();
      }}
    >
      <button
        type="button"
        title="Move toolbar"
        aria-label="Move toolbar"
        className="inline-flex h-7 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing"
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <div className="mx-0.5 h-4 w-px bg-border" />
      {!compact && (
        <>
          <ToolbarButton title="Undo" label="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
            <Undo2 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Redo" label="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
            <Redo2 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <div className="mx-1 h-4 w-px bg-border" />
        </>
      )}
      <ToolbarButton title="Bold" label="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}>
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Italic" label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}>
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Underline" label="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")}>
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Strikethrough" label="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")}>
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarButton>
      <div className="mx-1 h-4 w-px bg-border" />
      <ToolbarButton title="Superscript" label="Superscript" onClick={() => (editor.chain().focus() as any).toggleSuperscript().run()} active={editor.isActive("superscript")}>
        <SuperscriptIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Subscript" label="Subscript" onClick={() => (editor.chain().focus() as any).toggleSubscript().run()} active={editor.isActive("subscript")}>
        <SubscriptIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton title="Clear formatting" label="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().run()}>
        <RemoveFormatting className="h-3.5 w-3.5" />
      </ToolbarButton>
      {!compact && (
        <>
          <div className="mx-1 h-4 w-px bg-border" />
          <ToolbarButton title="Bullet list" label="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}>
            <List className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Numbered list" label="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}>
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolbarButton>
        </>
      )}
      <div className="mx-1 h-4 w-px bg-border" />
      <FormulaSelect
        disabled={disabled}
        onInsert={insertFormula}
        onOpenChange={(open) => {
          frozenRef.current = open;
          if (!open) {
            clearCustomPos();
            setPos(null);
          }
        }}
      />
    </div>
  );
}

interface QuestionRichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  disabled?: boolean;
  id?: string;
  compact?: boolean;
}

export function QuestionRichTextEditor({
  value,
  onChange,
  placeholder = "Enter your question here…",
  minHeight = "96px",
  disabled = false,
  id,
  compact = false,
}: QuestionRichTextEditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editor = useEditor({
    extensions: [StarterKit, SubscriptMark, SuperscriptMark],
    content: questionTextToHtml(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        class: "tiptap focus:outline-none",
        "data-placeholder": placeholder,
        style: `min-height: ${minHeight}`,
      },
    },
    onUpdate: ({ editor: current }) => {
      if (current.isDestroyed) return;
      onChange(current.getText().trim() ? current.getHTML() : "");
    },
  }, [disabled]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const next = questionTextToHtml(value);
    const current = editor.getText().trim() ? editor.getHTML() : "";
    if (current !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, value]);

  const insertFormula = useCallback((insert: string) => {
    if (!editor || editor.isDestroyed) return;
    editor.chain().focus().insertContent(insert).run();
  }, [editor]);

  if (!editor || editor.isDestroyed) return null;

  return (
    <div ref={editorContainerRef} className={`${compact ? "relative question-rich-editor-compact" : "overflow-hidden"} rounded-md border border-input bg-background ${disabled ? "opacity-60" : ""}`}>
      {!compact && (
        <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-1.5 py-1">
          <ToolbarButton title="Undo" label="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
            <Undo2 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Redo" label="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
            <Redo2 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <div className="mx-1 h-4 w-px bg-border" />
          <ToolbarButton title="Bold" label="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}>
            <Bold className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Italic" label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}>
            <Italic className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Underline" label="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")}>
            <UnderlineIcon className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Strikethrough" label="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")}>
            <Strikethrough className="h-3.5 w-3.5" />
          </ToolbarButton>
          <div className="mx-1 h-4 w-px bg-border" />
          <ToolbarButton title="Superscript" label="Superscript" onClick={() => (editor.chain().focus() as any).toggleSuperscript().run()} active={editor.isActive("superscript")}>
            <SuperscriptIcon className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Subscript" label="Subscript" onClick={() => (editor.chain().focus() as any).toggleSubscript().run()} active={editor.isActive("subscript")}>
            <SubscriptIcon className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Clear formatting" label="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().run()}>
            <RemoveFormatting className="h-3.5 w-3.5" />
          </ToolbarButton>
          <div className="mx-1 h-4 w-px bg-border" />
          <ToolbarButton title="Bullet list" label="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}>
            <List className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Numbered list" label="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}>
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolbarButton>
          <div className="mx-1 h-4 w-px bg-border" />
          <div className="ml-auto">
            <FormulaSelect disabled={disabled} onInsert={insertFormula} />
          </div>
        </div>
      )}
      <EditorContent id={id} editor={editor} className={`question-rich-editor text-sm ${compact ? "rounded-b-md px-3 py-0" : "px-3 py-2"}`} />
      {compact && (
        <QuestionSelectionToolbar
          editor={editor}
          containerRef={editorContainerRef}
          compact={compact}
          disabled={disabled}
          insertFormula={insertFormula}
        />
      )}
      <style>{`
        .question-rich-editor .tiptap { outline: none; white-space: pre-wrap; word-break: break-word; line-height: 1.6; }
        .question-rich-editor .tiptap p { margin: 0 0 0.35rem; }
        .question-rich-editor .tiptap p:last-child { margin-bottom: 0; }
        .question-rich-editor .tiptap ul { list-style: disc; padding-left: 1.25rem; margin: 0.25rem 0; }
        .question-rich-editor .tiptap ol { list-style: decimal; padding-left: 1.25rem; margin: 0.25rem 0; }
        .question-rich-editor .tiptap code { font-family: monospace; background: hsl(var(--muted)); padding: 0 0.2rem; border-radius: 0.2rem; }
         .question-rich-editor .tiptap p:only-child:empty::before { content: attr(data-placeholder); color: hsl(var(--muted-foreground)); pointer-events: none; }
         .question-rich-editor-compact .tiptap p { margin: 0; }
         .question-rich-editor-compact .tiptap { display: flex; align-items: center; padding-top: 0; padding-bottom: 0; line-height: 1.4; }
      `}</style>
    </div>
  );
}

interface QuestionRichTextProps {
  text: string | null | undefined;
  className?: string;
  as?: "span" | "div" | "p";
}

export function QuestionRichText({ text, className, as = "span" }: QuestionRichTextProps) {
  const raw = text || "";
  const html = useMemo(() => prepareRichTextDisplayHtml(raw, as === "span"), [raw, as]);

  if (!html) {
    return <MathText text={raw} className={className} as={as} />;
  }

  const Tag = as as any;
  return (
    <Tag
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
