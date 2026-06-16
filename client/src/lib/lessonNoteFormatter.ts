/**
 * Smart Lesson Note Formatter
 * Converts plain-text or lightly-structured HTML pasted into the editor
 * into rich Tiptap-compatible HTML with proper headings, lists, tables,
 * chemistry subscripts, equation blocks, callout blocks, and MCQ blocks.
 *
 * Rules:
 *  1. Known heading keywords → <h2>
 *  2. Numbered items          → <ol><li>
 *  3. Bullet items            → <ul><li>
 *  4. Pipe / aligned tables   → <table>
 *  5. Chemistry formulas      → subscripted text
 *  6. Equation lines          → styled equation block
 *  7. Callout keywords        → highlighted blockquote
 *  8. MCQ questions           → structured question block
 *  9. Preserves all original content — never removes text.
 */

export interface FormatStats {
  headings: number;
  orderedLists: number;
  unorderedLists: number;
  tables: number;
  equations: number;
  callouts: number;
  mcqBlocks: number;
  chemFormulas: number;
}

// ── Heading detection ──────────────────────────────────────────────────────

const HEADING_PATTERNS: RegExp[] = [
  /^(LEARNING\s+OBJECTIVES?)\s*:?\s*$/i,
  /^(SECTION\s+[A-Z0-9]+)\s*:?\s*$/i,
  /^(SUMMARY)\s*:?\s*$/i,
  /^(ASSIGNMENT(?:\s*\/\s*HOMEWORK)?)\s*:?\s*$/i,
  /^(EVALUATION(?:\s*\/\s*CLASSWORK)?)\s*:?\s*$/i,
  /^(REFERENCES?)\s*:?\s*$/i,
  /^(INTRODUCTION(?:\s*\/?\s*SET\s+INDUCTION)?)\s*:?\s*$/i,
  /^(PREVIOUS\s+KNOWLEDGE)\s*:?\s*$/i,
  /^(INSTRUCTIONAL\s+MATERIALS?)\s*:?\s*$/i,
  /^(LESSON\s+CONTENT)\s*:?\s*$/i,
  /^(TEACHER['']?S?\s+ACTIVIT(?:Y|IES))\s*:?\s*$/i,
  /^(STUDENT['']?S?\s+ACTIVIT(?:Y|IES))\s*:?\s*$/i,
  /^(OBJECTIVES?)\s*:?\s*$/i,
  /^(CONCLUSION)\s*:?\s*$/i,
  /^(BEHAVIORAL\s+OBJECTIVES?)\s*:?\s*$/i,
  /^(PERFORMANCE\s+OBJECTIVES?)\s*:?\s*$/i,
  /^(WEEK\s+\d+)\s*:?\s*$/i,
  /^(TOPIC)\s*:?\s*$/i,
  /^(SUBJECT\s+MATTER)\s*:?\s*$/i,
  /^(\d+\.\s+[A-Z][A-Z\s]{3,})\s*$/,        // "1. LESSON OBJECTIVES" style
];

