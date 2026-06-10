import { useState, useEffect } from "react";
import SuperAdminLayout from "@/components/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Bot,
  Brain,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Eye,
  EyeOff,
  FlaskConical,
  Image,
  Key,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  Sparkles,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ProviderInfo {
  model: string;
  apiKeySet: boolean;
  apiKeyMasked: string;
  apiKeyFromEnv: boolean;
}

interface CloudflareConfig {
  accountId: string;
  accountIdMasked: string;
  accountIdFromEnv: boolean;
  apiToken: string;
  apiTokenMasked: string;
  apiTokenFromEnv: boolean;
  imageModel: string;
  imageGenEnabled: boolean;
  imagePromptTemplate: string;
  steps: number;
  availableModels: { id: string; label: string }[];
}

interface AIConfig {
  provider: string;
  providers: {
    openai: ProviderInfo;
    anthropic: ProviderInfo;
    gemini: ProviderInfo;
    nvidia: ProviderInfo;
  };
  features: {
    lessonNotes: boolean;
    questionGeneration: boolean;
    examGeneration: boolean;
    schemeOfWork: boolean;
    aiAssistant: boolean;
  };
  limits: {
    maxLessonNotesPerDay: number;
    maxWordsPerGeneration: number;
    monthlyBudget: number;
    warningThreshold: number;
  };
  prompts: {
    lessonNote: string;
    questionGeneration: string;
    examGeneration: string;
  };
  availableModels: {
    openai: { id: string; label: string }[];
    anthropic: { id: string; label: string }[];
    gemini: { id: string; label: string }[];
    nvidia: { id: string; label: string }[];
  };
}

interface UsageData {
  today: { date: string; requests: number; tokens: number; estimatedCost: number };
  month: { yearMonth: string; requests: number; tokens: number; estimatedCost: number };
  allTime: { requests: number; tokens: number };
  budget: { monthly: number; used: number; usedPercent: number; warningThreshold: number; isWarning: boolean; isExceeded: boolean };
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic (Claude)",
  gemini: "Google Gemini",
  nvidia: "NVIDIA NIM (Free)",
};

