import { useState, useEffect } from "react";
import SuperAdminLayout from "@/components/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Database, 
  RefreshCw, 
  History, 
  Save, 
  AlertCircle,
  Calendar
} from "lucide-react";
import type { SystemSettings } from "@shared/schema";
import { format } from "date-fns";

export default function SuperAdminBackupRestore() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ["/api/superadmin/settings"],
  });

  const [formData, setFormData] = useState({
    autoBackup: false,
    backupFrequency: 'daily'
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        autoBackup: settings.autoBackup ?? false,
        backupFrequency: settings.backupFrequency ?? 'daily'
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("PUT", "/api/superadmin/settings", data);
    },
    onSuccess: () => {
      toast({ title: "Backup Settings Saved", description: "Automated backup configuration has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings"] });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const runBackupMutation = useMutation({
    mutationFn: async () => {
      // In a real app, this would trigger a server-side backup process
      return apiRequest("POST", "/api/superadmin/backups/run", {});
    },
    onSuccess: () => {
      toast({ title: "Backup Started", description: "Manual system backup process has been initiated." });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings"] });
    }
  });

  if (isLoading) return <SuperAdminLayout><div className="p-8">Loading backup settings...</div></SuperAdminLayout>;

  return (
    <SuperAdminLayout>
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Backup & Restore</h1>
            <p className="text-muted-foreground mt-1">Protect and recover school data.</p>
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
              <Button onClick={() => setIsEditing(true)}>Edit Backup Config</Button>
            )}
          </div>
        </div>

        {/* BACKUP SECTION */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              System Backup
            </CardTitle>
            <CardDescription>Configure how and when the system secures data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50/30 dark:bg-blue-900/10">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-base font-semibold">Manual Backup</Label>
                  <p className="text-sm text-muted-foreground">Trigger an immediate full system backup</p>
                </div>
              </div>
              <Button onClick={() => runBackupMutation.mutate()} disabled={runBackupMutation.isPending}>
                <RefreshCw className={`h-4 w-4 mr-2 ${runBackupMutation.isPending ? 'animate-spin' : ''}`} />
                {runBackupMutation.isPending ? 'Backing up...' : 'Run Backup Now'}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label className="font-semibold">Auto Backup</Label>
                  <p className="text-xs text-muted-foreground">Enable scheduled system backups</p>
                </div>
                <Switch 
                  disabled={!isEditing}
                  checked={formData.autoBackup}
                  onCheckedChange={(val) => setFormData({...formData, autoBackup: val})}
                />
              </div>
              <div className="space-y-2 p-4 border rounded-lg">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Backup Frequency</Label>
                <Select 
                  disabled={!isEditing || !formData.autoBackup}
                  value={formData.backupFrequency}
                  onValueChange={(val) => setFormData({...formData, backupFrequency: val})}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily (Recommended)</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <History className="h-4 w-4" />
                Last Successful Backup:
              </div>
              <span className="text-sm font-medium">
                {settings?.lastBackupDate ? format(new Date(settings.lastBackupDate), 'PPp') : 'Never'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* RESTORE SECTION */}
        <Card className="shadow-sm border-l-4 border-l-red-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              System Restore
            </CardTitle>
            <CardDescription>Recover system data from a previous backup point.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-lg p-6 flex flex-col items-center text-center space-y-4">
              <p className="text-sm text-red-700 dark:text-red-400 max-w-md">
                Restoring will overwrite current system data with the content of the selected backup. This action is destructive and cannot be undone.
              </p>
              <Button variant="destructive" size="lg">
                <History className="h-4 w-4 mr-2" />
                Restore System from Backup
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