function isHeading(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 80) return false;
  if (HEADING_PATTERNS.some(p => p.test(t))) return true;
  // All-caps line that's short enough to be a heading
  if (/^[A-Z][A-Z\s'\/\-–:]{4,60}$/.test(t) && !/[a-z]/.test(t)) return true;
  return false;
}

// ── Chemistry formula detection & subscripting ─────────────────────────────

// Known multi-char element symbols (to avoid false-positives)
const ELEMENTS = new Set([
  'He','Li','Be','Ne','Na','Mg','Al','Si','Cl','Ar','Ca','Sc','Ti','Cr','Mn','Fe',
  'Co','Ni','Cu','Zn','Ga','Ge','As','Se','Br','Kr','Rb','Sr','Zr','Nb','Mo','Tc',
  'Ru','Rh','Pd','Ag','Cd','In','Sn','Sb','Te','Xe','Cs','Ba','La','Ce','Pr','Nd',
  'Pm','Sm','Eu','Gd','Tb','Dy','Ho','Er','Tm','Yb','Lu','Hf','Ta','Re','Os','Ir',
  'Pt','Au','Hg','Tl','Pb','Bi','Po','At','Rn','Fr','Ra','Ac','Th','Pa','Np','Pu',
  'Am','Cm','Bk','Cf','Es','Fm','Md','No','Lr',
  // Single-char elements (for context)
  'H','B','C','N','O','F','P','S','K','V','W','U','I','Y',
]);

/**
 * Detect if a token looks like a chemical formula.
 * Must start with uppercase, contain at least one digit after a letter.
 */
function isChemFormula(token: string): boolean {
  if (!/^[A-Z]/.test(token)) return false;
  if (!/[A-Za-z]\d/.test(token)) return false;
  if (/^[0-9]/.test(token)) return false;
  // Must contain only element-valid chars
  if (!/^[A-Za-z0-9()[\]+\-]+$/.test(token)) return false;
  // Must have at least 2 chars and a digit
  return token.length >= 2 && /\d/.test(token);
}

/**
 * Apply subscripts to digits within a confirmed chemical formula.
 * H2SO4 → H<sub>2</sub>SO<sub>4</sub>
 */
function subscriptFormula(formula: string): string {
  // Handle parenthesized groups like Ca(OH)2 → Ca(OH)<sub>2</sub>
  return formula.replace(/([A-Za-z)\]])(\d+)/g, '$1<sub>$2</sub>');
}

/**
 * Apply chemistry subscripts throughout a line of text.
 * Returns [modified text, number of substitutions made].
 */
function applyChemistry(text: string): [string, number] {
  let count = 0;
  // Match word-boundary tokens that could be chemical formulas
  const result = text.replace(/\b([A-Z][a-zA-Z0-9()[\]]*\d[a-zA-Z0-9()[\]]*)\b/g, (match) => {
    if (isChemFormula(match)) {
      count++;
      return subscriptFormula(match);
    }
    return match;
  });
  return [result, count];
}

// ── Equation detection ─────────────────────────────────────────────────────

const EQUATION_RE = /(?:->|→|⟶|⇌|⇒|=>|\+\s*[A-Z])/;
const CHEM_LINE_RE = /\b(?:HCl|NaOH|H2|CO2|H2O|NH3|SO4|NO3|KOH|CaCO3|H2SO4|HNO3|Fe|Cu|Mg|Zn|Al|Na|Ca|KCl|NaCl|AgNO3)\b/i;

function isEquationLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  // Contains reaction arrow
  if (EQUATION_RE.test(t)) return true;
  // Looks like a balanced equation: contains + sign with chemical tokens on both sides
  if (/[A-Z][a-z]?\d*\s*\+\s*[A-Z]/.test(t) && CHEM_LINE_RE.test(t)) return true;
  return false;
}

function formatEquation(line: string): string {
  // Replace -> with proper arrow, apply subscripts
  let eq = line.trim()
    .replace(/->/g, '→')
    .replace(/=>/g, '⇒')
    .replace(/<=>/g, '⇌');
  const [subbed] = applyChemistry(eq);
  return subbed;
}

// ── Callout detection ──────────────────────────────────────────────────────

const CALLOUT_PATTERNS: { re: RegExp; type: 'note' | 'example' | 'important' | 'warning' }[] = [
  { re: /^note\s*:/i,      type: 'note' },
  { re: /^example\s*:/i,   type: 'example' },
  { re: /^important\s*:/i, type: 'important' },
  { re: /^warning\s*:/i,   type: 'warning' },
  { re: /^caution\s*:/i,   type: 'warning' },
  { re: /^remember\s*:/i,  type: 'note' },
];

const CALLOUT_STYLES: Record<string, { border: string; bg: string; color: string; label: string }> = {
  note:      { border: '#3b82f6', bg: '#eff6ff', color: '#1e40af', label: '📝 Note' },
  example:   { border: '#10b981', bg: '#ecfdf5', color: '#065f46', label: '💡 Example' },
  important: { border: '#f59e0b', bg: '#fffbeb', color: '#92400e', label: '⚠️ Important' },
  warning:   { border: '#ef4444', bg: '#fef2f2', color: '#991b1b', label: '🚨 Warning' },
};

