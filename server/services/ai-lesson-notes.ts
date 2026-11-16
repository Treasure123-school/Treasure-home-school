/** Lesson note generation (blocking + streaming) — extracted from ai-service.ts. */
import { getAIConfig, repairJson, fetchWithTimeout, readSSEStream, DEFAULT_LESSON_NOTE_PROMPT } from './ai-config';
import { trackUsage } from './ai-usage';
import { db } from '../db';
import * as schema from '../../shared/schema.pg';
import { eq } from 'drizzle-orm';
export async function generateLessonNoteContent(params: {
  topic: string;
  className: string;
  subjectName: string;
  termName: string;
  duration: string;
}): Promise<{ sections: Record<string, string>; tokensUsed: number; provider: string; model: string }> {
  const config = await getAIConfig();
  const { provider, model, apiKey } = config;

  if (!apiKey) throw new Error(`No API key configured for provider: ${provider}`);

  const promptTemplate = config.prompts.lessonNote;
  const prompt = promptTemplate
    .replace(/\{topic\}/g, params.topic)
    .replace(/\{className\}/g, params.className)
    .replace(/\{subjectName\}/g, params.subjectName)
    .replace(/\{termName\}/g, params.termName)
    .replace(/\{duration\}/g, params.duration);

  let raw: string;
  let tokensUsed = 0;

  // All providers now use STREAMING mode to prevent server-side idle connection
  // timeouts (NVIDIA, OpenAI, Anthropic, Gemini all close non-streaming
  // connections after ~60-90 s when generating large responses).
  // With streaming, tokens flow continuously so no idle timeout ever fires.

  if (provider === 'openai') {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 8000,
        temperature: 0.6,
        stream: true,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      let detail = errText;
      try { detail = JSON.parse(errText)?.error?.message || errText; } catch {}
      throw new Error(`OpenAI error ${resp.status}: ${detail}`);
    }
    const events = await readSSEStream(resp);
    raw = events.map(e => e.choices?.[0]?.delta?.content || '').join('');
    const lastUsage = events.findLast((e: any) => e.usage)?.usage;
    tokensUsed = lastUsage?.total_tokens || 0;

  } else if (provider === 'anthropic') {
    const jsonPrompt = prompt + '\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown fences, no extra text.';
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 8000,
        messages: [{ role: 'user', content: jsonPrompt }],
        stream: true,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      let detail = errText;
      try { detail = JSON.parse(errText)?.error?.message || errText; } catch {}
      throw new Error(`Anthropic error ${resp.status}: ${detail}`);
    }
    const events = await readSSEStream(resp);
    raw = events
      .filter((e: any) => e.type === 'content_block_delta' && e.delta?.type === 'text_delta')
      .map((e: any) => e.delta?.text || '')
      .join('');
    const msgDelta = events.find((e: any) => e.type === 'message_delta');
    tokensUsed = (msgDelta?.usage?.output_tokens || 0);
    raw = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();

  } else if (provider === 'gemini') {
    // Gemini streaming uses streamGenerateContent with alt=sse
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.6,
          },
        }),
      }
    );
    if (!resp.ok) {
      const errText = await resp.text();
      let detail = errText;
      try { detail = JSON.parse(errText)?.error?.message || errText; } catch {}
      throw new Error(`Gemini error ${resp.status}: ${detail}`);
    }
    const events = await readSSEStream(resp);
    raw = events
      .map((e: any) => e.candidates?.[0]?.content?.parts?.[0]?.text || '')
      .join('');
    const lastEvent = events[events.length - 1];
    tokensUsed = (lastEvent?.usageMetadata?.promptTokenCount || 0) +
                 (lastEvent?.usageMetadata?.candidatesTokenCount || 0);

    // Check finish reason on last candidate chunk
    const lastFinish = lastEvent?.candidates?.[0]?.finishReason;
    if (lastFinish && lastFinish !== 'STOP' && lastFinish !== 'MAX_TOKENS') {
      throw new Error(`Gemini generation stopped: ${lastFinish}`);
    }
    // Strip JSON fences Gemini sometimes wraps around streaming output
    raw = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();

  } else if (provider === 'nvidia') {
    // NVIDIA NIM is OpenAI-compatible — use stream: true
    const jsonPrompt = prompt + '\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown fences, no extra text.';
    const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: jsonPrompt }],
        max_tokens: 6000,
        temperature: 0.6,
        top_p: 1.0,
        stream: true,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      let detail = errText;
      try { detail = JSON.parse(errText)?.message || JSON.parse(errText)?.error?.message || errText; } catch {}
      throw new Error(`NVIDIA NIM error ${resp.status}: ${detail}`);
    }
    const events = await readSSEStream(resp);
    raw = events.map((e: any) => e.choices?.[0]?.delta?.content || '').join('');
    const lastUsage = events.findLast((e: any) => e.usage)?.usage;
    tokensUsed = lastUsage?.total_tokens || 0;
    raw = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();

  } else {
    throw new Error(`Unknown AI provider: ${provider}`);
  }

  if (!raw || raw.trim() === '') {
    throw new Error(`${provider} returned an empty response. Please check your API key and account status.`);
  }

  // Attempt to parse; if it fails try to repair truncated JSON
  let sections: Record<string, string>;
  try {
    sections = JSON.parse(raw);
  } catch {
    const repaired = repairJson(raw);
    try {
      sections = JSON.parse(repaired);
    } catch (e2) {
      throw new Error(`${provider} returned malformed JSON. The response may have been cut off. Try a model with larger output capacity.`);
    }
  }

  // Validate that all 6 required sections are present and non-empty
  const required = ['objectives', 'introduction', 'content', 'evaluation', 'assignment', 'summary'];
  const missing = required.filter(k => !sections[k] || sections[k].trim() === '');
  if (missing.length > 0) {
    throw new Error(`AI response is missing required sections: ${missing.join(', ')}. Try again or switch to a more capable model.`);
  }

  // Detect placeholder/template text — the AI must NOT output bracket placeholders
  const placeholderPattern = /\[(?:provide|write|insert|add|explain|describe|list|give|example|type \d|feature \d|detailed|specific|brief|continue|research)[^\]]{0,120}\]/i;
  if (placeholderPattern.test(sections['content'] || '')) {
    throw new Error(`AI returned template placeholder text instead of real content. Please try again — if this persists, switch to a more capable model such as gpt-4o or gemini-2.5-pro.`);
  }

  await trackUsage(model, tokensUsed);

  return { sections, tokensUsed, provider, model };
}

