import { useState, useEffect } from "react";
import SuperAdminLayout from "@/components/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Key, 
  RefreshCw, 
  ShieldCheck, 
  Save, 
  Info,
  Ban
} from "lucide-react";
import type { SystemSettings } from "@shared/schema";

export default function SuperAdminApiAccess() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ["/api/superadmin/settings"],
  });

  const [formData, setFormData] = useState({
    enableApiAccess: false
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        enableApiAccess: settings.enableApiAccess ?? false
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("PUT", "/api/superadmin/settings", data);
    },
    onSuccess: () => {
      toast({ title: "API Settings Saved", description: "API access status has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings"] });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const generateKeyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/superadmin/api-keys/generate", {});
    },
    onSuccess: () => {
      toast({ title: "API Key Generated", description: "A new API access key has been created." });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings"] });
    }
  });

  if (isLoading) return <SuperAdminLayout><div className="p-8">Loading API settings...</div></SuperAdminLayout>;

  return (
    <SuperAdminLayout>
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">API & Access Tokens</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border">Advanced</span>
                <p className="text-muted-foreground">Manage external system access to school data.</p>
              </div>
            </div>
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
              <Button onClick={() => setIsEditing(true)}>Edit API Settings</Button>
            )}
          </div>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              API Access Control
            </CardTitle>
            <CardDescription>Grant external applications permission to interact with the system.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-indigo-50/20 dark:bg-indigo-900/10">
              <div className="space-y-0.5">
                <Label className="text-base font-semibold">Enable API Access</Label>
                <p className="text-sm text-muted-foreground">Allow external systems to connect via API</p>
              </div>
              <Switch 
                disabled={!isEditing}
                checked={formData.enableApiAccess}
                onCheckedChange={(val) => setFormData({...formData, enableApiAccess: val})}
              />
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Current API Key</Label>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={!formData.enableApiAccess}
                    onClick={() => generateKeyMutation.mutate()}
                  >
                    <RefreshCw className={`h-3 w-3 mr-2 ${generateKeyMutation.isPending ? 'animate-spin' : ''}`} />
                    Generate New Key
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" disabled={!settings?.apiAccessKey}>
                    <Ban className="h-3 w-3 mr-2" />
                    Revoke Key
                  </Button>
                </div>
              </div>
              <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/50 font-mono text-sm break-all flex items-center justify-between group">
                {settings?.apiAccessKey ? (
                  <>
                    <span className="text-slate-600 dark:text-slate-400">
                      {isEditing ? settings.apiAccessKey : '••••••••••••••••••••••••••••••••'}
                    </span>
                    <Key className="h-4 w-4 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
                  </>
                ) : (
                  <span className="text-muted-foreground italic">No API key generated</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-50 border-dashed dark:bg-slate-900/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Info className="h-5 w-5 text-indigo-600 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Security Notice</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  API keys grant full access to sensitive school data. Only share these keys with trusted third-party services. If you suspect a key has been compromised, revoke and regenerate it immediately.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