function detectCallout(line: string): { type: string; content: string } | null {
  const t = line.trim();
  for (const { re, type } of CALLOUT_PATTERNS) {
    if (re.test(t)) {
      const content = t.replace(re, '').trim();
      return { type, content };
    }
  }
  return null;
}

// ── Bullet / numbered list detection ──────────────────────────────────────

function isBullet(line: string): boolean {
  return /^\s*[-•*◦▪▸►]\s+.+/.test(line);
}

function isNumbered(line: string): boolean {
  return /^\s*\d+[.)]\s+.+/.test(line);
}

function isLetterOption(line: string): boolean {
  return /^\s*[A-Ea-e][.)]\s+.+/.test(line);
}

// ── Table detection ────────────────────────────────────────────────────────

function isPipeLine(line: string): boolean {
  return (line.match(/\|/g) || []).length >= 2;
}

function isTabSeparated(line: string): boolean {
  return (line.match(/\t/g) || []).length >= 1 && line.trim().length > 0;
}

function isSeparatorRow(line: string): boolean {
  return /^\s*[\-|+:=]{3,}\s*$/.test(line.replace(/\|/g, '').trim());
}

// ── MCQ detection ─────────────────────────────────────────────────────────

function looksLikeMCQ(lines: string[]): boolean {
  const optionCount = lines.filter(l => isLetterOption(l)).length;
  return optionCount >= 2;
}

// ── HTML helpers ───────────────────────────────────────────────────────────

function escHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// ── Block types ────────────────────────────────────────────────────────────

type Block =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'ordered_list'; items: string[] }
  | { type: 'unordered_list'; items: string[] }
  | { type: 'pipe_table'; rows: string[][] }
  | { type: 'equation'; text: string }
  | { type: 'callout'; calloutType: string; label: string; content: string }
  | { type: 'mcq'; question: string; options: string[] }
  | { type: 'blank' };

// ── Main parser ────────────────────────────────────────────────────────────

