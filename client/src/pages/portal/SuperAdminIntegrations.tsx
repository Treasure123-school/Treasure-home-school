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
  Settings2, 
  Mail, 
  MessageSquare, 
  CreditCard,
  Save,
  Puzzle
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
              <Puzzle className="h-5 w-5 text-blue-600" />
              Service Toggles
            </CardTitle>
            <CardDescription>Enable or disable specific external system integrations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-blue-600" />
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
