/** AI usage tracking + provider connection test — extracted from ai-service.ts. */
import { getAIConfig, getEnvKey, fetchWithTimeout, TOKEN_COSTS, getAllAISettings,
  PROVIDER_DEFAULTS, DEPRECATED_MODEL_MAP } from './ai-config';
import { storage } from '../storage';
import { db } from '../db';
import * as schema from '../../shared/schema.pg';
import { eq } from 'drizzle-orm';
export async function trackUsage(model: string, tokens: number): Promise<void> {
  try {
    const costPerMillion = TOKEN_COSTS[model] || 1.0;
    const cost = (tokens / 1_000_000) * costPerMillion;
    const today = new Date().toISOString().split('T')[0];
    const yearMonth = today.substring(0, 7);
    const upsert = async (key: string, update: (prev: any) => any, empty: object) => {
      const existing = await storage.getSetting(key);
      const prev = existing?.value ? JSON.parse(existing.value) : empty;
      const next = update(prev);
      if (existing) {
        await storage.updateSetting(key, JSON.stringify(next), null as any);
      } else {
        await storage.createSetting({ key, value: JSON.stringify(next), description: `AI usage: ${key}`, dataType: 'json', updatedBy: null as any });
      }
    };

    await upsert('ai.usage.today', (p) => {
      const base = (!p.date || p.date !== today) ? { date: today, requests: 0, tokens: 0, estimatedCost: 0 } : p;
      return { ...base, requests: base.requests + 1, tokens: base.tokens + tokens, estimatedCost: parseFloat((base.estimatedCost + cost).toFixed(6)) };
    }, { date: today, requests: 0, tokens: 0, estimatedCost: 0 });

    await upsert('ai.usage.month', (p) => {
      const base = (!p.yearMonth || p.yearMonth !== yearMonth) ? { yearMonth, requests: 0, tokens: 0, estimatedCost: 0 } : p;
      return { ...base, requests: base.requests + 1, tokens: base.tokens + tokens, estimatedCost: parseFloat((base.estimatedCost + cost).toFixed(6)) };
    }, { yearMonth, requests: 0, tokens: 0, estimatedCost: 0 });

    await upsert('ai.usage.allTime', (p) => ({
      requests: (p.requests || 0) + 1,
      tokens: (p.tokens || 0) + tokens,
    }), { requests: 0, tokens: 0 });

  } catch (err) {
    console.error('[AI Service] Usage tracking failed (non-fatal):', err);
  }
}

export async function testProviderConnection(provider: string): Promise<{ success: boolean; message: string; detail?: string }> {
  const ai = await getAllAISettings();
  const apiKey = ai[`${provider}.apiKey`] || getEnvKey(provider);

  if (!apiKey) return { success: false, message: 'No API key configured for this provider' };

  try {
    if (provider === 'openai') {
      // Use a real (tiny) chat completion — model list endpoint fails for project-scoped keys
      const model = ai['openai.model'] || PROVIDER_DEFAULTS.openai;
      const r = await fetchWithTimeout(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Say OK' }],
            max_tokens: 5,
          }),
        },
        20000
      );
      if (r.ok) return { success: true, message: `OpenAI connection successful ✓ (model: ${model})` };
      const body = await r.text();
      let detail = body;
      try { detail = JSON.parse(body)?.error?.message || body; } catch {}
      return { success: false, message: `OpenAI error ${r.status}`, detail };
    }

    if (provider === 'anthropic') {
      const r = await fetchWithTimeout(
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 5, messages: [{ role: 'user', content: 'Hi' }] }),
        },
        20000
      );
      if (r.ok || r.status === 529) return { success: true, message: 'Anthropic connection successful ✓' };
      const body = await r.text();
      let detail = body;
      try { detail = JSON.parse(body)?.error?.message || body; } catch {}
      return { success: false, message: `Anthropic error ${r.status}`, detail };
    }

    if (provider === 'gemini') {
      // Auto-migrate deprecated model names before testing
      const rawModel = ai['gemini.model'] || PROVIDER_DEFAULTS.gemini;
      const model = DEPRECATED_MODEL_MAP[rawModel] || rawModel;
      const r = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Say OK' }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
        },
        20000
      );
      if (r.ok) return { success: true, message: `Gemini connection successful ✓ (model: ${model})` };
      const body = await r.text();
      let detail = body;
      try { detail = JSON.parse(body)?.error?.message || body; } catch {}
      return { success: false, message: `Gemini error ${r.status}`, detail };
    }

    if (provider === 'nvidia') {
      const model = ai['nvidia.model'] || PROVIDER_DEFAULTS.nvidia;
      const r = await fetchWithTimeout('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 5,
        }),
      }, 20000);
      if (r.ok) return { success: true, message: `NVIDIA NIM connection successful ✓ (model: ${model})` };
      const body = await r.text();
      let detail = body;
      try { detail = JSON.parse(body)?.message || JSON.parse(body)?.error?.message || body; } catch {}
      return { success: false, message: `NVIDIA NIM error ${r.status}`, detail };
    }

    return { success: false, message: 'Unknown provider' };
  } catch (err: any) {
    const isTimeout = err.name === 'AbortError';
    return {
      success: false,
      message: isTimeout
        ? `Connection timed out after 20 seconds. Check your network or try again.`
        : `Connection failed: ${err.message}`,
    };
  }
}