function parseLines(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    // Skip fully blank lines
    if (!line) {
      // Emit a visual break only if previous block isn't already blank
      if (blocks.length > 0 && blocks[blocks.length - 1].type !== 'blank') {
        blocks.push({ type: 'blank' });
      }
      i++;
      continue;
    }

    // Heading
    if (isHeading(line)) {
      blocks.push({ type: 'heading', text: line });
      i++;
      continue;
    }

    // Callout (single-line: "Note: some text")
    const callout = detectCallout(line);
    if (callout) {
      const style = CALLOUT_STYLES[callout.type];
      blocks.push({
        type: 'callout',
        calloutType: callout.type,
        label: style.label,
        content: callout.content,
      });
      i++;
      continue;
    }

    // Pipe table — collect all consecutive pipe rows
    if (isPipeLine(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && (isPipeLine(lines[i].trim()) || isSeparatorRow(lines[i].trim()) || (tableLines.length > 0 && lines[i].trim() === ''))) {
        if (lines[i].trim() !== '') tableLines.push(lines[i]);
        i++;
        if (tableLines.length > 0 && i < lines.length && !isPipeLine(lines[i].trim()) && !isSeparatorRow(lines[i].trim())) break;
      }
      const rows = tableLines
        .filter(l => !isSeparatorRow(l.trim()))
        .map(l => l.split('|').map(cell => cell.trim()).filter((_, idx, arr) => idx > 0 || arr[0] !== '').filter(Boolean));
      if (rows.length > 0) {
        blocks.push({ type: 'pipe_table', rows });
      }
      continue;
    }

    // Tab-separated table
    if (isTabSeparated(line)) {
      const tableLines: string[] = [];
      while (i < lines.length && (isTabSeparated(lines[i]) || (tableLines.length > 0 && lines[i].trim() === ''))) {
        if (lines[i].trim() !== '') tableLines.push(lines[i]);
        i++;
        if (tableLines.length > 0 && i < lines.length && !isTabSeparated(lines[i])) break;
      }
      if (tableLines.length >= 2) {
        const rows = tableLines.map(l => l.split('\t').map(c => c.trim()));
        blocks.push({ type: 'pipe_table', rows });
        continue;
      }
      // If not enough rows, fall through to process them as paragraphs
      for (const tl of tableLines) {
        blocks.push({ type: 'paragraph', text: tl.trim() });
      }
      continue;
    }

    // Ordered list — collect consecutive numbered items
    if (isNumbered(line)) {
      const items: string[] = [];
      while (i < lines.length && (isNumbered(lines[i].trim()) || (items.length > 0 && lines[i].trim() !== '' && !isHeading(lines[i].trim()) && !isNumbered(lines[i].trim()) && !isBullet(lines[i].trim())))) {
        const t = lines[i].trim();
        if (!t) break;
        if (isNumbered(t)) {
          items.push(t.replace(/^\s*\d+[.)]\s*/, ''));
        } else if (items.length > 0 && !isHeading(t)) {
          // Continuation of previous item
          items[items.length - 1] += ' ' + t;
        } else {
          break;
        }
        i++;
      }
      if (items.length > 0) {
        // Check if this is an MCQ block: question already in previous block + these are A) B) C) D) options
        // We'll handle MCQ in a lookahead below, this handles plain numbered lists
        blocks.push({ type: 'ordered_list', items });
      }
      continue;
    }

    // Unordered list — collect consecutive bullet items
    if (isBullet(line)) {
      const items: string[] = [];
      while (i < lines.length && isBullet(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\s*[-•*◦▪▸►]\s+/, ''));
        i++;
      }
      if (items.length > 0) {
        blocks.push({ type: 'unordered_list', items });
      }
      continue;
    }

    // MCQ detection: a paragraph question followed by A) B) C) D) options
    {
      // Look ahead for letter options
      const question = line;
      const lookahead = lines.slice(i + 1, i + 6);
      if (looksLikeMCQ(lookahead)) {
        const options: string[] = [];
        let j = i + 1;
        while (j < lines.length && isLetterOption(lines[j].trim())) {
          options.push(lines[j].trim());
          j++;
        }
        blocks.push({ type: 'mcq', question, options });
        i = j;
        continue;
      }
    }

    // Equation
    if (isEquationLine(line)) {
      blocks.push({ type: 'equation', text: line });
      i++;
      continue;
    }

    // Paragraph — collect continuation lines
    {
      let text = line;
      i++;
      // Merge following continuation lines (non-blank, non-structural)
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !isHeading(lines[i].trim()) &&
        !isBullet(lines[i].trim()) &&
        !isNumbered(lines[i].trim()) &&
        !isPipeLine(lines[i].trim()) &&
        !isEquationLine(lines[i].trim()) &&
        !detectCallout(lines[i].trim()) &&
        !isLetterOption(lines[i].trim())
      ) {
        text += ' ' + lines[i].trim();
        i++;
      }
      blocks.push({ type: 'paragraph', text });
    }
  }

  return blocks;
}

// ── Block → HTML renderers ─────────────────────────────────────────────────

function renderText(text: string, stats: FormatStats): string {
  const [result, count] = applyChemistry(escHtml(text));
  stats.chemFormulas += count;
  // Convert arrows
  return result.replace(/->/g, '→').replace(/<=>/g, '⇌');
}

function renderBlock(block: Block, stats: FormatStats): string {
  switch (block.type) {

    case 'blank':
      return '';

    case 'heading': {
      stats.headings++;
      return `<h2>${renderText(block.text, stats)}</h2>`;
    }

    case 'paragraph': {
      // Check if it's actually an equation inline
      if (isEquationLine(block.text)) {
        stats.equations++;
        return renderEquationBlock(block.text, stats);
      }
      return `<p>${renderText(block.text, stats)}</p>`;
    }

    case 'ordered_list': {
      stats.orderedLists++;
      const items = block.items.map(item => `<li><p>${renderText(item, stats)}</p></li>`).join('');
      return `<ol>${items}</ol>`;
    }

    case 'unordered_list': {
      stats.unorderedLists++;
      const items = block.items.map(item => `<li><p>${renderText(item, stats)}</p></li>`).join('');
      return `<ul>${items}</ul>`;
    }

    case 'pipe_table': {
      stats.tables++;
      return renderTable(block.rows, stats);
    }

    case 'equation': {
      stats.equations++;
      return renderEquationBlock(block.text, stats);
    }

    case 'callout': {
      stats.callouts++;
      const style = CALLOUT_STYLES[block.calloutType] || CALLOUT_STYLES['note'];
      const body = block.content ? renderText(block.content, stats) : '';
      return `<blockquote style="border-left:4px solid ${style.border};background:${style.bg};padding:0.75em 1em;margin:0.75em 0;border-radius:0 6px 6px 0"><p style="margin:0;font-weight:600;color:${style.color}">${style.label}</p>${body ? `<p style="margin:0.25em 0 0;color:${style.color}">${body}</p>` : ''}</blockquote>`;
    }

    case 'mcq': {
      stats.mcqBlocks++;
      const q = renderText(block.question, stats);
      const opts = block.options.map(opt => {
        const letter = opt.match(/^([A-Ea-e])[.)]/)?.[1]?.toUpperCase() || '';
        const text = opt.replace(/^[A-Ea-e][.)]\s*/, '');
        return `<li style="margin:0.2em 0"><strong>${letter})</strong> ${renderText(text, stats)}</li>`;
      }).join('');
      return `<p><strong>${q}</strong></p><ul style="list-style:none;padding-left:1.5em">${opts}</ul>`;
    }
  }
}

