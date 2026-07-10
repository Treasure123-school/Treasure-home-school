/**
 * Math/Science text rendering utilities.
 *
 * Detects LaTeX delimiters ($...$, $$...$$, \( ... \), \[ ... \]) as well as
 * common "plain text" mathematical/scientific shorthand (x^2, H2O, log10(x),
 * 3/4, x_(1), etc.) and converts everything into a list of segments that can
 * be rendered with KaTeX, without touching ordinary prose.
 *
 * This module has ZERO React dependency so it can be reused by both the
 * <MathText /> component (client/src/components/shared/MathText.tsx) and by
 * DOM-based post-processing (e.g. RichTextViewer, which walks rendered HTML
 * text nodes for legacy lesson-note content).
 */
import katex from "katex";

export interface MathSegment {
  type: "text" | "math";
  content: string; // raw text, or LaTeX source (for math segments)
  display?: boolean; // block/display mode vs inline
}

// ---------------------------------------------------------------------------
// Auto-detection: turn plain-text shorthand into LaTeX source
// ---------------------------------------------------------------------------

// Common 1-2 letter element symbols. Used to avoid mangling ordinary words
// like "A4" or "COVID19" into fake chemical formulas.
const ELEMENT_SYMBOLS = new Set([
  "H","He","Li","Be","B","C","N","O","F","Ne","Na","Mg","Al","Si","P","S","Cl","Ar",
  "K","Ca","Sc","Ti","V","Cr","Mn","Fe","Co","Ni","Cu","Zn","Ga","Ge","As","Se","Br","Kr",
  "Rb","Sr","Y","Zr","Nb","Mo","Tc","Ru","Rh","Pd","Ag","Cd","In","Sn","Sb","Te","I","Xe",
  "Cs","Ba","La","Ce","Pr","Nd","Pm","Sm","Eu","Gd","Tb","Dy","Ho","Er","Tm","Yb","Lu",
  "Hf","Ta","W","Re","Os","Ir","Pt","Au","Hg","Tl","Pb","Bi","Po","At","Rn",
]);

// Matches a chemical-formula-looking token, e.g. H2O, CO2, SO4, NaCl2, Ca(OH)2
const CHEM_TOKEN_RE = /^(?:[A-Z][a-z]?\d*|\(|\))+$/;

function looksLikeChemicalFormula(token: string): boolean {
  if (!CHEM_TOKEN_RE.test(token)) return false;
  const elementMatches = token.match(/[A-Z][a-z]?/g) || [];
  if (elementMatches.length < 1) return false;
  // Every letter-group must be a recognized element symbol.
  const allKnown = elementMatches.every((el) => ELEMENT_SYMBOLS.has(el));
  const hasDigit = /\d/.test(token);
  return allKnown && (hasDigit || elementMatches.length > 1);
}

function chemicalFormulaToLatex(formula: string, charge = ""): string {
  // Convert digits following letters/parens into subscripts
  let latex = formula.replace(/(\d+)/g, "_{$1}");
  if (charge) {
    latex += `^{${charge}}`;
  }
  return latex;
}

// Chemical formula with optional trailing ionic charge, e.g. SO4^2-, OH^-, H2O
const CHEM_WITH_CHARGE_RE = /\b([A-Z][A-Za-z0-9()]*\d[A-Za-z0-9()]*)(\^\d*[+\-])?/g;
// Superscript: x^2, x^{2+3}, 10^5, a^n, x^-1 (base = trailing alnum run before ^)
const SUPERSCRIPT_RE = /([A-Za-zπθαβγΔΣ0-9)\]]+)\^(\{[^{}]+\}|-?[A-Za-z0-9]+)/g;
// Subscript: x_1, x_(1), x_{ij}
const SUBSCRIPT_RE = /([A-Za-z]+)_(\{[^{}]+\}|\([^()]+\)|[A-Za-z0-9]+)/g;
// log with explicit base and a simple (non-nested) argument: log10(x), log2(n)
const LOG_BASE_RE = /\blog(\d+)\(([^()]*)\)/g;
// Standalone simple fraction, e.g. "3/4" (not part of a date or URL)
const FRACTION_RE = /(?<![\w.\/])(\d+)\/(\d+)(?![\w.\/])/g;

