---
name: AI provider test endpoint fix
description: OpenAI test must POST to chat/completions, not GET /v1/models — project-scoped keys fail the models list
---

## Rule
Use a minimal `POST /v1/chat/completions` (max_tokens=5) to test OpenAI connectivity, not `GET /v1/models`.

**Why:** Project-scoped OpenAI API keys (created under a project in the dashboard) don't have permission to list all models via `GET /v1/models` — returns 403. But they CAN make chat completions. Using the models list as a connectivity test falsely reports "Failed" for valid keys.

**How to apply:**
- OpenAI test in `testProviderConnection()`: POST to `https://api.openai.com/v1/chat/completions` with `max_tokens: 5`, `messages: [{ role: 'user', content: 'Say OK' }]`
- Gemini test: auto-migrate deprecated model name before calling generateContent
- Anthropic test: POST to `/v1/messages` with `max_tokens: 5` (unchanged — this works fine)