/**
 * Like generateLessonNoteContent but calls `onChunk(text)` for every token
 * as it arrives — enabling live streaming to the browser (ChatGPT-style).
 */
export async function streamGenerateLessonNote(
  params: { topic: string; className: string; subjectName: string; termName: string; duration: string },
  onChunk: (text: string) => void,
): Promise<{ sections: Record<string, string>; tokensUsed: number; provider: string; model: string }> {
  const config = await getAIConfig();
  const { provider, model, apiKey } = config;
  if (!apiKey) throw new Error(`No API key configured for provider: ${provider}`);

  const prompt = config.prompts.lessonNote
    .replace(/\{topic\}/g, params.topic)
    .replace(/\{className\}/g, params.className)
    .replace(/\{subjectName\}/g, params.subjectName)
    .replace(/\{termName\}/g, params.termName)
    .replace(/\{duration\}/g, params.duration);

  let fullText = '';
  let tokensUsed = 0;

  const pipe = (text: string) => { if (text) { fullText += text; onChunk(text); } };

  if (provider === 'openai') {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model, response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 8000, temperature: 0.6, stream: true,
        stream_options: { include_usage: true },
      }),
    });
    if (!resp.ok) {
      const t = await resp.text(); let d = t;
      try { d = JSON.parse(t)?.error?.message || t; } catch {}
      throw new Error(`OpenAI error ${resp.status}: ${d}`);
    }
    const events = await readSSEStream(resp, e => pipe(e.choices?.[0]?.delta?.content || ''));
    tokensUsed = events.findLast((e: any) => e.usage)?.usage?.total_tokens || 0;

  } else if (provider === 'anthropic') {
    const jp = prompt + '\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown fences, no extra text.';
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 8000, messages: [{ role: 'user', content: jp }], stream: true }),
    });
    if (!resp.ok) {
      const t = await resp.text(); let d = t;
      try { d = JSON.parse(t)?.error?.message || t; } catch {}
      throw new Error(`Anthropic error ${resp.status}: ${d}`);
    }
    const events = await readSSEStream(resp, e => {
      if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta') pipe(e.delta.text || '');
    });
    tokensUsed = events.find((e: any) => e.type === 'message_delta')?.usage?.output_tokens || 0;
    fullText = fullText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();

  } else if (provider === 'gemini') {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.6 },
        }),
      }
    );
    if (!resp.ok) {
      const t = await resp.text(); let d = t;
      try { d = JSON.parse(t)?.error?.message || t; } catch {}
      throw new Error(`Gemini error ${resp.status}: ${d}`);
    }
    const events = await readSSEStream(resp, e => pipe(e.candidates?.[0]?.content?.parts?.[0]?.text || ''));
    const last = events[events.length - 1];
    tokensUsed = (last?.usageMetadata?.promptTokenCount || 0) + (last?.usageMetadata?.candidatesTokenCount || 0);
    const fin = last?.candidates?.[0]?.finishReason;
    if (fin && fin !== 'STOP' && fin !== 'MAX_TOKENS') throw new Error(`Gemini stopped: ${fin}`);
    fullText = fullText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();

  } else if (provider === 'nvidia') {
    const jp = prompt + '\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown fences, no extra text.';
    const resp = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: jp }], max_tokens: 6000, temperature: 0.6, top_p: 1.0, stream: true }),
    });
    if (!resp.ok) {
      const t = await resp.text(); let d = t;
      try { d = JSON.parse(t)?.message || JSON.parse(t)?.error?.message || t; } catch {}
      throw new Error(`NVIDIA NIM error ${resp.status}: ${d}`);
    }
    const events = await readSSEStream(resp, e => pipe(e.choices?.[0]?.delta?.content || ''));
    tokensUsed = events.findLast((e: any) => e.usage)?.usage?.total_tokens || 0;
    fullText = fullText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();

  } else {
    throw new Error(`Unknown AI provider: ${provider}`);
  }

  if (!fullText.trim()) throw new Error(`${provider} returned an empty response.`);

  let sections: Record<string, string>;
  try { sections = JSON.parse(fullText); }
  catch {
    const repaired = repairJson(fullText);
    try { sections = JSON.parse(repaired); }
    catch { throw new Error(`${provider} returned malformed JSON. Response may have been cut off.`); }
  }

  const required = ['objectives', 'introduction', 'content', 'evaluation', 'assignment', 'summary'];
  const missing = required.filter(k => !sections[k] || sections[k].trim() === '');
  if (missing.length > 0) throw new Error(`AI response is missing sections: ${missing.join(', ')}.`);

  const placeholderPattern = /\[(?:provide|write|insert|add|explain|describe|list|give|example|type \d|feature \d|detailed|specific|brief|continue|research)[^\]]{0,120}\]/i;
  if (placeholderPattern.test(sections['content'] || ''))
    throw new Error(`AI returned placeholder text instead of real content. Please try again.`);

  await trackUsage(model, tokensUsed);
  return { sections, tokensUsed, provider, model };
}

// ── Enhance-from-paste prompt ──────────────────────────────────────────────

