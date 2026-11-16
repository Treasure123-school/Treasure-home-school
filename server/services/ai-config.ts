/** AI provider configuration — constants, settings access, shared helpers.
 *  Extracted from ai-service.ts. */
import { storage } from '../storage';

export const PROVIDER_DEFAULTS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  gemini: 'gemini-2.0-flash',
  nvidia: 'meta/llama-3.3-70b-instruct',
};

// Models that are deprecated/removed — auto-migrated to their replacement
export const DEPRECATED_MODEL_MAP: Record<string, string> = {
  'gemini-1.5-pro': 'gemini-2.0-flash',
  'gemini-1.5-flash': 'gemini-2.0-flash',
  'gemini-1.0-pro': 'gemini-2.0-flash',
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

// NVIDIA NIM — OpenAI-compatible API, free credits with daily refresh
export const NVIDIA_MODELS = [
  { id: 'meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B — Meta (Recommended)' },
  { id: 'meta/llama-3.1-70b-instruct', label: 'Llama 3.1 70B — Meta (Fast)' },
  { id: 'meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B — Meta (Fastest)' },
  { id: 'mistralai/mistral-7b-instruct-v0.3', label: 'Mistral 7B — Mistral AI (Fast)' },
  { id: 'mistralai/mixtral-8x7b-instruct-v0.1', label: 'Mixtral 8x7B — Mistral AI' },
  { id: 'nvidia/llama-3.3-nemotron-super-49b-v1', label: 'Nemotron Super 49B — NVIDIA' },
  { id: 'google/gemma-2-9b-it', label: 'Gemma 2 9B — Google' },
  { id: 'moonshotai/kimi-k2.6', label: 'Kimi K2.6 — Moonshot AI (Slow/Thinking)' },
];

// Rough average cost per 1M tokens (USD) — input+output blended
export const TOKEN_COSTS: Record<string, number> = {
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

export const DEFAULT_LESSON_NOTE_PROMPT = `You are an expert teacher, curriculum developer, examiner (WAEC, NECO, JAMB), textbook author, and educational content specialist.
Your task is to generate a COMPLETE, DETAILED, TEXTBOOK-QUALITY LESSON NOTE on the given topic.
The lesson note must be suitable for direct classroom teaching, student self-study, examination preparation, and publication on a school portal.

INPUTS
Subject: {subjectName}
Class: {className}
Term: {termName}
Topic: {topic}
Duration: {duration}

PRIMARY OBJECTIVE
Generate a lesson note that is as detailed and comprehensive as a standard secondary school textbook chapter.
Do not generate an outline. Do not generate brief notes. Do not summarize important concepts.
Explain all concepts thoroughly. Assume students have little prior knowledge of the topic.

CONTENT REQUIREMENTS
The lesson note must automatically identify and explain ALL relevant subtopics related to the topic.
Do not limit explanations to the topic title alone. Expand into all necessary textbook subtopics.
For every topic, include every relevant section such as: Meaning, Definition, Introduction, Historical Background, Origin, Characteristics, Features, Components, Classification, Types, Structure, Composition, Principles, Stages, Processes, Functions, Properties, Causes, Effects, Consequences, Importance, Benefits, Advantages, Disadvantages, Applications, Uses, Examples, Similarities, Differences, Comparison Tables, Preparation, Production, Occurrence, Prevention, Control Measures, Safety Precautions, Economic Importance, Social Importance, Environmental Importance, Industrial Importance, Modern Developments, Current Trends.
Only include sections that are relevant to the topic. Do not force irrelevant headings.

EXPLANATION STANDARD
For every subtopic: Define it clearly. Explain it in simple language. Explain it in academic language. Give examples. Explain real-life applications. Explain examination points. Explain common misconceptions. Use tables where appropriate. Never assume understanding. Explain step-by-step.

CURRICULUM ALIGNMENT
Align content with WAEC, NECO, JAMB, and the Nigerian Secondary School Curriculum.
Where relevant, include likely examination questions and commonly tested areas.

DIAGRAMS
Where diagrams are needed: Provide diagram descriptions. Explain all labels. Explain what students should draw in examinations.

SCIENCE SUBJECTS: Where applicable include: Equations, Formulae, Calculations, Reactions, Experiments, Laboratory procedures, Precautions, Observations, Conclusions.

SOCIAL SCIENCE SUBJECTS: Where applicable include: Causes, Effects, Consequences, Importance, Prevention, Control Measures, Case Studies, Nigerian Examples.

TECHNOLOGY SUBJECTS: Where applicable include: Components, Functions, Architecture, Workflow, Advantages, Limitations, Best Practices.

CRITICAL OUTPUT RULES
1. Write REAL, ACTUAL content — no placeholders, no bracket text like [write here] or [example], no ellipsis filler.
2. Every sentence must contain genuine educational information about the specific topic above.
3. Write as if this will be printed and handed to students immediately.
4. Use Nigerian examples, local contexts, and references to Nigeria wherever relevant.
5. Return ONLY a valid JSON object with exactly 6 keys: objectives, introduction, content, evaluation, assignment, summary.
6. All values must be HTML strings. No markdown. No code fences.

JSON SECTION REQUIREMENTS

objectives — Write 6-8 specific learning outcomes as <ol><li>...</li></ol>. Begin each with a strong action verb (Define, Identify, Explain, Compare, Apply, Analyse, Evaluate). Make them specific to THIS topic, aligned with WAEC/NECO/JAMB expectations.

introduction — Write 3-4 engaging paragraphs as <p>...</p> tags. Connect the topic to students' daily experience in Nigeria. Recap related prior knowledge. End by stating what students will learn. Include historical background where relevant. 200-300 words.

content — THE MOST IMPORTANT SECTION. Write comprehensive, textbook-quality content. Requirements:
- MINIMUM 1200 words — aim for a full textbook chapter
- Use <h3> headings for each sub-section (minimum 6 sub-sections)
- Define every key term using <strong>term</strong> markup followed by thorough explanation
- Multiple <p> paragraphs under each sub-section — never just one
- At least TWO <table> elements with <th> headers (types/classifications + comparisons)
- <ul><li> and <ol><li> lists of important points, characteristics, steps
- Cover: definition, historical background, types/classifications, characteristics/features, functions/processes, importance, causes/effects, advantages/disadvantages, applications, current trends
- Science topics: include equations, formulae, reactions, experimental procedures, precautions, observations, conclusions
- Social science topics: include causes, effects, consequences, prevention, control measures, Nigerian case studies
- Real Nigerian examples (cities, rivers, industries, crops, people, events, institutions) throughout
- Include <h3>Examination Focus (WAEC/NECO/JAMB)</h3> listing most commonly tested points
- Write at a level appropriate for {className} students in Nigeria

evaluation — Comprehensive assessment section as HTML:
- <h3>Objective Questions</h3> — 5 multiple-choice questions as <ol><li>...</li></ol>, each with options A-D and correct answer indicated
- <h3>Theory Questions</h3> — 6 structured questions as <ol><li>...</li></ol> with mark allocations in brackets; mix definition (2 marks), explanation (4-6 marks), application, and compare-and-contrast questions
- <h3>Class Activities</h3> — 2-3 practical activities students can do in class

assignment — 5 homework tasks as <ol><li>...</li></ol>. Mix: research tasks, practical activities, written exercises, diagram drawing, real-world observation. Clear instructions for each.

summary — Comprehensive summary as HTML:
- <h3>Key Points to Remember</h3> — 8-10 bullet points as <ul><li>...</li></ul>; each a complete informative sentence capturing a major learning point
- <h3>Teacher's Notes</h3> — 3-4 teaching tips, common misconceptions to address, suggestions for further reading

QUALITY CHECK: Ensure no major subtopic is omitted. Ensure explanations are complete. Ensure the lesson can be taught directly from the note. Ensure it is detailed enough to replace a textbook chapter.

Now write the complete lesson note JSON. REAL content only, no placeholders. Longer and more detailed is always better.`;

export function getEnvKey(provider: string): string {
  if (provider === 'openai') return process.env.OPENAI_API_KEY || '';
  if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY || '';
  if (provider === 'gemini') return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  if (provider === 'nvidia') return process.env.NVIDIA_API_KEY || '';
  return '';
}

/** Create a fetch with a hard timeout using AbortController */
export function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 300000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
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
  const rawModel = ai[`${provider}.model`] || PROVIDER_DEFAULTS[provider] || 'gpt-4o-mini';
  // Auto-migrate deprecated models and persist to DB so the UI also updates
  const model = DEPRECATED_MODEL_MAP[rawModel] || rawModel;
  if (model !== rawModel) {
    try {
      const key = `ai.${provider}.model`;
      const existing = await storage.getSetting(key);
      if (existing) {
        await storage.updateSetting(key, model, 'system');
      } else {
        await storage.createSetting({ key, value: model, description: `AI config: ${key}`, dataType: 'string', updatedBy: 'system' });
      }
    } catch { /* non-fatal */ }
  }
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

/**
 * Try to repair a truncated JSON string by closing any open strings,
 * arrays, and objects so JSON.parse has a chance to succeed.
 */
export function repairJson(raw: string): string {
  let s = raw.trim();
  // Remove markdown fences
  s = s.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();

  // If already valid, return as-is
  try { JSON.parse(s); return s; } catch {}

  // Close any open string (odd number of unescaped quotes)
  const quoteCount = (s.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) s += '"';

  // Count open braces/brackets and close them
  let opens = 0;
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"' && (i === 0 || s[i - 1] !== '\\')) inStr = !inStr;
    if (!inStr) {
      if (ch === '{' || ch === '[') opens++;
      else if (ch === '}' || ch === ']') opens--;
    }
  }
  // Remove trailing comma before closing
  s = s.replace(/,\s*$/, '');
  while (opens > 0) { s += '}'; opens--; }

  return s;
}

/**
 * Read an SSE (Server-Sent Events) stream and collect all `data:` lines.
 * Optionally calls `onEvent` for each parsed event as it arrives (real-time).
 * Returns an array of all parsed JSON objects (skipping [DONE]).
 */
export async function readSSEStream(resp: Response, onEvent?: (event: any) => void): Promise<any[]> {
  if (!resp.body) throw new Error('Response body is null');
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  const events: any[] = [];
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const evt = JSON.parse(payload);
        events.push(evt);
        onEvent?.(evt);
      } catch { /* partial line, skip */ }
    }
  }
  // Flush remaining buffer
  if (buf.trim().startsWith('data:')) {
    const payload = buf.trim().slice(5).trim();
    if (payload && payload !== '[DONE]') {
      try {
        const evt = JSON.parse(payload);
        events.push(evt);
        onEvent?.(evt);
      } catch { /* ignore */ }
    }
  }
  return events;
}

