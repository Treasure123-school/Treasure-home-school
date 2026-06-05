---
name: Gemini model deprecation
description: gemini-1.5-pro (and 1.5-flash, 1.0-pro) removed from Google's v1beta API — causes 404 "model not found" errors
---

## Rule
Any stored Gemini model name must be checked against `DEPRECATED_MODEL_MAP` in `server/services/ai-service.ts` and auto-migrated to `gemini-2.0-flash` before use.

**Why:** Google silently removed `gemini-1.5-pro` from the v1beta generateContent API. Calls return `404: models/gemini-1.5-pro is not found for API version v1beta`. The old model was the hardcoded default, so every user who set up Gemini before the migration was silently broken.

**How to apply:**
- `DEPRECATED_MODEL_MAP` in `ai-service.ts` maps old → new model names
- `getAIConfig()` checks `rawModel` against this map and auto-persists the updated model to DB
- `testProviderConnection()` also applies the map before testing
- Default `PROVIDER_DEFAULTS.gemini` is now `gemini-2.0-flash`
- Current working Gemini models: `gemini-2.5-pro`, `gemini-2.0-flash`, `gemini-1.5-flash` (still works as of June 2026)
