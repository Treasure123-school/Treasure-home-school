import { memo, useMemo } from "react";
import { getMathSegments, renderKatexHtml } from "@/lib/mathRender";
import "katex/dist/katex.min.css";

interface MathTextProps {
  /** Raw question text, option text, explanation, etc. May contain plain
   *  scientific shorthand (x^2, H2O, 3/4, log10(x)...) and/or literal LaTeX
   *  ($...$, $$...$$, \( ... \), \[ ... \]). Both are auto-detected. */
  text: string | null | undefined;
  className?: string;
  /** Render as a block-level element instead of inline span. */
  as?: "span" | "div" | "p";
}

/**
 * Reusable renderer for mathematical & scientific notation across the CBT
 * exam system (questions, options, explanations, passages, review/result
 * pages). Falls back to plain text for ordinary prose — only recognized
 * math/science patterns are sent through KaTeX.
 */
function MathTextInner({ text, className, as = "span" }: MathTextProps) {
  const segments = useMemo(() => getMathSegments(text || ""), [text]);
  const Tag = as as any;

  if (!text) return null;

  // Nothing math-like detected — render as plain text (cheapest path, no HTML).
  if (segments.length <= 1 && segments[0]?.type === "text") {
    return <Tag className={className}>{segments[0]?.content ?? ""}</Tag>;
  }

  return (
    <Tag className={className}>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return <span key={i}>{seg.content}</span>;
        }
        const html = renderKatexHtml(seg.content, !!seg.display);
        return seg.display ? (
          <span
            key={i}
            className="math-display-wrapper block my-1 overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
        );
      })}
    </Tag>
  );
}

const MathText = memo(MathTextInner);
export default MathText;