const PROVIDER_COLORS: Record<string, string> = {
  openai: "bg-green-100 text-green-800 border-green-200",
  anthropic: "bg-orange-100 text-orange-800 border-orange-200",
  gemini: "bg-primary/10 text-primary border-primary/30",
  nvidia: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const PROVIDER_ICONS: Record<string, string> = {
  openai: "🤖",
  anthropic: "🧠",
  gemini: "✨",
  nvidia: "🟢",
};

export default function SuperAdminAIConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [editKeys, setEditKeys] = useState<Record<string, string>>({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string; detail?: string }>>({});
  const [promptTab, setPromptTab] = useState("lessonNote");

  const { data: config, isLoading } = useQuery<AIConfig>({
    queryKey: ["/api/superadmin/ai-config"],
  });

  const { data: usage, isLoading: usageLoading } = useQuery<UsageData>({
    queryKey: ["/api/superadmin/ai-config/usage"],
    refetchInterval: 30000,
  });

  const [localConfig, setLocalConfig] = useState<Partial<AIConfig>>({});
  const [localPrompts, setLocalPrompts] = useState<Record<string, string>>({});

  const merged = { ...config, ...localConfig } as AIConfig;

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/superadmin/ai-config", data),
    onSuccess: () => {
      toast({ title: "Configuration Saved", description: "AI settings have been updated successfully." });
      qc.invalidateQueries({ queryKey: ["/api/superadmin/ai-config"] });
      setLocalConfig({});
      setEditKeys({});
    },
    onError: (err: any) => {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    },
  });

  const savePromptsMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/superadmin/ai-config/prompts", data),
    onSuccess: () => {
      toast({ title: "Prompts Saved", description: "System prompts have been updated." });
      qc.invalidateQueries({ queryKey: ["/api/superadmin/ai-config"] });
      setLocalPrompts({});
    },
    onError: (err: any) => {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    },
  });

  const resetUsageMutation = useMutation({
    mutationFn: (period: string) => apiRequest("POST", "/api/superadmin/ai-config/reset-usage", { period }),
    onSuccess: () => {
      toast({ title: "Usage Reset", description: "Usage counters have been reset." });
      qc.invalidateQueries({ queryKey: ["/api/superadmin/ai-config/usage"] });
    },
  });

  // ── Image AI shared state ─────────────────────────────────────────────────
  const [activeImgProvider, setActiveImgProvider] = useState<"cloudflare" | "nvidia">("cloudflare");
  const [sharedPromptTemplate, setSharedPromptTemplate] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewModel, setPreviewModel] = useState("");

  // ── Cloudflare state ──────────────────────────────────────────────────────
  const [cfAccountId, setCfAccountId] = useState("");
  const [cfApiToken, setCfApiToken] = useState("");
  const [showCfToken, setShowCfToken] = useState(false);
  const [showCfAccountId, setShowCfAccountId] = useState(false);
  const [cfTestResult, setCfTestResult] = useState<{ success: boolean; message: string; detail?: string } | null>(null);
  const [cfTesting, setCfTesting] = useState(false);
  const [localCfConfig, setLocalCfConfig] = useState<Partial<CloudflareConfig>>({});

  const { data: cfConfig, isLoading: cfLoading } = useQuery<CloudflareConfig>({
    queryKey: ["/api/superadmin/ai-config/cloudflare"],
  });

  useEffect(() => {
    if (!cfConfig) return;
    if ((cfConfig as any).activeProvider) setActiveImgProvider((cfConfig as any).activeProvider);
    if ((cfConfig as any).sharedPromptTemplate && !sharedPromptTemplate) setSharedPromptTemplate((cfConfig as any).sharedPromptTemplate);
  }, [cfConfig]);

  const mergedCf = { ...cfConfig, ...localCfConfig } as CloudflareConfig;

  const saveCfMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/superadmin/ai-config/cloudflare", data),
    onSuccess: () => {
      toast({ title: "Cloudflare Config Saved" });
      qc.invalidateQueries({ queryKey: ["/api/superadmin/ai-config/cloudflare"] });
      setCfAccountId(""); setCfApiToken(""); setLocalCfConfig({});
    },
    onError: (err: any) => toast({ title: "Save Failed", description: err.message, variant: "destructive" }),
  });

  const handleSaveCfConfig = () => {
    saveCfMutation.mutate({
      accountId: cfAccountId || undefined,
      apiToken: cfApiToken || undefined,
      imageModel: mergedCf.imageModel,
      imageGenEnabled: mergedCf.imageGenEnabled,
      steps: mergedCf.steps,
    });
  };

  const handleTestCf = async () => {
    setCfTesting(true); setCfTestResult(null);
    try {
      const res = await apiRequest("POST", "/api/superadmin/ai-config/cloudflare/test", {
        accountId: cfAccountId || undefined,
        apiToken: cfApiToken || undefined,
        imageModel: mergedCf.imageModel,
      });
      setCfTestResult(await res.json());
    } catch (err: any) {
      setCfTestResult({ success: false, message: err.message });
    } finally { setCfTesting(false); }
  };

  // ── NVIDIA Image state ────────────────────────────────────────────────────
  interface NvidiaImgConfig {
    apiKey: string; apiKeyMasked: string; apiKeyFromEnv: boolean; apiKeyFromTextAI: boolean;
    imageModel: string; imageGenEnabled: boolean;
    width: number; height: number; steps: number; seed: number;
    availableModels: { id: string; label: string }[];
  }

  const [nvidiaApiKey, setNvidiaApiKey] = useState("");
  const [showNvidiaKey, setShowNvidiaKey] = useState(false);
  const [nvidiaTestResult, setNvidiaTestResult] = useState<{ success: boolean; message: string; detail?: string } | null>(null);
  const [nvidiaTesting, setNvidiaTesting] = useState(false);
  const [localNvConfig, setLocalNvConfig] = useState<Partial<NvidiaImgConfig>>({});

  const { data: nvConfig, isLoading: nvLoading } = useQuery<NvidiaImgConfig>({
    queryKey: ["/api/superadmin/ai-config/nvidia-image"],
  });

  const mergedNv = { ...nvConfig, ...localNvConfig } as NvidiaImgConfig;

  const saveNvMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/superadmin/ai-config/nvidia-image", data),
    onSuccess: () => {
      toast({ title: "NVIDIA Config Saved" });
      qc.invalidateQueries({ queryKey: ["/api/superadmin/ai-config/nvidia-image"] });
      setNvidiaApiKey(""); setLocalNvConfig({});
    },
    onError: (err: any) => toast({ title: "Save Failed", description: err.message, variant: "destructive" }),
  });

  const handleSaveNvConfig = () => {
    saveNvMutation.mutate({
      apiKey: nvidiaApiKey || undefined,
      imageModel: mergedNv.imageModel,
      imageGenEnabled: mergedNv.imageGenEnabled,
      width: mergedNv.width,
      height: mergedNv.height,
      steps: mergedNv.steps,
      seed: mergedNv.seed,
    });
  };

  const handleTestNvidia = async () => {
    setNvidiaTesting(true); setNvidiaTestResult(null);
    try {
      const res = await apiRequest("POST", "/api/superadmin/ai-config/nvidia-image/test", {
        apiKey: nvidiaApiKey || undefined,
        imageModel: mergedNv.imageModel,
      });
      setNvidiaTestResult(await res.json());
    } catch (err: any) {
      setNvidiaTestResult({ success: false, message: err.message });
    } finally { setNvidiaTesting(false); }
  };

  // ── Shared: save provider + prompt template ───────────────────────────────
  const saveProviderMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/superadmin/ai-config/image-provider", data),
    onSuccess: () => {
      toast({ title: "Image Provider Saved", description: `Active provider: ${activeImgProvider}` });
      qc.invalidateQueries({ queryKey: ["/api/superadmin/ai-config/cloudflare"] });
    },
    onError: (err: any) => toast({ title: "Save Failed", description: err.message, variant: "destructive" }),
  });

  const handleSaveProvider = () => {
    saveProviderMutation.mutate({ provider: activeImgProvider, promptTemplate: sharedPromptTemplate });
  };

  // ── Shared: preview generation ────────────────────────────────────────────
  const handlePreviewImage = async () => {
    setPreviewing(true); setPreviewUrl(null);
    try {
      const res = await apiRequest("POST", "/api/lesson-notes/generate-image-cf/preview", {
        topic: "Photosynthesis in Plants",
        subject: "Biology",
        className: "SS 2",
        provider: activeImgProvider,
      });
      const result = await res.json();
      if (result.imageUrl) { setPreviewUrl(result.imageUrl); setPreviewModel(result.model || ""); }
      else toast({ title: "Preview Failed", description: result.error || "Unknown error", variant: "destructive" });
    } catch (err: any) {
      toast({ title: "Preview Failed", description: err.message, variant: "destructive" });
    } finally { setPreviewing(false); }
  };

  const testConnection = async (provider: string) => {
    setTestingProvider(provider);
    try {
      const res = await apiRequest("POST", "/api/superadmin/ai-config/test", { provider });
      const result = await res.json();
      setTestResults(prev => ({ ...prev, [provider]: result }));
    } catch (err: any) {
      setTestResults(prev => ({ ...prev, [provider]: { success: false, message: err.message } }));
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSaveConfig = () => {
    const providers: Record<string, any> = {};
    for (const p of ["openai", "anthropic", "gemini", "nvidia"]) {
      providers[p] = {
        model: merged.providers?.[p as keyof typeof merged.providers]?.model,
        ...(editKeys[p] ? { apiKey: editKeys[p] } : {}),
      };
    }
    saveMutation.mutate({
      provider: merged.provider,
      providers,
      features: merged.features,
      limits: merged.limits,
    });
  };

  const handleSavePrompts = () => {
    const toSave = {
      lessonNote: localPrompts.lessonNote ?? config?.prompts?.lessonNote,
      questionGeneration: localPrompts.questionGeneration ?? config?.prompts?.questionGeneration,
      examGeneration: localPrompts.examGeneration ?? config?.prompts?.examGeneration,
    };
    savePromptsMutation.mutate(toSave);
  };

  const updateProvider = (p: string, field: string, value: string) => {
    setLocalConfig(prev => ({
      ...prev,
      providers: {
        ...merged.providers,
        [p]: { ...merged.providers?.[p as keyof typeof merged.providers], [field]: value },
      } as any,
    }));
  };

  const updateFeature = (key: string, value: boolean) => {
    setLocalConfig(prev => ({
      ...prev,
      features: { ...merged.features, [key]: value } as any,
    }));
  };

  const updateLimit = (key: string, value: string) => {
    setLocalConfig(prev => ({
      ...prev,
      limits: { ...merged.limits, [key]: parseFloat(value) || 0 } as any,
    }));
  };

  if (isLoading) {
    return (
      <SuperAdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </SuperAdminLayout>
    );
  }

  const activeProvider = merged.provider || "openai";
  const budgetPercent = usage?.budget?.usedPercent || 0;

  return (
    <SuperAdminLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 rounded-xl">
              <Brain className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Configuration</h1>
              <p className="text-sm text-gray-500">Manage AI providers, models, usage, costs, and prompts</p>
            </div>
          </div>
          <Badge className={`text-sm px-3 py-1 ${PROVIDER_COLORS[activeProvider]}`}>
            {PROVIDER_ICONS[activeProvider]} Active: {PROVIDER_LABELS[activeProvider]}
          </Badge>
        </div>

        {/* Budget Warning */}
        {usage?.budget?.isWarning && (
          <Alert variant={usage.budget.isExceeded ? "destructive" : "default"} className={usage.budget.isExceeded ? "" : "border-yellow-300 bg-yellow-50"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {usage.budget.isExceeded ? "Monthly Budget Exceeded!" : "AI Usage Approaching Limit"}
            </AlertTitle>
            <AlertDescription>
              ${usage.budget.used.toFixed(2)} of ${usage.budget.monthly.toFixed(2)} monthly budget used ({usage.budget.usedPercent}%).
              {usage.budget.isExceeded && " Consider increasing the budget or reducing AI usage."}
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="overview">
          <TabsList className="w-full flex-wrap h-auto py-1">
            <TabsTrigger value="overview" className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="providers" className="flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5" /> Providers
            </TabsTrigger>
            <TabsTrigger value="features" className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Features
            </TabsTrigger>
            <TabsTrigger value="limits" className="flex items-center gap-1.5">
              <CircleDollarSign className="h-3.5 w-3.5" /> Limits & Budget
            </TabsTrigger>
            <TabsTrigger value="prompts" className="flex items-center gap-1.5">
              <Settings2 className="h-3.5 w-3.5" /> Prompts
            </TabsTrigger>
            <TabsTrigger value="imageai" className="flex items-center gap-1.5">
              <Image className="h-3.5 w-3.5" /> Image AI
            </TabsTrigger>
          </TabsList>

          {/* ── OVERVIEW TAB ─────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Usage Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: "Requests Today", value: usage?.today?.requests ?? 0, icon: "📊", color: "blue" },
                { label: "Requests This Month", value: usage?.month?.requests ?? 0, icon: "📅", color: "indigo" },
                { label: "Tokens Today", value: (usage?.today?.tokens ?? 0).toLocaleString(), icon: "🔤", color: "violet" },
                { label: "Tokens This Month", value: (usage?.month?.tokens ?? 0).toLocaleString(), icon: "📦", color: "purple" },
                { label: "Cost Today", value: `$${(usage?.today?.estimatedCost ?? 0).toFixed(4)}`, icon: "💰", color: "green" },
                { label: "Cost This Month", value: `$${(usage?.month?.estimatedCost ?? 0).toFixed(4)}`, icon: "💵", color: "emerald" },
              ].map((stat) => (
                <Card key={stat.label} className="border shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xl">{stat.icon}</span>
                      {usageLoading && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Budget Progress */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CircleDollarSign className="h-4 w-4 text-green-600" />
                  Monthly Budget
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    ${usage?.budget?.used.toFixed(4) ?? "0.00"} used
                  </span>
                  <span className="font-medium">
                    ${usage?.budget?.monthly.toFixed(2) ?? config?.limits?.monthlyBudget?.toFixed(2) ?? "50.00"} budget
                  </span>
                </div>
                <Progress
                  value={Math.min(budgetPercent, 100)}
                  className={`h-3 ${budgetPercent >= 100 ? "[&>div]:bg-red-500" : budgetPercent >= (usage?.budget?.warningThreshold || 80) ? "[&>div]:bg-yellow-500" : "[&>div]:bg-green-500"}`}
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{budgetPercent}% used</span>
                  <span>Warn at {usage?.budget?.warningThreshold ?? config?.limits?.warningThreshold ?? 80}%</span>
                </div>
              </CardContent>
            </Card>

            {/* Provider Health */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  Provider Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {["openai", "anthropic", "gemini", "nvidia"].map((p) => {
                  const info = config?.providers?.[p as keyof typeof config.providers];
                  const isActive = p === activeProvider;
                  const result = testResults[p];
                  return (
                    <div key={p} className={`flex items-center justify-between p-3 rounded-lg border ${isActive ? "bg-purple-50 border-purple-200" : "bg-gray-50 border-gray-200"}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{PROVIDER_ICONS[p]}</span>
                        <div>
                          <div className="font-medium text-sm flex items-center gap-2">
                            {PROVIDER_LABELS[p]}
                            {isActive && <Badge className="bg-purple-100 text-purple-700 text-xs px-1.5 py-0">Active</Badge>}
                          </div>
                          <div className="text-xs text-gray-500">{info?.model || "Not configured"}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {result && (
                          <span className={`text-xs ${result.success ? "text-green-600" : "text-red-500"}`}>
                            {result.success ? "✓ OK" : "✗ Failed"}
                          </span>
                        )}
                        {info?.apiKeySet ? (
                          <Badge className="bg-green-100 text-green-700 text-xs">Key Set</Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500 text-xs">No Key</Badge>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => testConnection(p)}
                          disabled={testingProvider === p || !info?.apiKeySet}
                        >
                          {testingProvider === p ? <Loader2 className="h-3 w-3 animate-spin" /> : <FlaskConical className="h-3 w-3" />}
                          <span className="ml-1">Test</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* All-time stats + Reset */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="text-sm text-gray-600">
                All-time: <strong>{(usage?.allTime?.requests ?? 0).toLocaleString()}</strong> requests,{" "}
                <strong>{(usage?.allTime?.tokens ?? 0).toLocaleString()}</strong> tokens
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => resetUsageMutation.mutate("today")} className="text-xs h-7">
                  <RotateCcw className="h-3 w-3 mr-1" /> Reset Today
                </Button>
                <Button size="sm" variant="outline" onClick={() => resetUsageMutation.mutate("month")} className="text-xs h-7">
                  <RotateCcw className="h-3 w-3 mr-1" /> Reset Month
                </Button>
                <Button size="sm" variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: ["/api/superadmin/ai-config/usage"] })} className="text-xs h-7">
                  <RefreshCw className="h-3 w-3 mr-1" /> Refresh
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ── PROVIDERS TAB ─────────────────────────────────────────── */}
          <TabsContent value="providers" className="space-y-6 mt-6">
            {/* Active Provider Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Active AI Provider</CardTitle>
                <CardDescription>Select which provider is used for all AI generation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {["openai", "anthropic", "gemini", "nvidia"].map((p) => (
                    <button
                      key={p}
                      onClick={() => setLocalConfig(prev => ({ ...prev, provider: p }))}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        merged.provider === p
                          ? "border-purple-500 bg-purple-50"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <div className="text-2xl mb-2">{PROVIDER_ICONS[p]}</div>
                      <div className="font-semibold text-sm">{PROVIDER_LABELS[p]}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {config?.providers?.[p as keyof typeof config.providers]?.apiKeySet ? "✓ Key configured" : "No key"}
                      </div>
                      {merged.provider === p && (
                        <Badge className="mt-2 bg-purple-100 text-purple-700 text-xs">Selected</Badge>
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Provider Details */}
            {(["openai", "anthropic", "gemini", "nvidia"] as const).map((p) => {
              const info = merged.providers?.[p];
              const models = config?.availableModels?.[p] || [];
              const testResult = testResults[p];
              return (
                <Card key={p} className={p === activeProvider ? "ring-2 ring-purple-300" : ""}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <span>{PROVIDER_ICONS[p]}</span>
                      {PROVIDER_LABELS[p]}
                      {p === activeProvider && <Badge className="bg-purple-100 text-purple-700 text-xs">Active</Badge>}
                      {info?.apiKeyFromEnv && <Badge className="bg-primary/10 text-primary text-xs">Key from ENV</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Model Selection */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Model</Label>
                      <Select
                        value={info?.model || ""}
                        onValueChange={(v) => updateProvider(p, "model", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                        <SelectContent>
                          {models.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* API Key */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        <Key className="h-3.5 w-3.5" />
                        API Key
                        {info?.apiKeySet && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                      </Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            type={showKeys[p] ? "text" : "password"}
                            placeholder={info?.apiKeySet ? info.apiKeyMasked : `Enter ${PROVIDER_LABELS[p]} API key`}
                            value={editKeys[p] || ""}
                            onChange={(e) => setEditKeys(prev => ({ ...prev, [p]: e.target.value }))}
                            className="pr-10 font-mono text-sm"
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            onClick={() => setShowKeys(prev => ({ ...prev, [p]: !prev[p] }))}
                          >
                            {showKeys[p] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testConnection(p)}
                          disabled={testingProvider === p || !info?.apiKeySet}
                          className="shrink-0"
                        >
                          {testingProvider === p ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FlaskConical className="h-4 w-4" />
                          )}
                          <span className="ml-1.5">Test</span>
                        </Button>
                      </div>
                      {info?.apiKeyFromEnv && (
                        <p className="text-xs text-primary">Using key from environment variable. Enter a new key above to override.</p>
                      )}
                      {!info?.apiKeySet && !editKeys[p] && (
                        <p className="text-xs text-gray-500">No API key configured. AI generation will use the template fallback.</p>
                      )}
                      {testResult && (
                        <div className={`flex flex-col gap-1 text-xs p-2 rounded ${testResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                          <div className="flex items-center gap-2">
                            {testResult.success ? <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" /> : <XCircle className="h-3.5 w-3.5 flex-shrink-0" />}
                            <span className="font-medium">{testResult.message}</span>
                          </div>
                          {!testResult.success && testResult.detail && (
                            <p className="ml-5 text-red-600 break-words">{testResult.detail}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            <div className="flex justify-end">
              <Button onClick={handleSaveConfig} disabled={saveMutation.isPending} className="bg-purple-600 hover:bg-purple-700">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Provider Settings
              </Button>
            </div>
          </TabsContent>

          {/* ── FEATURES TAB ─────────────────────────────────────────── */}
          <TabsContent value="features" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI Feature Controls</CardTitle>
                <CardDescription>Enable or disable individual AI-powered features across the school portal</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: "lessonNotes", label: "Lesson Note Generation", desc: "Allow teachers to generate AI-powered lesson notes for any topic", icon: "📝" },
                  { key: "questionGeneration", label: "Question Generation", desc: "AI-assisted exam and quiz question creation", icon: "❓" },
                  { key: "examGeneration", label: "Exam Generation", desc: "Generate complete exam papers with AI", icon: "📋" },
                  { key: "schemeOfWork", label: "Scheme of Work Generation", desc: "Auto-generate term schemes of work for subjects", icon: "🗓️" },
                  { key: "aiAssistant", label: "AI Assistant", desc: "Interactive AI assistant for teachers and students", icon: "🤝" },
                ].map(({ key, label, desc, icon }) => (
                  <div key={key} className="flex items-center justify-between p-4 rounded-lg border bg-gray-50">
                    <div className="flex items-start gap-3">
                      <span className="text-xl mt-0.5">{icon}</span>
                      <div>
                        <div className="font-medium text-sm">{label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                      </div>
                    </div>
                    <Switch
                      checked={merged.features?.[key as keyof typeof merged.features] ?? true}
                      onCheckedChange={(v) => updateFeature(key, v)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSaveConfig} disabled={saveMutation.isPending} className="bg-purple-600 hover:bg-purple-700">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Feature Settings
              </Button>
            </div>
          </TabsContent>

          {/* ── LIMITS & BUDGET TAB ──────────────────────────────────── */}
          <TabsContent value="limits" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Usage Limits</CardTitle>
                <CardDescription>Set per-day and per-generation limits to prevent overuse</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                {[
                  { key: "maxLessonNotesPerDay", label: "Max Lesson Notes Per Day", placeholder: "50", suffix: "notes/day" },
                  { key: "maxWordsPerGeneration", label: "Max Words Per Generation", placeholder: "2000", suffix: "words" },
                ].map(({ key, label, placeholder, suffix }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-sm font-medium">{label}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder={placeholder}
                        value={merged.limits?.[key as keyof typeof merged.limits] ?? ""}
                        onChange={(e) => updateLimit(key, e.target.value)}
                        className="flex-1"
                      />
                      <span className="text-xs text-gray-500 shrink-0">{suffix}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cost Controls</CardTitle>
                <CardDescription>Set monthly spending limits and alert thresholds</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <CircleDollarSign className="h-3.5 w-3.5 text-green-600" />
                      Monthly Budget (USD)
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 font-medium">$</span>
                      <Input
                        type="number"
                        placeholder="50"
                        value={merged.limits?.monthlyBudget ?? ""}
                        onChange={(e) => updateLimit("monthlyBudget", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                      Warning Threshold
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="80"
                        min="1"
                        max="100"
                        value={merged.limits?.warningThreshold ?? ""}
                        onChange={(e) => updateLimit("warningThreshold", e.target.value)}
                      />
                      <span className="text-gray-400 font-medium">%</span>
                    </div>
                    <p className="text-xs text-gray-500">Show alert when usage reaches this % of budget</p>
                  </div>
                </div>

                {/* Current usage vs budget visual */}
                {usage && (
                  <div className="p-4 bg-gray-50 rounded-lg border space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                      <span>Current Month Usage</span>
                      <span>${usage.month.estimatedCost.toFixed(4)} / ${usage.budget.monthly.toFixed(2)}</span>
                    </div>
                    <Progress
                      value={Math.min(budgetPercent, 100)}
                      className={`h-2.5 ${budgetPercent >= 100 ? "[&>div]:bg-red-500" : budgetPercent >= usage.budget.warningThreshold ? "[&>div]:bg-yellow-500" : "[&>div]:bg-green-500"}`}
                    />
                    <div className="text-xs text-gray-500 text-right">{budgetPercent}% used</div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSaveConfig} disabled={saveMutation.isPending} className="bg-purple-600 hover:bg-purple-700">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Limits & Budget
              </Button>
            </div>
          </TabsContent>

          {/* ── PROMPTS TAB ──────────────────────────────────────────── */}
          <TabsContent value="prompts" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">System Prompt Management</CardTitle>
                <CardDescription>
                  Edit the AI prompts used for each feature. Use template variables like{" "}
                  <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{"{topic}"}</code>,{" "}
                  <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{"{className}"}</code>,{" "}
                  <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{"{subjectName}"}</code>,{" "}
                  <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{"{termName}"}</code>,{" "}
                  <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{"{duration}"}</code>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  {[
                    { key: "lessonNote", label: "📝 Lesson Notes" },
                    { key: "questionGeneration", label: "❓ Questions" },
                    { key: "examGeneration", label: "📋 Exams" },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setPromptTab(key)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        promptTab === key
                          ? "bg-purple-100 text-purple-700 border border-purple-300"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  <Textarea
                    rows={22}
                    className="font-mono text-xs resize-y"
                    placeholder="Enter custom prompt or leave as default..."
                    value={
                      localPrompts[promptTab] !== undefined
                        ? localPrompts[promptTab]
                        : (config?.prompts?.[promptTab as keyof typeof config.prompts] || "")
                    }
                    onChange={(e) => setLocalPrompts(prev => ({ ...prev, [promptTab]: e.target.value }))}
                  />
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {(localPrompts[promptTab] ?? config?.prompts?.[promptTab as keyof typeof config.prompts] ?? "").length.toLocaleString()} characters
                    </span>
                    <button
                      className="text-primary hover:underline flex items-center gap-1"
                      disabled={savePromptsMutation.isPending}
                      onClick={() => {
                        const toSave = {
                          lessonNote: promptTab === 'lessonNote' ? "" : (localPrompts.lessonNote ?? config?.prompts?.lessonNote),
                          questionGeneration: promptTab === 'questionGeneration' ? "" : (localPrompts.questionGeneration ?? config?.prompts?.questionGeneration),
                          examGeneration: promptTab === 'examGeneration' ? "" : (localPrompts.examGeneration ?? config?.prompts?.examGeneration),
                        };
                        savePromptsMutation.mutate(toSave, {
                          onSuccess: () => {
                            toast({ title: "Reset to Default", description: "The built-in expert prompt has been restored." });
                          }
                        });
                      }}
                    >
                      <RotateCcw className="h-3 w-3" /> Reset to Default
                    </button>
                  </div>
                </div>

                {/* Variable reference */}
                <div className="bg-gray-50 border rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Available Template Variables:</p>
                  <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                    {[
                      ["{topic}", "The lesson topic name"],
                      ["{className}", "Class name (e.g. SS 2)"],
                      ["{subjectName}", "Subject (e.g. Biology)"],
                      ["{termName}", "Academic term"],
                      ["{duration}", "Lesson duration"],
                    ].map(([v, d]) => (
                      <div key={v} className="flex items-center gap-2">
                        <code className="bg-white border px-1.5 py-0.5 rounded font-mono">{v}</code>
                        <span className="text-gray-500">{d}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSavePrompts} disabled={savePromptsMutation.isPending} className="bg-purple-600 hover:bg-purple-700">
                {savePromptsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Prompts
              </Button>
            </div>
          </TabsContent>

          {/* ── IMAGE AI TAB ─────────────────────────────────────────── */}
          <TabsContent value="imageai" className="space-y-6 mt-6">
            <Alert className="border-orange-200 bg-orange-50">
              <Image className="h-4 w-4 text-orange-600" />
              <AlertTitle className="text-orange-800">AI Image Generation for Lesson Notes</AlertTitle>
              <AlertDescription className="text-orange-700">
                Choose between Cloudflare Workers AI (free tier) or NVIDIA Build API (higher quality) to generate educational diagrams automatically when teachers create lesson notes.
              </AlertDescription>
            </Alert>

            {(cfLoading || nvLoading) ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
              </div>
            ) : (
              <>
                {/* ── Provider selector ── */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-orange-600" /> Active Image Provider
                    </CardTitle>
                    <CardDescription>Select which service generates lesson note images. Both can be configured below; only the active one is used.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {/* Cloudflare option */}
                      <button
                        type="button"
                        onClick={() => setActiveImgProvider("cloudflare")}
                        className={`flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-all ${activeImgProvider === "cloudflare" ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-orange-300"}`}
                      >
                        <span className="text-2xl">☁️</span>
                        <div>
                          <div className="font-semibold text-sm flex items-center gap-2">
                            Cloudflare Workers AI
                            {activeImgProvider === "cloudflare" && <Badge className="bg-orange-500 text-white text-xs">Active</Badge>}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">Free tier · 10,000 neurons/day · FLUX Schnell</div>
                          {cfConfig?.accountIdMasked
                            ? <div className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Credentials configured</div>
                            : <div className="text-xs text-amber-600 mt-1">⚠ Credentials not set</div>}
                        </div>
                      </button>
                      {/* NVIDIA option */}
                      <button
                        type="button"
                        onClick={() => setActiveImgProvider("nvidia")}
                        className={`flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-all ${activeImgProvider === "nvidia" ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-green-300"}`}
                      >
                        <span className="text-2xl">🟢</span>
                        <div>
                          <div className="font-semibold text-sm flex items-center gap-2">
                            NVIDIA Build API
                            {activeImgProvider === "nvidia" && <Badge className="bg-green-600 text-white text-xs">Active</Badge>}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">Higher quality · FLUX.1 Schnell &amp; Dev · Pay-per-use</div>
                          {nvConfig?.apiKeyMasked
                            ? <div className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> API key configured</div>
                            : <div className="text-xs text-amber-600 mt-1">⚠ API key not set</div>}
                        </div>
                      </button>
                    </div>
                    <div className="flex justify-end">
                      <Button size="sm" onClick={handleSaveProvider} disabled={saveProviderMutation.isPending} className="bg-orange-600 hover:bg-orange-700">
                        {saveProviderMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                        Set Active Provider
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* ── Shared prompt template ── */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Settings2 className="h-4 w-4 text-gray-600" /> Shared Prompt Template
                    </CardTitle>
                    <CardDescription>Used by both providers. Customise how the image prompt is built from each lesson's topic, subject, and class.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      rows={4}
                      className="font-mono text-xs resize-y"
                      placeholder="Educational diagram for {topic} in {subject}, class {className}..."
                      value={sharedPromptTemplate}
                      onChange={(e) => setSharedPromptTemplate(e.target.value)}
                    />
                    <div className="bg-gray-50 border rounded p-2 text-xs text-gray-600">
                      <p className="font-semibold mb-1">Template variables:</p>
                      <div className="grid grid-cols-3 gap-1">
                        {[["{topic}", "Lesson note title"], ["{subject}", "Subject name"], ["{className}", "Class (e.g. SS 2)"]].map(([v, d]) => (
                          <div key={v} className="flex items-center gap-1">
                            <code className="bg-white border px-1 rounded">{v}</code>
                            <span className="text-gray-500">{d}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" onClick={handleSaveProvider} disabled={saveProviderMutation.isPending}>
                        {saveProviderMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                        Save Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* ── CLOUDFLARE CONFIG ── */}
                <Card className={activeImgProvider === "cloudflare" ? "ring-2 ring-orange-400" : ""}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <span>☁️</span> Cloudflare Workers AI
                      {activeImgProvider === "cloudflare" && <Badge className="bg-orange-500 text-white text-xs">Active</Badge>}
                    </CardTitle>
                    <CardDescription>Free tier with 10,000 neurons/day. Sign up at dash.cloudflare.com — no credit card needed.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">Enable Cloudflare generation</div>
                      <Switch checked={mergedCf.imageGenEnabled ?? true} onCheckedChange={(v) => setLocalCfConfig(p => ({ ...p, imageGenEnabled: v }))} />
                    </div>

                    {/* Account ID */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        Account ID
                        {cfConfig?.accountIdMasked && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                        {cfConfig?.accountIdFromEnv && <Badge className="bg-primary/10 text-primary text-xs ml-1">ENV</Badge>}
                      </Label>
                      <div className="relative">
                        <Input type={showCfAccountId ? "text" : "password"} placeholder={cfConfig?.accountIdMasked || "Paste Account ID"} value={cfAccountId} onChange={(e) => setCfAccountId(e.target.value)} className="pr-10 font-mono text-sm" />
                        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setShowCfAccountId(p => !p)}>
                          {showCfAccountId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {cfConfig?.accountIdFromEnv && <p className="text-xs text-primary">Using CLOUDFLARE_ACCOUNT_ID env var.</p>}
                    </div>

                    {/* API Token */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        API Token
                        {cfConfig?.apiTokenMasked && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                        {cfConfig?.apiTokenFromEnv && <Badge className="bg-primary/10 text-primary text-xs ml-1">ENV</Badge>}
                      </Label>
                      <div className="relative">
                        <Input type={showCfToken ? "text" : "password"} placeholder={cfConfig?.apiTokenMasked || "Paste API Token"} value={cfApiToken} onChange={(e) => setCfApiToken(e.target.value)} className="pr-10 font-mono text-sm" />
                        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setShowCfToken(p => !p)}>
                          {showCfToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">Create at dash.cloudflare.com → Profile → API Tokens → "Workers AI" template.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">Image Model</Label>
                        <Select value={mergedCf.imageModel || "@cf/black-forest-labs/flux-1-schnell"} onValueChange={(v) => setLocalCfConfig(p => ({ ...p, imageModel: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                          <SelectContent>
                            {(cfConfig?.availableModels || []).map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">Steps (1–20)</Label>
                        <Input type="number" min={1} max={20} value={mergedCf.steps ?? 4} onChange={(e) => setLocalCfConfig(p => ({ ...p, steps: parseInt(e.target.value) || 4 }))} />
                        <p className="text-xs text-gray-500">4 steps is ideal for FLUX Schnell.</p>
                      </div>
                    </div>

                    {/* Test + Save */}
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleTestCf} disabled={cfTesting || (!cfAccountId && !cfConfig?.accountIdMasked)} className="flex-1">
                        {cfTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FlaskConical className="h-4 w-4 mr-2" />}
                        Test Connection
                      </Button>
                      <Button onClick={handleSaveCfConfig} disabled={saveCfMutation.isPending} className="flex-1 bg-orange-600 hover:bg-orange-700">
                        {saveCfMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Cloudflare
                      </Button>
                    </div>
                    {cfTestResult && (
                      <div className={`flex flex-col gap-1 text-xs p-2.5 rounded ${cfTestResult.success ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                        <div className="flex items-center gap-2">
                          {cfTestResult.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                          <span className="font-medium">{cfTestResult.message}</span>
                        </div>
                        {cfTestResult.detail && <p className="ml-5 break-words">{cfTestResult.detail}</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* ── NVIDIA CONFIG ── */}
                <Card className={activeImgProvider === "nvidia" ? "ring-2 ring-green-500" : ""}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <span>🟢</span> NVIDIA Build API
                      {activeImgProvider === "nvidia" && <Badge className="bg-green-600 text-white text-xs">Active</Badge>}
                    </CardTitle>
                    <CardDescription>
                      Uses NVIDIA's hosted FLUX.1 and Stable Diffusion models via <strong>build.nvidia.com</strong>. Higher quality output; requires an NVIDIA API key.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">Enable NVIDIA generation</div>
                      <Switch checked={mergedNv.imageGenEnabled ?? true} onCheckedChange={(v) => setLocalNvConfig(p => ({ ...p, imageGenEnabled: v }))} />
                    </div>

                    {/* API Key */}
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        API Key (nvapi-…)
                        {nvConfig?.apiKeyMasked && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                        {nvConfig?.apiKeyFromEnv && <Badge className="bg-primary/10 text-primary text-xs ml-1">ENV</Badge>}
                        {nvConfig?.apiKeyFromTextAI && <Badge className="bg-purple-100 text-purple-700 text-xs ml-1">From Text AI</Badge>}
                      </Label>
                      <div className="relative">
                        <Input type={showNvidiaKey ? "text" : "password"} placeholder={nvConfig?.apiKeyMasked || "nvapi-…"} value={nvidiaApiKey} onChange={(e) => setNvidiaApiKey(e.target.value)} className="pr-10 font-mono text-sm" />
                        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setShowNvidiaKey(p => !p)}>
                          {showNvidiaKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {nvConfig?.apiKeyFromTextAI && (
                        <p className="text-xs text-purple-600">Reusing API key configured for NVIDIA text AI. Enter above to use a separate image key.</p>
                      )}
                      {nvConfig?.apiKeyFromEnv && (
                        <p className="text-xs text-primary">Using NVIDIA_API_KEY env variable.</p>
                      )}
                      <p className="text-xs text-gray-500">Get your key at <strong>build.nvidia.com</strong> → API Keys. Free credits included on sign-up.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">Image Model</Label>
                        <Select value={mergedNv.imageModel || "black-forest-labs/flux.1-schnell"} onValueChange={(v) => setLocalNvConfig(p => ({ ...p, imageModel: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                          <SelectContent>
                            {(nvConfig?.availableModels || []).map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">Steps (1–50)</Label>
                        <Input type="number" min={1} max={50} value={mergedNv.steps ?? 4} onChange={(e) => setLocalNvConfig(p => ({ ...p, steps: parseInt(e.target.value) || 4 }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">Width (px)</Label>
                        <Select value={String(mergedNv.width ?? 1024)} onValueChange={(v) => setLocalNvConfig(p => ({ ...p, width: parseInt(v) }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["512","768","1024"].map(s => <SelectItem key={s} value={s}>{s}px</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-sm font-medium">Height (px)</Label>
                        <Select value={String(mergedNv.height ?? 1024)} onValueChange={(v) => setLocalNvConfig(p => ({ ...p, height: parseInt(v) }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["512","768","1024"].map(s => <SelectItem key={s} value={s}>{s}px</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleTestNvidia} disabled={nvidiaTesting || (!nvidiaApiKey && !nvConfig?.apiKeyMasked)} className="flex-1">
                        {nvidiaTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FlaskConical className="h-4 w-4 mr-2" />}
                        Test Connection
                      </Button>
                      <Button onClick={handleSaveNvConfig} disabled={saveNvMutation.isPending} className="flex-1 bg-green-700 hover:bg-green-800">
                        {saveNvMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Save NVIDIA
                      </Button>
                    </div>
                    {nvidiaTestResult && (
                      <div className={`flex flex-col gap-1 text-xs p-2.5 rounded ${nvidiaTestResult.success ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                        <div className="flex items-center gap-2">
                          {nvidiaTestResult.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                          <span className="font-medium">{nvidiaTestResult.message}</span>
                        </div>
                        {nvidiaTestResult.detail && <p className="ml-5 break-words">{nvidiaTestResult.detail}</p>}
                      </div>
                    )}

                    {/* NVIDIA setup instructions */}
                    <div className="border rounded-lg p-3 bg-gray-50 text-xs text-gray-600 space-y-1.5">
                      <p className="font-semibold text-gray-700">How to get your NVIDIA API key:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Go to <strong>build.nvidia.com</strong> and sign in with your NVIDIA account</li>
                        <li>Click <strong>Get API Key</strong> in the top right</li>
                        <li>Generate a new key — it starts with <code className="bg-white border px-1 rounded font-mono">nvapi-</code></li>
                        <li>Paste it above. Free credits are included on sign-up.</li>
                        <li>Alternatively, set <code className="bg-white border px-1 rounded font-mono">NVIDIA_API_KEY</code> as an environment variable</li>
                      </ol>
                    </div>
                  </CardContent>
                </Card>

                {/* ── Preview / test generation ── */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Image className="h-4 w-4 text-orange-600" /> Test Image Generation
                    </CardTitle>
                    <CardDescription>
                      Generates a sample using the <strong>currently active provider</strong> ({activeImgProvider === "nvidia" ? "NVIDIA" : "Cloudflare"}) and your saved credentials.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button variant="outline" onClick={handlePreviewImage} disabled={previewing} className="w-full border-orange-300 text-orange-700 hover:bg-orange-50">
                      {previewing
                        ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating via {activeImgProvider === "nvidia" ? "NVIDIA" : "Cloudflare"}…</>
                        : <><Sparkles className="h-4 w-4 mr-2" /> Generate Sample: "Photosynthesis in Plants"</>}
                    </Button>
                    {previewUrl && (
                      <div className="space-y-2">
                        <img src={previewUrl} alt="AI-generated preview" className="w-full rounded-lg border shadow-sm max-h-72 object-contain bg-gray-50" />
                        <p className="text-xs text-gray-500 text-center">
                          Generated via {activeImgProvider === "nvidia" ? "NVIDIA Build API" : "Cloudflare Workers AI"}{previewModel ? ` · ${previewModel}` : ""}. Saved to server.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </SuperAdminLayout>
  );
}
