/** Lesson note paste enhancement (streaming) — extracted from ai-service.ts. */
import { getAIConfig, repairJson, fetchWithTimeout, readSSEStream, DEFAULT_LESSON_NOTE_PROMPT } from './ai-config';
import { trackUsage } from './ai-usage';
import { db } from '../db';
import * as schema from '../../shared/schema.pg';
import { eq } from 'drizzle-orm';
const ENHANCE_PASTE_PROMPT = `You are an expert teacher, curriculum developer, and educational content specialist with deep knowledge of the Nigerian secondary school curriculum (WAEC, NECO, JAMB).

A teacher has provided their own lesson note below. Your task is to professionally rewrite and enhance it into a complete, well-structured, textbook-quality lesson note suitable for classroom teaching, student self-study, and school portal publication.

TEACHER'S ORIGINAL NOTE:
---
{rawNote}
---

CONTEXT
Subject: {subjectName}
Class: {className}
Term: {termName}
Topic: {topic}
Duration: {duration}

YOUR TASK
1. Preserve ALL factual content, examples, equations, and explanations from the original note — do NOT remove any information.
2. Enhance the language: fix grammar, improve clarity, use proper academic tone.
3. Expand thin or incomplete sections with additional relevant content.
4. Add any critically missing components that a good lesson note must have.
5. Format all content as proper HTML (no markdown, no code fences).
6. Apply Nigerian curriculum alignment (WAEC/NECO/JAMB focus where relevant).
7. For science subjects: ensure equations use proper notation and reactions are clearly explained.

OUTPUT FORMAT
Return ONLY a valid JSON object with exactly 6 keys:

objectives — 6-8 specific learning outcomes as <ol><li>...</li></ol>. Each begins with a strong verb (Define, Identify, Explain, Apply, Analyse). Must reflect the actual content of the original note.

introduction — 3-4 engaging paragraphs as <p>...</p>. Connect to students' daily experience. Recap related prior knowledge. End by stating what students will learn. 200-300 words.

content — THE MOST IMPORTANT SECTION. Rewrite and expand into comprehensive, textbook-quality HTML:
- Use <h3> headings for each sub-section (minimum 5 sub-sections)
- Define every key term using <strong>term</strong> markup
- Multiple <p> paragraphs under each sub-section
- At least ONE <table> element with <th> headers where appropriate
- <ul><li> and <ol><li> lists for key points, steps, or characteristics
- For science: include equations, reactions, experimental procedures where present in original
- Preserve all original examples and add more if the section is thin
- Include <h3>Examination Focus (WAEC/NECO/JAMB)</h3> at the end

evaluation — Assessment questions as HTML:
- <h3>Objective Questions</h3> — 5 multiple-choice questions as <ol><li>...</li></ol> with options A-D
- <h3>Theory Questions</h3> — 5 structured questions as <ol><li>...</li></ol> with mark allocations
- Questions must be based on the content of this specific note

assignment — 5 homework tasks as <ol><li>...</li></ol> based on the note content. Clear instructions for each.

summary — 
- <h3>Key Points to Remember</h3> — 8-10 bullet points as <ul><li>...</li></ul> capturing major learning points from the note
- <h3>Teacher's Notes</h3> — 3-4 teaching tips and common misconceptions to address

CRITICAL RULES
- Write REAL content only — no placeholders, no [write here], no ellipsis filler
- Every sentence must contain genuine educational information
- Preserve the teacher's original facts and examples exactly — only enhance the presentation
- Respond ONLY with the JSON object. No markdown, no code fences, no extra text.`;

/**
 * Like streamGenerateLessonNote but takes the teacher's own raw note text
 * and uses AI to rewrite/enhance it into the standard 6-section JSON format.
 */
export async function streamEnhanceLessonNote(
  params: {
    rawNote: string;
    topic: string;
    className: string;
    subjectName: string;
    termName: string;
    duration: string;
  },
  onChunk: (text: string) => void,
): Promise<{ sections: Record<string, string>; tokensUsed: number; provider: string; model: string }> {
  const config = await getAIConfig();
  const { provider, model, apiKey } = config;
  if (!apiKey) throw new Error(`No API key configured for provider: ${provider}`);

  const prompt = ENHANCE_PASTE_PROMPT
    .replace('{rawNote}', params.rawNote.slice(0, 12000)) // cap at 12k chars to avoid token overflow
    .replace(/\{topic\}/g, params.topic || 'Lesson Topic')
    .replace(/\{className\}/g, params.className || 'Secondary School')
    .replace(/\{subjectName\}/g, params.subjectName || 'General')
    .replace(/\{termName\}/g, params.termName || 'First Term')
    .replace(/\{duration\}/g, params.duration || '40 minutes');

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
        max_tokens: 8000, temperature: 0.5, stream: true,
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
          generationConfig: { maxOutputTokens: 8192, temperature: 0.5 },
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
      body: JSON.stringify({ model, messages: [{ role: 'user', content: jp }], max_tokens: 6000, temperature: 0.5, top_p: 1.0, stream: true }),
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

  await trackUsage(model, tokensUsed);
  return { sections, tokensUsed, provider, model };
}

