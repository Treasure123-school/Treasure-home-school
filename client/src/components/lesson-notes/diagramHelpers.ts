/**
 * diagramHelpers.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * All helpers for AI diagram placeholder creation, replacement, and progress
 * tracking during lesson note generation.
 *
 * Architecture note:
 *   Skeleton placeholders use custom HTML (<figure><div class="ai-img-skeleton">)
 *   that TipTap's ProseMirror schema cannot render — it strips unknown block nodes.
 *   Therefore, the "generating images" phase bypasses TipTap entirely and renders
 *   a plain dangerouslySetInnerHTML div. Only the FINAL HTML (with real <img> tags)
 *   is passed to TipTap. replaceFigWithSkeleton uses a loading SVG <img> so TipTap
 *   can show a placeholder during single-image regen without stripping it.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ImgJob  { id: string; prompt: string; heading: string; }
export interface RegenFig { figId: string; heading: string; prompt: string; top: number; left: number; }

// ── Constants ─────────────────────────────────────────────────────────────────

const VISUAL_PATTERN =
  /diagram|structure|process|cycle|classif|chart|system|organ|cell|molecule|flow|stages|mechanism|anatomy|illustration|model|cross.?section|formation|composition|types of|parts of|components/i;

/**
 * Static SVG used as an <img src> placeholder during single-diagram regen.
 * TipTap's Image extension can render this without stripping it.
 */
export const REGEN_LOADING_SRC = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="200">
    <rect width="560" height="200" rx="12" fill="#eff6ff" stroke="#93c5fd" stroke-width="2" stroke-dasharray="8 4"/>
    <g transform="translate(236,36)">
      <rect x="2" y="2" width="88" height="72" rx="8" fill="none" stroke="#93c5fd" stroke-width="2.5"/>
      <circle cx="24" cy="24" r="7" fill="#bfdbfe"/>
      <path d="M2 56l20-20 14 14 12-12 20 20" fill="none" stroke="#93c5fd" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <text x="280" y="138" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="#1e40af" text-anchor="middle">Regenerating Diagram…</text>
    <text x="280" y="160" font-family="system-ui,sans-serif" font-size="11" fill="#64748b" text-anchor="middle">This may take 20–30 seconds</text>
  </svg>`
)}`;

/**
 * Shimmer keyframes CSS — inject this alongside any page that renders skeleton
 * placeholder figures (LessonNoteEditorPage's generating-images overlay).
 */
export const SHIMMER_CSS = `
  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  @keyframes ai-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.6; }
  }
`;

// ── Placeholder figure builders ────────────────────────────────────────────────

/**
 * Build a rich shimmer skeleton <figure> HTML for a pending AI diagram.
 * NOTE: Only use this in the plain-HTML overlay (not in TipTap content).
 */
export function makePlaceholderFigure(id: string, heading: string, prompt: string): string {
  const ep = encodeURIComponent(prompt);
  const eh = encodeURIComponent(heading);
  const short = heading.length > 65 ? heading.slice(0, 62) + '…' : heading;
  return `<figure id="${id}" data-fig-id="${id}" data-regen-prompt="${ep}" data-regen-heading="${eh}" style="margin:1.25em 0 1.75em;text-align:center;page-break-inside:avoid">
  <div class="ai-img-skeleton" data-skeleton-id="${id}" style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;min-height:220px;background:linear-gradient(90deg,#eff6ff 25%,#dbeafe 50%,#eff6ff 75%);background-size:200% 100%;animation:shimmer 1.8s ease-in-out infinite;border:2px dashed #93c5fd;border-radius:12px;gap:0.6em;overflow:hidden;padding:1.5em 1.25em 2.25em">
    <svg width="54" height="54" fill="none" stroke="#60a5fa" stroke-width="1.2" viewBox="0 0 24 24" style="opacity:0.78;flex-shrink:0">
      <rect x="2" y="2" width="20" height="20" rx="3"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <path d="M2 15l5.5-5.5 4 4 3-3 5.5 5.5"/>
    </svg>
    <div style="display:flex;flex-direction:column;align-items:center;gap:0.3em">
      <span style="color:#1e40af;font-size:0.82rem;font-weight:700;letter-spacing:0.02em;animation:ai-pulse 2s ease-in-out infinite">Generating Diagram</span>
      <span style="color:#64748b;font-size:0.72rem;max-width:300px;text-align:center;line-height:1.5">${short}</span>
    </div>
    <div style="display:flex;align-items:center;gap:0.6em;margin-top:0.1em">
      <div style="width:150px;height:7px;background:#bfdbfe;border-radius:99px;overflow:hidden">
        <div data-skeleton-bar="${id}" style="height:100%;width:0%;background:linear-gradient(90deg,#3b82f6,#60a5fa);border-radius:99px;transition:width 0.4s ease"></div>
      </div>
      <span data-skeleton-pct="${id}" style="color:#3b82f6;font-size:0.72rem;font-weight:700;min-width:32px;text-align:left">0%</span>
    </div>
    <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#3b82f6,#60a5fa,#3b82f6);background-size:200% 100%;animation:shimmer 1.2s linear infinite"></div>
  </div>
  <figcaption style="font-size:0.75rem;color:#6b7280;margin-top:0.5em;font-style:italic;letter-spacing:0.01em">Fig: ${heading}</figcaption>
</figure>`;
}

