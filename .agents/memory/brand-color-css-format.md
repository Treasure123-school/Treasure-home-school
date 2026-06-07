---
name: Brand color CSS variable format
description: How --primary and related CSS vars must be defined for Tailwind opacity modifiers to work with brand color
---

## Rule
`--primary`, `--accent`, `--ring`, `--sidebar-primary`, `--sidebar-ring` must be defined as raw `H S% L%` channels (no `hsl()` wrapper) in both `:root` and `.dark` in `index.css`.

**Why:** Tailwind opacity modifiers (`bg-primary/10`) generate `hsl(var(--primary) / 0.1)`. If the variable is already `hsl(...)`, the output is invalid CSS. Raw channels let Tailwind inject the alpha correctly.

**How to apply:**
- In `index.css`: `--primary: 220 90% 50%;` (no hsl wrapper)
- In `tailwind.config.ts`: `primary: { DEFAULT: "hsl(var(--primary) / <alpha-value>)" }`
- In `App.tsx` `applyBrandColor()`: set `--primary: ${h} ${s}% ${l}%` (raw channels), not `hsl(...)`. Chart variables still use full `hsl()` since they don't need opacity modifiers.
- Direct CSS usages of the color (in `.btn-primary`, `.icon-gradient`, `.enroll-button-custom`, focus rules, etc.) must use `hsl(var(--primary))` not `var(--primary)` directly.

## What was migrated
665 hardcoded `text-blue-*`, `bg-blue-*`, `border-blue-*`, `from-blue-*`, `to-blue-*` classes across 122 TSX files replaced with `text-primary`, `bg-primary`, `bg-primary/10`, etc. Intentional multi-color category arrays (SUBJECT_COLORS, LEVEL_COLORS, subjectColors) were preserved as-is since blue there represents a specific category, not brand color.