/**
 * Runs `replacer` only on the portions of `text` that are NOT already inside
 * a $...$ math span, so earlier passes never get double-processed.
 */
// Matches any already-delimited LaTeX span so auto-tagging never rewrites
// content the author/teacher already wrote as explicit LaTeX.
const EXISTING_DELIMITER_RE = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g;

function isExistingDelimitedSpan(part: string): boolean {
  return (
    (part.startsWith("$") && part.endsWith("$") && part.length >= 4) ||
    (part.startsWith("\\[") && part.endsWith("\\]")) ||
    (part.startsWith("\\(") && part.endsWith("\\)")) ||
    (part.startsWith("$") && part.endsWith("$") && part.length >= 2)
  );
}

function applyOutsideMath(text: string, replacer: (chunk: string) => string): string {
  return text
    .split(EXISTING_DELIMITER_RE)
    .map((part) => (isExistingDelimitedSpan(part) ? part : replacer(part)))
    .join("");
}

/**
 * Scans a plain (non-LaTeX-delimited) chunk of text and wraps any detected
 * math/science shorthand in $...$ so it can be split out as math segments.
 *
 * Order matters: chemical formulas (which may themselves contain digits and
 * a trailing ^charge) are detected first, before the generic superscript
 * pass would otherwise mis-split them.
 */
export function autoTagMath(text: string): string {
  if (!text) return text;

  let out = text;

  // 1. Chemical formulas (with optional trailing ionic charge) first.
  out = applyOutsideMath(out, (chunk) =>
    chunk.replace(CHEM_WITH_CHARGE_RE, (whole, formula, charge) => {
      if (!looksLikeChemicalFormula(formula)) return whole;
      const latex = chemicalFormulaToLatex(formula, charge ? charge.slice(1) : "");
      return `$${latex}$`;
    })
  );

  // 2. log with explicit numeric base, e.g. log10(x) -> \log_{10}(x)
  out = applyOutsideMath(out, (chunk) =>
    chunk.replace(LOG_BASE_RE, (_m, base, arg) => `$\\log_{${base}}(${arg})$`)
  );

  // 3. Generic superscripts / subscripts on whatever's left.
  out = applyOutsideMath(out, (chunk) =>
    chunk.replace(SUPERSCRIPT_RE, (_m, base, exp) => {
      const cleanExp = exp.replace(/^\{|\}$/g, "");
      return `$${base}^{${cleanExp}}$`;
    })
  );
  out = applyOutsideMath(out, (chunk) =>
    chunk.replace(SUBSCRIPT_RE, (_m, base, sub) => {
      const cleanSub = sub.replace(/^[{(]|[)}]$/g, "");
      return `$${base}_{${cleanSub}}$`;
    })
  );

  // 4. Standalone simple fractions, e.g. 3/4 -> \frac{3}{4}
  out = applyOutsideMath(out, (chunk) =>
    chunk.replace(FRACTION_RE, (_m, a, b) => `$\\frac{${a}}{${b}}$`)
  );

  return out;
}

// ---------------------------------------------------------------------------
// Segment splitting: turn a string (possibly already containing literal
// LaTeX delimiters, or now containing our auto-tagged $...$ spans) into an
// ordered list of text/math segments.
// ---------------------------------------------------------------------------

export function splitMathSegments(rawText: string): MathSegment[] {
  if (!rawText) return [];

  const tagged = autoTagMath(rawText);

  const parts = tagged.split(EXISTING_DELIMITER_RE).filter((p) => p !== "");
  return parts.map((part): MathSegment => {
    if (part.startsWith("$$") && part.endsWith("$$")) {
      return { type: "math", content: part.slice(2, -2), display: true };
    }
    if (part.startsWith("\\[") && part.endsWith("\\]")) {
      return { type: "math", content: part.slice(2, -2), display: true };
    }
    if (part.startsWith("\\(") && part.endsWith("\\)")) {
      return { type: "math", content: part.slice(2, -2), display: false };
    }
    if (part.startsWith("$") && part.endsWith("$") && part.length > 1) {
      return { type: "math", content: part.slice(1, -1), display: false };
    }
    return { type: "text", content: part };
  });
}

