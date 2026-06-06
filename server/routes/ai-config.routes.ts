import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { authenticateUser, authorizeRoles, ROLES, AuthenticatedUser } from './middleware';
import {
  getAllAISettings,
  testProviderConnection,
  DEFAULT_LESSON_NOTE_PROMPT,
  OPENAI_MODELS,
  ANTHROPIC_MODELS,
  GEMINI_MODELS,
  NVIDIA_MODELS,
  PROVIDER_DEFAULTS,
} from '../services/ai-service';

const router = Router();

function maskKey(key: string): string {
  if (!key || key.length < 8) return '••••••••';
  return `${key.substring(0, 4)}...${key.slice(-4)}`;
}

function getEnvKey(provider: string): string {
  if (provider === 'openai') return process.env.OPENAI_API_KEY || '';
  if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY || '';
  if (provider === 'gemini') return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  if (provider === 'nvidia') return process.env.NVIDIA_API_KEY || '';
  return '';
}

async function upsertSetting(key: string, value: string, userId: string) {
  const existing = await storage.getSetting(key);
  if (existing) {
    await storage.updateSetting(key, value, userId);
  } else {
    await storage.createSetting({ key, value, description: `AI config: ${key}`, dataType: 'string', updatedBy: userId });
  }
}

// ── GET /api/superadmin/ai-config ──────────────────────────────────────────
router.get('/api/superadmin/ai-config', authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const ai = await getAllAISettings();

    const providers = ['openai', 'anthropic', 'gemini', 'nvidia'];
    const providerInfo: Record<string, any> = {};

    for (const p of providers) {
      const storedKey = ai[`${p}.apiKey`] || '';
      const envKey = getEnvKey(p);
      const hasKey = !!(storedKey || envKey);
      providerInfo[p] = {
        model: ai[`${p}.model`] || PROVIDER_DEFAULTS[p],
        apiKeySet: hasKey,
        apiKeyMasked: storedKey ? maskKey(storedKey) : (envKey ? maskKey(envKey) : ''),
        apiKeyFromEnv: !storedKey && !!envKey,
      };
    }

    res.json({
      provider: ai['provider'] || 'openai',
      providers: providerInfo,
      features: {
        lessonNotes: ai['features.lessonNotes'] !== 'false',
        questionGeneration: ai['features.questionGeneration'] !== 'false',
        examGeneration: ai['features.examGeneration'] !== 'false',
        schemeOfWork: ai['features.schemeOfWork'] !== 'false',
        aiAssistant: ai['features.aiAssistant'] !== 'false',
      },
      limits: {
        maxLessonNotesPerDay: parseInt(ai['limits.maxLessonNotesPerDay'] || '50'),
        maxWordsPerGeneration: parseInt(ai['limits.maxWordsPerGeneration'] || '2000'),
        monthlyBudget: parseFloat(ai['limits.monthlyBudget'] || '50'),
        warningThreshold: parseInt(ai['limits.warningThreshold'] || '80'),
      },
      prompts: {
        lessonNote: ai['prompts.lessonNote'] && ai['prompts.lessonNote'] !== 'default'
          ? ai['prompts.lessonNote']
          : DEFAULT_LESSON_NOTE_PROMPT,
        questionGeneration: ai['prompts.questionGeneration'] && ai['prompts.questionGeneration'] !== 'default'
          ? ai['prompts.questionGeneration']
          : 'default',
        examGeneration: ai['prompts.examGeneration'] && ai['prompts.examGeneration'] !== 'default'
          ? ai['prompts.examGeneration']
          : 'default',
      },
      availableModels: {
        openai: OPENAI_MODELS,
        anthropic: ANTHROPIC_MODELS,
        gemini: GEMINI_MODELS,
        nvidia: NVIDIA_MODELS,
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/superadmin/ai-config ──────────────────────────────────────────
router.put('/api/superadmin/ai-config', authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as AuthenticatedUser).id;
    const { provider, providers, features, limits } = req.body;

    if (provider) await upsertSetting('ai.provider', provider, userId);

    if (providers) {
      for (const [p, pData] of Object.entries(providers as Record<string, any>)) {
        if (pData.model) await upsertSetting(`ai.${p}.model`, pData.model, userId);
        if (pData.apiKey && !pData.apiKey.includes('...') && pData.apiKey !== '••••••••') {
          await upsertSetting(`ai.${p}.apiKey`, pData.apiKey.trim(), userId);
        }
      }
    }

    if (features) {
      for (const [k, v] of Object.entries(features)) {
        await upsertSetting(`ai.features.${k}`, String(v), userId);
      }
    }

    if (limits) {
      for (const [k, v] of Object.entries(limits)) {
        await upsertSetting(`ai.limits.${k}`, String(v), userId);
      }
    }

    res.json({ success: true, message: 'AI configuration saved' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/superadmin/ai-config/prompts ─────────────────────────────────
router.put('/api/superadmin/ai-config/prompts', authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as AuthenticatedUser).id;
    const { lessonNote, questionGeneration, examGeneration } = req.body;

    if (lessonNote !== undefined) await upsertSetting('ai.prompts.lessonNote', lessonNote || 'default', userId);
    if (questionGeneration !== undefined) await upsertSetting('ai.prompts.questionGeneration', questionGeneration || 'default', userId);
    if (examGeneration !== undefined) await upsertSetting('ai.prompts.examGeneration', examGeneration || 'default', userId);

    res.json({ success: true, message: 'Prompts saved' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/superadmin/ai-config/usage ───────────────────────────────────
router.get('/api/superadmin/ai-config/usage', authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const yearMonth = today.substring(0, 7);

    const [todaySetting, monthSetting, allTimeSetting] = await Promise.all([
      storage.getSetting('ai.usage.today'),
      storage.getSetting('ai.usage.month'),
      storage.getSetting('ai.usage.allTime'),
    ]);

    let todayData = todaySetting?.value ? JSON.parse(todaySetting.value) : null;
    let monthData = monthSetting?.value ? JSON.parse(monthSetting.value) : null;
    let allTimeData = allTimeSetting?.value ? JSON.parse(allTimeSetting.value) : null;

    if (!todayData || todayData.date !== today) todayData = { date: today, requests: 0, tokens: 0, estimatedCost: 0 };
    if (!monthData || monthData.yearMonth !== yearMonth) monthData = { yearMonth, requests: 0, tokens: 0, estimatedCost: 0 };
    if (!allTimeData) allTimeData = { requests: 0, tokens: 0 };

    const limitSetting = await storage.getSetting('ai.limits.monthlyBudget');
    const monthlyBudget = parseFloat(limitSetting?.value || '50');
    const warningThresholdSetting = await storage.getSetting('ai.limits.warningThreshold');
    const warningThreshold = parseInt(warningThresholdSetting?.value || '80');

    const budgetUsedPercent = monthlyBudget > 0
      ? Math.round((monthData.estimatedCost / monthlyBudget) * 100)
      : 0;

    res.json({
      today: todayData,
      month: monthData,
      allTime: allTimeData,
      budget: {
        monthly: monthlyBudget,
        used: monthData.estimatedCost,
        usedPercent: budgetUsedPercent,
        warningThreshold,
        isWarning: budgetUsedPercent >= warningThreshold,
        isExceeded: budgetUsedPercent >= 100,
      },
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/superadmin/ai-config/test ───────────────────────────────────
router.post('/api/superadmin/ai-config/test', authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const { provider } = req.body;
    if (!provider) return res.status(400).json({ success: false, message: 'provider is required' });
    const result = await testProviderConnection(provider);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/superadmin/ai-config/reset-usage ───────────────────────────
router.post('/api/superadmin/ai-config/reset-usage', authenticateUser, authorizeRoles(ROLES.SUPER_ADMIN), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as AuthenticatedUser).id;
    const { period } = req.body;

    if (period === 'today' || period === 'all') {
      const today = new Date().toISOString().split('T')[0];
      const empty = { date: today, requests: 0, tokens: 0, estimatedCost: 0 };
      const existing = await storage.getSetting('ai.usage.today');
      if (existing) await storage.updateSetting('ai.usage.today', JSON.stringify(empty), userId);
    }
    if (period === 'month' || period === 'all') {
      const yearMonth = new Date().toISOString().substring(0, 7);
      const empty = { yearMonth, requests: 0, tokens: 0, estimatedCost: 0 };
      const existing = await storage.getSetting('ai.usage.month');
      if (existing) await storage.updateSetting('ai.usage.month', JSON.stringify(empty), userId);
    }
    if (period === 'all') {
      const existing = await storage.getSetting('ai.usage.allTime');
      if (existing) await storage.updateSetting('ai.usage.allTime', JSON.stringify({ requests: 0, tokens: 0 }), userId);
    }

    res.json({ success: true, message: `Usage for '${period}' reset` });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
