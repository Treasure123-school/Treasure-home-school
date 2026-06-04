import { storage } from '../storage';

export const PROVIDER_DEFAULTS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  gemini: 'gemini-1.5-pro',
};

export const OPENAI_MODELS = [
  { id: 'gpt-4o', label: 'GPT-4o (Best Quality)' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast & Cheap)' },
  { id: 'gpt-4.1', label: 'GPT-4.1' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano (Cheapest)' },
  { id: 'o3-mini', label: 'o3-mini (Reasoning)' },
  { id: 'o1-mini', label: 'o1-mini (Reasoning)' },
];

export const ANTHROPIC_MODELS = [
  { id: 'claude-opus-4-5', label: 'Claude Opus 4.5 (Best)' },
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (Balanced)' },
  { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fast)' },
  { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus (Legacy Best)' },
];

export const GEMINI_MODELS = [
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Best)' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Fast)' },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Cheap)' },
];

// Rough average cost per 1M tokens (USD) — input+output blended
const TOKEN_COSTS: Record<string, number> = {
  'gpt-4o': 6.25,
  'gpt-4o-mini': 0.375,
  'gpt-4.1': 5.0,
  'gpt-4.1-mini': 0.6,
  'gpt-4.1-nano': 0.15,
  'o1': 22.5,
  'o1-mini': 4.5,
  'o3': 30,
  'o3-mini': 2.5,
  'claude-opus-4-5': 37.5,
  'claude-sonnet-4-5': 9.0,
  'claude-3-5-sonnet-20241022': 9.0,
  'claude-3-5-haiku-20241022': 1.25,
  'claude-3-opus-20240229': 37.5,
  'gemini-2.5-pro': 5.0,
  'gemini-2.0-flash': 0.375,
  'gemini-1.5-pro': 3.125,
  'gemini-1.5-flash': 0.1875,
};

export const DEFAULT_LESSON_NOTE_PROMPT = `You are an expert Nigerian secondary school curriculum specialist who writes comprehensive, classroom-ready lesson notes.

Generate a complete lesson note in JSON format for:
Topic: "{topic}"
Class: "{className}"
Subject: "{subjectName}"
Term: "{termName}"
Duration: "{duration}"

Return ONLY valid JSON with exactly these 6 keys. Use HTML in all values.

KEY RULES:
- "objectives": <ol><li> list of 4–5 specific, measurable outcomes beginning with action verbs (define, identify, explain, demonstrate, apply, compare, analyse).
- "introduction": 2–3 paragraphs that open the lesson engagingly — pose a relatable question or real-world scenario relevant to Nigerian students, connect to what they know, then introduce the topic. No bullet lists.
- "content": THIS IS THE MOST CRITICAL SECTION. Write extensive, textbook-quality educational content. Requirements:
  * MINIMUM 600 words of substantive educational content (aim for 800–1200 words)
  * <h3> for each major sub-topic (at least 4–5 sub-topics)
  * <p> paragraphs with thorough explanations — do NOT use placeholder text
  * Define all key terms with <strong> markup
  * Provide clear explanations, real examples, and practical applications
  * Use <ul><li> or <ol><li> for types, lists, classifications
  * Include at least one <table><tr><th>/<td> for comparisons, types, or classifications
  * Use age-appropriate language for {className} students
  * Include Nigerian/local context and examples where relevant
  * Cover the topic comprehensively — this section alone should be longer than all other sections combined
  * Break complex ideas into clear steps or sub-sections
- "evaluation": 6–8 assessment questions mixing objectives and theory. Number them as <ol><li>. Include at least 2 short-answer/theory questions.
- "assignment": 3–5 meaningful homework tasks as <ol><li>. Should extend the lesson concepts.
- "summary": 3–5 bullet points (<ul><li>) recapping the key concepts students must remember from this lesson.

{
  "objectives": "...",
  "introduction": "...",
  "content": "...",
  "evaluation": "...",
  "assignment": "...",
  "summary": "..."
}`;

function getEnvKey(provider: string): string {
  if (provider === 'openai') return process.env.OPENAI_API_KEY || '';
  if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY || '';
  if (provider === 'gemini') return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  return '';
}

export async function getAllAISettings(): Promise<Record<string, string>> {
  const allSettings = await storage.getAllSettings();
  const ai: Record<string, string> = {};
  for (const s of allSettings) {
    if (s.key.startsWith('ai.')) ai[s.key.replace('ai.', '')] = s.value;
  }
  return ai;
}