function renderEquationBlock(text: string, stats: FormatStats): string {
  const eq = formatEquation(text);
  return `<blockquote style="border-left:4px solid #6366f1;background:#f5f3ff;padding:0.6em 1em;margin:0.75em 0;border-radius:0 6px 6px 0;font-family:monospace;font-size:1rem;color:#3730a3">${eq}</blockquote>`;
}

function renderTable(rows: string[][], stats: FormatStats): string {
  if (rows.length === 0) return '';
  const [header, ...body] = rows;
  const thead = `<thead><tr>${header.map(cell => `<th style="background:#f8fafc;font-weight:600;text-align:left;border:1px solid #cbd5e1;padding:0.5rem 0.75rem">${renderText(cell, stats)}</th>`).join('')}</tr></thead>`;
  const tbody = body.map(row => {
    const cells = row.map(cell => `<td style="border:1px solid #cbd5e1;padding:0.45rem 0.75rem;vertical-align:top">${renderText(cell, stats)}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  return `<table style="border-collapse:collapse;width:100%;margin:0.75em 0;font-size:0.9rem">${thead}<tbody>${tbody}</tbody></table>`;
}

// ── Main entry point ───────────────────────────────────────────────────────

export interface FormatterResult {
  html: string;
  stats: FormatStats;
}

/**
 * Analyse + format raw text/HTML content.
 * Accepts the current Tiptap HTML (or raw pasted text) and returns
 * formatted HTML + statistics about what was detected and converted.
 */
export function formatLessonNote(input: string): FormatterResult {
  const stats: FormatStats = {
    headings: 0,
    orderedLists: 0,
    unorderedLists: 0,
    tables: 0,
    equations: 0,
    callouts: 0,
    mcqBlocks: 0,
    chemFormulas: 0,
  };

  if (!input || !input.trim()) {
    return { html: '', stats };
  }

  // Strip HTML to plain text for re-parsing
  const plain = stripTags(input);

  // Split into lines, normalise line endings
  const lines = plain
    .split(/\r?\n/)
    .map(l => l.replace(/\t/g, '  '));   // keep tabs for tab-tables but normalise

  // Re-split for tabs
  const expandedLines: string[] = [];
  for (const line of lines) {
    expandedLines.push(line);
  }

  const blocks = parseLines(expandedLines);

  const htmlParts: string[] = [];
  for (const block of blocks) {
    const rendered = renderBlock(block, stats);
    if (rendered) htmlParts.push(rendered);
  }

  return {
    html: htmlParts.join('\n'),
    stats,
  };
}

/**
 * Quick preview of what the formatter would do — returns stats only,
 * useful for showing a badge before the dialog is opened.
 */
export function previewFormatStats(input: string): FormatStats {
  return formatLessonNote(input).stats;
}

export function totalChanges(stats: FormatStats): number {
  return (
    stats.headings +
    stats.orderedLists +
    stats.unorderedLists +
    stats.tables +
    stats.equations +
    stats.callouts +
    stats.mcqBlocks +
    stats.chemFormulas
  );
}
