---
name: KaTeX pre-render/prewarm pattern for exam-style content
description: How to guarantee no raw math-notation flash without blocking render, and pitfalls in delimiter-protection regexes.
---

## No-flash guarantee doesn't require gating render behind a "ready" flag
A React component that parses+renders math (via a `getMathSegments`-style split into text/math segments,
then KaTeX-rendering the math segments) **during its own render** — not in a `useEffect` after mount —
never shows raw notation, because there's no mount-then-swap step. Gating the whole UI behind a
"pre-render complete" flag computed via a blocking `useMemo`/effect is therefore solving a problem that
doesn't exist, and it introduces a real cost: computing KaTeX HTML for an entire question bank
synchronously during render blocks first paint on large datasets.

**How to apply:** when asked to "pre-render before display, no flash even for a split second," check
whether the renderer is already synchronous-during-render first. If so, the real work is a *performance*
optimization (warm caches for instant navigation), not a correctness fix — do it in `useEffect`/idle
callbacks in small chunks, prioritizing the current item, never as a render-blocking gate.

## Cache-warming keyed by item id must reset at session/collection boundaries
If you track "already warmed" state in a `Set` keyed only by item id (e.g. question id) to avoid redundant
work, reset that set whenever the containing session/collection changes (e.g. a new exam session with a
different id, even if question ids could theoretically repeat across sessions). Otherwise a fresh session
can silently inherit "already warmed" state and skip real work.

## Delimiter-protection regex must cover every literal-math delimiter form
When auto-tagging plain-text math shorthand (e.g. wrapping detected `x^2` in `$x^2$`), the "skip regions
already inside literal math" split regex must protect **all** delimiter forms the format supports
(`$...$`, `$$...$$`, `\(...\)`, `\[...\]`) — protecting only `$...$` lets auto-tagging corrupt
already-authored `$$...$$` or `\(...\)` LaTeX blocks.

## Never inject unescaped fallback text into an HTML sink
A KaTeX/MathJax render-failure fallback that returns the raw source string, when that string later flows
into `dangerouslySetInnerHTML`/`innerHTML`, is an XSS sink. Always HTML-escape the fallback text.