/**
 * Update progress bar + percentage text inside a skeleton placeholder.
 * Uses direct DOM manipulation for zero-flicker, zero-re-render updates.
 */
export function updatePlaceholderProgress(container: HTMLElement | null, id: string, pct: number): void {
  if (!container) return;
  const clamped = Math.round(Math.min(100, Math.max(0, pct)));
  const bar   = container.querySelector(`[data-skeleton-bar="${id}"]`) as HTMLElement | null;
  const pctEl = container.querySelector(`[data-skeleton-pct="${id}"]`) as HTMLElement | null;
  if (bar)   bar.style.width = `${clamped}%`;
  if (pctEl) pctEl.textContent = `${clamped}%`;
}

// ── HTML manipulation helpers ──────────────────────────────────────────────────

/**
 * Inject diagram placeholders after visual h3 headings in generated lesson HTML.
 * Guarantees at least 3 diagrams — extras are inserted before the Evaluation section.
 */
export function addImagePlaceholders(
  html: string,
  topic: string,
  subjectName: string,
): { html: string; imgJobs: ImgJob[] } {
  const imgJobs: ImgJob[] = [];
  let idx = 0;
  const ts = Date.now();

  // First pass — inject after every visually-relevant h3
  let newHtml = html.replace(/<h3(?:[^>]*)>([^<]+)<\/h3>/g, (match, heading: string) => {
    if (!VISUAL_PATTERN.test(heading) && !VISUAL_PATTERN.test(topic)) return match;
    const id     = `ai-img-${idx++}-${ts}`;
    const prompt = `${heading.trim()}, educational textbook diagram for ${subjectName || topic}, clear labeled scientific illustration, white background, detailed, high quality`;
    imgJobs.push({ id, prompt, heading: heading.trim() });
    return `${match}${makePlaceholderFigure(id, heading.trim(), prompt)}`;
  });

  // Guarantee at least 3 diagrams
  if (imgJobs.length < 3) {
    const extras: [string, string][] = [
      [`Overview of ${topic}`,        `Clear labeled overview diagram of ${topic} for ${subjectName || 'students'}, educational textbook illustration, white background, detailed`],
      [`${topic} — Key Concepts`,     `Key concepts diagram of ${topic}, ${subjectName || 'science'} subject, educational textbook style, labeled, white background`],
      [`${topic} — Summary Diagram`,  `Summary infographic of ${topic}, step-by-step educational illustration, ${subjectName || ''}, white background, labeled`],
      [`${topic} — Process Flow`,     `Process flow diagram of ${topic}, educational, ${subjectName || ''}, clear labels, white background`],
    ];
    const toAdd = extras.slice(0, 3 - imgJobs.length);
    const markerRe = /<h2[^>]*>[^<]*(Evaluation|Assignment|Classwork|Test|Summary)/i;
    const markerIdx = newHtml.search(markerRe);

    let extraBlock = '';
    for (const [heading, prompt] of toAdd) {
      const id = `ai-img-${idx++}-${ts}`;
      imgJobs.push({ id, prompt, heading });
      extraBlock += `<h3 style="color:#1d4ed8;font-size:1.05em;font-weight:600;margin:1.5em 0 0.5em">${heading}</h3>${makePlaceholderFigure(id, heading, prompt)}\n`;
    }

    if (markerIdx > 0) {
      newHtml = newHtml.slice(0, markerIdx) + extraBlock + newHtml.slice(markerIdx);
    } else {
      newHtml += extraBlock;
    }
  }

  return { html: newHtml, imgJobs };
}

