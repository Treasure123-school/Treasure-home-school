import { useState, useEffect } from "react";
import SuperAdminLayout from "@/components/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Settings2, 
  Mail, 
  MessageSquare, 
  CreditCard,
  Save,
  Puzzle,
  Key,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import type { SystemSettings } from "@shared/schema";

export default function SuperAdminIntegrations() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ["/api/superadmin/settings"],
  });

  const [formData, setFormData] = useState({
    enableEmailNotifications: true,
    enableSmsNotifications: false,
    enableOnlinePayments: false
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        enableEmailNotifications: settings.enableEmailNotifications ?? true,
        enableSmsNotifications: settings.enableSmsNotifications ?? false,
        enableOnlinePayments: settings.enableOnlinePayments ?? false
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("PUT", "/api/superadmin/settings", data);
    },
    onSuccess: () => {
      toast({ title: "Integrations Updated", description: "Integration statuses have been saved." });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings"] });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  if (isLoading) return <SuperAdminLayout><div className="p-8">Loading integrations...</div></SuperAdminLayout>;

  return (
    <SuperAdminLayout>
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
            <p className="text-muted-foreground mt-1">Manage connection status for external services.</p>
          </div>
          <div className="flex gap-3">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>Edit Integrations</Button>
            )}
          </div>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Puzzle className="h-5 w-5 text-primary" />
              Service Toggles
            </CardTitle>
            <CardDescription>Enable or disable specific external system integrations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 dark:bg-primary/5 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Send automated emails for academic updates</p>
                </div>
              </div>
              <Switch 
                disabled={!isEditing}
                checked={formData.enableEmailNotifications}
                onCheckedChange={(val) => setFormData({...formData, enableEmailNotifications: val})}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-green-600" />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold">SMS Notifications</Label>
                  <p className="text-sm text-muted-foreground">Send text messages for urgent announcements</p>
                </div>
              </div>
              <Switch 
                disabled={!isEditing}
                checked={formData.enableSmsNotifications}
                onCheckedChange={(val) => setFormData({...formData, enableSmsNotifications: val})}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-purple-600" />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold">Online Payments</Label>
                  <p className="text-sm text-muted-foreground">Enable online school fee collection via gateway</p>
                </div>
              </div>
              <Switch 
                disabled={!isEditing}
                checked={formData.enableOnlinePayments}
                onCheckedChange={(val) => setFormData({...formData, enableOnlinePayments: val})}
              />
            </div>
          </CardContent>
        </Card>

        {/* Paystack Configuration Guide */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-purple-600" />
              Paystack Payment Gateway Setup
            </CardTitle>
            <CardDescription>
              Configure Paystack to enable students to pay exam fees online.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-xs font-bold text-purple-700 dark:text-purple-300 shrink-0 mt-0.5">1</div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Create a Paystack account</p>
                  <p className="text-xs text-muted-foreground">Sign up at paystack.com and complete business verification.</p>
                  <a
                    href="https://paystack.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    paystack.com <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-xs font-bold text-purple-700 dark:text-purple-300 shrink-0 mt-0.5">2</div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Get your API keys</p>
                  <p className="text-xs text-muted-foreground">Go to Settings → API Keys & Webhooks in your Paystack dashboard to copy your keys.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-xs font-bold text-purple-700 dark:text-purple-300 shrink-0 mt-0.5">3</div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Add keys to environment variables</p>
                  <p className="text-xs text-muted-foreground">Set the following in your server environment (the <code className="bg-muted px-1 py-0.5 rounded text-xs">.env</code> file):</p>
                  <div className="mt-2 p-2 bg-slate-900 dark:bg-black rounded-md font-mono text-xs text-green-400 space-y-1">
                    <div>PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxx</div>
                    <div>PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxx</div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Use <code className="bg-muted px-1 py-0.5 rounded">sk_test_</code> / <code className="bg-muted px-1 py-0.5 rounded">pk_test_</code> keys for testing first.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-xs font-bold text-purple-700 dark:text-purple-300 shrink-0 mt-0.5">4</div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Configure webhook URL (optional but recommended)</p>
                  <p className="text-xs text-muted-foreground">In Paystack dashboard, add your webhook URL to receive instant payment confirmations even if a student closes their browser:</p>
                  <div className="mt-1 p-2 bg-slate-900 dark:bg-black rounded-md font-mono text-xs text-primary/70">
                    https://your-domain.com/api/exam-payments/webhook
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-xs font-bold text-purple-700 dark:text-purple-300 shrink-0 mt-0.5">5</div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Enable online payments & set exam fee</p>
                  <p className="text-xs text-muted-foreground">Toggle "Online Payments" above, then go to <strong>Admin Settings → Exam Payments</strong> to set the exam fee amount and enable payment requirement.</p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-200">
                The secret key is never exposed to students. All payment verification is done server-to-server with Paystack's API. Students are identified automatically from their login session — no manual input required.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* OpenAI AI Generation Setup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-600" />
              AI Lesson Note Generation (OpenAI)
            </CardTitle>
            <CardDescription>
              Configure OpenAI to enable teachers to generate complete, curriculum-aligned lesson notes instantly with AI.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-xs font-bold text-violet-700 dark:text-violet-300 shrink-0 mt-0.5">1</div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Create an OpenAI account</p>
                  <p className="text-xs text-muted-foreground">Sign up at platform.openai.com and add billing (GPT-4o Mini is very affordable — ~$0.001 per lesson note).</p>
                  <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    platform.openai.com <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-xs font-bold text-violet-700 dark:text-violet-300 shrink-0 mt-0.5">2</div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Generate an API key</p>
                  <p className="text-xs text-muted-foreground">Go to <strong>API Keys</strong> in the OpenAI dashboard and create a new secret key.</p>
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    platform.openai.com/api-keys <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-xs font-bold text-violet-700 dark:text-violet-300 shrink-0 mt-0.5">3</div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Add the key to Replit Secrets</p>
                  <p className="text-xs text-muted-foreground">In the Replit sidebar, open <strong>Secrets</strong> and add:</p>
                  <div className="mt-2 p-2 bg-slate-900 dark:bg-black rounded-md font-mono text-xs text-green-400">
                    OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Restart the server after adding the key for it to take effect.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-xs font-bold text-violet-700 dark:text-violet-300 shrink-0 mt-0.5">4</div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Teachers can now generate lesson notes</p>
                  <p className="text-xs text-muted-foreground">When creating a new lesson note, teachers click <strong>"Generate with AI"</strong> — the system uses GPT-4o Mini to produce a fully structured, curriculum-aligned lesson note in seconds based on the topic, class, and subject.</p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
              <CheckCircle2 className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
              <p className="text-xs text-violet-800 dark:text-violet-200">
                If no API key is configured, the system automatically falls back to a structured template — teachers can still generate a lesson note outline and fill in the details manually.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-50 border-dashed dark:bg-slate-900/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Settings2 className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Service Credentials</p>
                <p className="text-xs text-muted-foreground mt-1">
                  API keys and secrets for these services are managed securely via environment variables and are not exposed in the UI.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