// ---------------------------------------------------------------------------
// KaTeX rendering with a small in-memory cache (segments are frequently
// re-rendered identically across question lists, review pages, etc.)
// ---------------------------------------------------------------------------

const katexCache = new Map<string, string>();
const KATEX_CACHE_LIMIT = 1000;

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderKatexHtml(latex: string, display: boolean): string {
  const key = (display ? "D:" : "I:") + latex;
  const cached = katexCache.get(key);
  if (cached !== undefined) return cached;

  let html: string;
  try {
    html = katex.renderToString(latex, {
      throwOnError: false,
      displayMode: display,
      output: "html",
      strict: "ignore",
    });
  } catch {
    // KaTeX couldn't parse this at all — never inject the raw LaTeX source
    // unescaped (it flows into dangerouslySetInnerHTML/innerHTML sinks), so
    // HTML-escape it and fall back to plain text rendering.
    html = escapeHtml(latex);
  }

  if (katexCache.size >= KATEX_CACHE_LIMIT) {
    const firstKey = katexCache.keys().next().value;
    if (firstKey !== undefined) katexCache.delete(firstKey);
  }
  katexCache.set(key, html);
  return html;
}

// ---------------------------------------------------------------------------
// Segment-list cache: the full pipeline (autoTagMath + splitMathSegments)
// keyed by raw input text, since exam questions/options are re-rendered
// often (navigating between questions, review pages, result pages).
// ---------------------------------------------------------------------------

const segmentCache = new Map<string, MathSegment[]>();
const SEGMENT_CACHE_LIMIT = 1000;

export function getMathSegments(rawText: string): MathSegment[] {
  if (!rawText) return [];
  const cached = segmentCache.get(rawText);
  if (cached) return cached;

  const segments = splitMathSegments(rawText);

  if (segmentCache.size >= SEGMENT_CACHE_LIMIT) {
    const firstKey = segmentCache.keys().next().value;
    if (firstKey !== undefined) segmentCache.delete(firstKey);
  }
  segmentCache.set(rawText, segments);
  return segments;
}

// ---------------------------------------------------------------------------
// Bulk pre-warming: eagerly compute segments + KaTeX HTML for a batch of raw
// strings (e.g. every question/option/explanation in an exam) so that later
// synchronous reads via getMathSegments/renderKatexHtml are pure cache hits.
// Safe to call repeatedly — everything here is idempotent and memoized.
// ---------------------------------------------------------------------------

export function prewarmMathCache(texts: Array<string | null | undefined>): void {
  for (const raw of texts) {
    if (!raw) continue;
    const segments = getMathSegments(raw);
    for (const seg of segments) {
      if (seg.type === "math") {
        renderKatexHtml(seg.content, !!seg.display);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// DOM post-processing: for already-rendered HTML content (e.g. rich-text
// lesson notes inserted via dangerouslySetInnerHTML), walk text nodes and
// replace math-like runs with rendered KaTeX, leaving markup/attributes and
// ordinary prose untouched. Safe to call repeatedly (idempotent via a marker
// attribute on the container).
// ---------------------------------------------------------------------------

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA"]);

export function applyMathToTextNodes(root: HTMLElement): void {
  if (root.dataset.mathApplied === "1") return;
  root.dataset.mathApplied = "1";

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parentTag = node.parentElement?.tagName;
      if (parentTag && SKIP_TAGS.has(parentTag)) return NodeFilter.FILTER_REJECT;
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const raw = textNode.nodeValue || "";
    const segments = getMathSegments(raw);
    if (segments.length <= 1 && segments[0]?.type === "text") continue; // nothing to do

    const fragment = document.createDocumentFragment();
    for (const seg of segments) {
      if (seg.type === "text") {
        fragment.appendChild(document.createTextNode(seg.content));
      } else {
        const span = document.createElement("span");
        if (seg.display) span.className = "math-display-wrapper";
        span.innerHTML = renderKatexHtml(seg.content, !!seg.display);
        fragment.appendChild(span);
      }
    }
    textNode.parentNode?.replaceChild(fragment, textNode);
  }
}