/** Replace a skeleton placeholder with the real generated image. */
export function replacePlaceholder(html: string, id: string, imageUrl: string, heading: string): string {
  const figRe = new RegExp(`<figure[^>]*data-fig-id="${id}"[^>]*>[\\s\\S]*?</figure>`);
  const ep    = encodeURIComponent(`${heading}, educational textbook diagram, clear labeled scientific illustration, white background, detailed`);
  const eh    = encodeURIComponent(heading);
  const replacement = `<figure data-fig-id="${id}" data-regen-prompt="${ep}" data-regen-heading="${eh}" style="margin:1.25em 0 1.75em;text-align:center;page-break-inside:avoid">
  <img src="${imageUrl}" alt="Diagram: ${heading}" data-fig-id="${id}" data-regen-prompt="${ep}" data-regen-heading="${eh}" style="max-width:100%;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 2px 16px rgba(0,0,0,0.09);cursor:pointer" />
  <figcaption style="font-size:0.75rem;color:#6b7280;margin-top:0.5em;font-style:italic">Fig: ${heading} · click to regenerate</figcaption>
</figure>`;
  return html.replace(figRe, replacement);
}

/** Mark a figure as failed — shows an error state with click-to-retry. */
export function markPlaceholderFailed(html: string, id: string, heading: string): string {
  const figRe = new RegExp(`<figure[^>]*data-fig-id="${id}"[^>]*>[\\s\\S]*?</figure>`);
  const ep    = encodeURIComponent(`${heading}, educational textbook diagram, clear labeled scientific illustration, white background, detailed`);
  const eh    = encodeURIComponent(heading);
  const replacement = `<figure data-fig-id="${id}" data-regen-prompt="${ep}" data-regen-heading="${eh}" style="margin:1.25em 0 1.75em;text-align:center;page-break-inside:avoid">
  <div style="display:flex;align-items:center;justify-content:center;width:100%;min-height:80px;background:#fef9f9;border:2px dashed #fecaca;border-radius:10px;color:#ef4444;font-size:0.78rem;gap:0.5em;cursor:pointer;padding:1em">
    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    <span>Diagram unavailable — click to regenerate</span>
  </div>
  <figcaption style="font-size:0.75rem;color:#9ca3af;margin-top:0.5em;font-style:italic">Fig: ${heading}</figcaption>
</figure>`;
  return html.replace(figRe, replacement);
}

/**
 * Swap any figure back to a loading state for re-generation.
 * Uses a static SVG <img> src so TipTap's Image extension can render it
 * without stripping the node (unlike a <div> skeleton which ProseMirror strips).
 */
export function replaceFigWithSkeleton(html: string, id: string, heading: string, prompt: string): string {
  const ep          = encodeURIComponent(prompt);
  const eh          = encodeURIComponent(heading);
  const replacement = `<figure data-fig-id="${id}" data-regen-prompt="${ep}" data-regen-heading="${eh}" style="margin:1.25em 0 1.75em;text-align:center;page-break-inside:avoid">
  <img src="${REGEN_LOADING_SRC}" alt="Regenerating: ${heading}" data-fig-id="${id}" data-regen-prompt="${ep}" data-regen-heading="${eh}" style="max-width:100%;border:2px dashed #93c5fd;border-radius:10px;cursor:wait" />
  <figcaption style="font-size:0.75rem;color:#6b7280;margin-top:0.5em;font-style:italic">Fig: ${heading} · regenerating…</figcaption>
</figure>`;

  const figRe = new RegExp(`<figure[^>]*data-fig-id="${id}"[^>]*>[\\s\\S]*?</figure>`);
  if (figRe.test(html)) return html.replace(figRe, replacement);

  // Fallback: legacy id= attribute format used on first-generation placeholders
  const legacyRe = new RegExp(`<figure id="${id}"[^>]*>[\\s\\S]*?</figure>`);
  return html.replace(legacyRe, replacement);
}
