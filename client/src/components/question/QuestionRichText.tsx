import { useCallback, useEffect, useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Mark } from "@tiptap/core";
import DOMPurify from "dompurify";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered,
  Undo2, Redo2, RemoveFormatting, Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon, Sigma,
} from "lucide-react";
import MathText from "@/components/shared/MathText";
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
  { label: "x²", insert: "x^{2}" },
  { label: "x₂", insert: "x_{2}" },
  { label: "a/b", insert: "\\frac{a}{b}" },
  { label: "√x", insert: "\\sqrt{x}" },
  { label: "π", insert: "\\pi" },
  { label: "θ", insert: "\\theta" },
  { label: "≤", insert: "\\leq" },
  { label: "≥", insert: "\\geq" },
  { label: "≠", insert: "\\neq" },
  { label: "≈", insert: "\\approx" },
  { label: "±", insert: "\\pm" },
  { label: "×", insert: "\\times" },
  { label: "÷", insert: "\\div" },
  { label: "°", insert: "\\degree" },
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
    <div className={`overflow-hidden rounded-md border border-input bg-background ${compact ? "question-rich-editor-compact" : ""} ${disabled ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-1.5 py-1">
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
        <label className="ml-auto flex items-center gap-1 text-xs text-muted-foreground" title="Insert formula or symbol">
          <Sigma className="h-3.5 w-3.5" />
          <select
            aria-label="Insert formula"
            defaultValue=""
            disabled={disabled}
            onChange={(event) => {
              const insert = FORMULA_INSERTS.find((item) => item.label === event.target.value)?.insert;
              if (insert) insertFormula(insert);
              event.target.value = "";
            }}
            className="h-7 rounded border border-input bg-background px-1 text-xs text-foreground"
          >
            <option value="">Formula</option>
            {FORMULA_INSERTS.map((item) => (
              <option key={item.label} value={item.label}>{item.label}</option>
            ))}
          </select>
        </label>
      </div>
      <EditorContent id={id} editor={editor} className="question-rich-editor px-3 py-2 text-sm" />
      <style>{`
        .question-rich-editor .tiptap { outline: none; white-space: pre-wrap; word-break: break-word; line-height: 1.6; }
        .question-rich-editor .tiptap p { margin: 0 0 0.35rem; }
        .question-rich-editor .tiptap p:last-child { margin-bottom: 0; }
        .question-rich-editor .tiptap ul { list-style: disc; padding-left: 1.25rem; margin: 0.25rem 0; }
        .question-rich-editor .tiptap ol { list-style: decimal; padding-left: 1.25rem; margin: 0.25rem 0; }
        .question-rich-editor .tiptap code { font-family: monospace; background: hsl(var(--muted)); padding: 0 0.2rem; border-radius: 0.2rem; }
         .question-rich-editor .tiptap p:only-child:empty::before { content: attr(data-placeholder); color: hsl(var(--muted-foreground)); pointer-events: none; }
         .question-rich-editor-compact .tiptap p { margin: 0; }
         .question-rich-editor-compact .tiptap { line-height: 1.4; }
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
