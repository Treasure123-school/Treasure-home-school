---
name: Tiptap v3 breaking changes
description: Rules for using Tiptap v3 — things that silently differ from v2 and cause runtime crashes
---

## Rule 1: BubbleMenu is NOT exported from @tiptap/react in v3
`import { BubbleMenu } from '@tiptap/react'` crashes with "does not provide an export named 'BubbleMenu'".
Use a custom floating toolbar instead: track `selectionUpdate` + `document.selectionchange`, read `window.getSelection().getRangeAt(0).getBoundingClientRect()`, position a `<div>` absolutely inside the `.doc-paper` container.

**Why:** BubbleMenu was removed from @tiptap/react in v3. It may exist as a separate package but is not needed — a custom floating div is simpler and has no peer-dependency risk.

**How to apply:** Any time you add a selection-based mini-toolbar, implement it as FloatingSelectionMenu (see DocEditor.tsx).

## Rule 2: Never pass [disabled] as a dep to useEditor
Changing `editable` via a `useEditor` option dep causes the editor to destroy/recreate and crashes the internal `commandManager`.

**Why:** Tiptap v3 ties `commandManager` lifecycle to the editor instance; recreating it mid-render leaves stale refs.

**How to apply:** Sync disabled state via `useEffect` → `editor.setEditable(!disabled)` after creation.

## Rule 4: @tiptap/extension-text-style has NO default export in v3
`import TextStyle from '@tiptap/extension-text-style'` crashes at runtime.
Must use: `import { TextStyle } from '@tiptap/extension-text-style'`

**Why:** In v3, `@tiptap/extension-text-style` became a multi-export bundle (`TextStyle`, `Color`, `FontFamily`, `FontSize`, `BackgroundColor`, `LineHeight`, `TextStyleKit`) with no default. All other extensions (Underline, Color, FontFamily, Highlight, Image, Link, TextAlign) still have a default export.

**How to apply:** Always use named import for TextStyle. Quick test: `node -e "const m = require('@tiptap/extension-text-style'); console.log(Object.keys(m))"` — if no `default` key, use named import.

## Rule 3: ProseMirror imports must use ESM path
`require('@tiptap/pm/state')` crashes in Vite ESM builds. Use `import { Plugin } from '@tiptap/pm/state'`.

**Why:** Tiptap v3 ships as pure ESM; CommonJS require() is not available in the Vite/browser build target.