export async function getAIConfig() {
  const ai = await getAllAISettings();
  const provider = ai['provider'] || 'openai';
  const model = ai[`${provider}.model`] || PROVIDER_DEFAULTS[provider] || 'gpt-4o-mini';
  const apiKey = ai[`${provider}.apiKey`] || getEnvKey(provider);

  return {
    provider,
    model,
    apiKey,
    features: {
      lessonNotes: ai['features.lessonNotes'] !== 'false',
      questionGeneration: ai['features.questionGeneration'] !== 'false',
      examGeneration: ai['features.examGeneration'] !== 'false',
      schemeOfWork: ai['features.schemeOfWork'] !== 'false',
      aiAssistant: ai['features.aiAssistant'] !== 'false',
    },
    prompts: {
      lessonNote: (ai['prompts.lessonNote'] && ai['prompts.lessonNote'] !== 'default')
        ? ai['prompts.lessonNote']
        : DEFAULT_LESSON_NOTE_PROMPT,
    },
    limits: {
      maxLessonNotesPerDay: parseInt(ai['limits.maxLessonNotesPerDay'] || '50'),
      monthlyBudget: parseFloat(ai['limits.monthlyBudget'] || '50'),
      warningThreshold: parseInt(ai['limits.warningThreshold'] || '80'),
    },
  };
}

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

  if (provider === 'openai') {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 5000,
        temperature: 0.6,
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`OpenAI error ${resp.status}: ${err}`);
    }
    const data = await resp.json() as any;
    raw = data.choices?.[0]?.message?.content || '';
    tokensUsed = data.usage?.total_tokens || 0;

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
        max_tokens: 5000,
        messages: [{ role: 'user', content: jsonPrompt }],
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Anthropic error ${resp.status}: ${err}`);
    }
    const data = await resp.json() as any;
    raw = data.content?.[0]?.text || '';
    tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
    // Strip markdown fences if present
    raw = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();

  } else if (provider === 'gemini') {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 5000,
            temperature: 0.6,
          },
        }),
      }
    );
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Gemini error ${resp.status}: ${err}`);
    }
    const data = await resp.json() as any;
    raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    tokensUsed = (data.usageMetadata?.promptTokenCount || 0) + (data.usageMetadata?.candidatesTokenCount || 0);

  } else {
    throw new Error(`Unknown AI provider: ${provider}`);
  }

  const sections = JSON.parse(raw);
  await trackUsage(model, tokensUsed);

  return { sections, tokensUsed, provider, model };
}

export async function trackUsage(model: string, tokens: number): Promise<void> {
  try {
    const costPerMillion = TOKEN_COSTS[model] || 1.0;
    const cost = (tokens / 1_000_000) * costPerMillion;
    const today = new Date().toISOString().split('T')[0];
    const yearMonth = today.substring(0, 7);
    const sysId = 'system';

    const upsert = async (key: string, update: (prev: any) => any, empty: object) => {
      const existing = await storage.getSetting(key);
      const prev = existing?.value ? JSON.parse(existing.value) : empty;
      const next = update(prev);
      if (existing) {
        await storage.updateSetting(key, JSON.stringify(next), sysId);
      } else {
        await storage.createSetting({ key, value: JSON.stringify(next), description: `AI usage: ${key}`, dataType: 'json', updatedBy: sysId });
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

export async function testProviderConnection(provider: string): Promise<{ success: boolean; message: string }> {
  const ai = await getAllAISettings();
  const apiKey = ai[`${provider}.apiKey`] || getEnvKey(provider);

  if (!apiKey) return { success: false, message: 'No API key configured for this provider' };

  try {
    if (provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return r.ok
        ? { success: true, message: 'OpenAI connection successful ✓' }
        : { success: false, message: `OpenAI returned status ${r.status}` };
    }

    if (provider === 'anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 5, messages: [{ role: 'user', content: 'Hi' }] }),
      });
      return (r.ok || r.status === 529)
        ? { success: true, message: 'Anthropic connection successful ✓' }
        : { success: false, message: `Anthropic returned status ${r.status}` };
    }

    if (provider === 'gemini') {
      const model = ai['gemini.model'] || 'gemini-1.5-pro';
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Hi' }] }] }),
        }
      );
      return r.ok
        ? { success: true, message: 'Gemini connection successful ✓' }
        : { success: false, message: `Gemini returned status ${r.status}` };
    }

    return { success: false, message: 'Unknown provider' };
  } catch (err: any) {
    return { success: false, message: `Connection failed: ${err.message}` };
  }
}
