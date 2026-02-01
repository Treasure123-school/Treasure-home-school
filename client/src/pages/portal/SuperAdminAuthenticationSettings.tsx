import { useState, useEffect } from "react";
import SuperAdminLayout from "@/components/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Lock, 
  ShieldCheck, 
  Clock, 
  UserPlus, 
  AlertOctagon, 
  Save, 
  Monitor, 
  LogIn
} from "lucide-react";

export default function SuperAdminAuthenticationSettings() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/superadmin/settings"],
  });

  const [formData, setFormData] = useState({
    loginIdentifier: 'username',
    enableRememberMe: true,
    enableStudentPortal: true,
    enableAdminPortal: true,
    allowRegistration: false,
    defaultRegistrationRoleId: 4,
    sessionTimeout: 30,
    allowMultipleLogins: false,
    autoDisableInactiveDays: 90,
    requireAdminApproval: true,
    redirectAfterLogin: 'dashboard',
    loginErrorDisplay: 'generic'
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        loginIdentifier: settings.loginIdentifier || 'username',
        enableRememberMe: settings.enableRememberMe ?? true,
        enableStudentPortal: settings.enableStudentPortal ?? true,
        enableAdminPortal: settings.enableAdminPortal ?? true,
        allowRegistration: settings.allowRegistration ?? false,
        defaultRegistrationRoleId: settings.defaultRegistrationRoleId ?? 4,
        sessionTimeout: settings.sessionTimeout ?? 30,
        allowMultipleLogins: settings.allowMultipleLogins ?? false,
        autoDisableInactiveDays: settings.autoDisableInactiveDays ?? 90,
        requireAdminApproval: settings.requireAdminApproval ?? true,
        redirectAfterLogin: settings.redirectAfterLogin || 'dashboard',
        loginErrorDisplay: settings.loginErrorDisplay || 'generic'
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("PUT", "/api/superadmin/settings", data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Authentication settings updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings"] });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const forceLogoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/superadmin/force-logout-all", {});
    },
    onSuccess: () => {
      toast({ title: "Action Complete", description: "All active user sessions have been terminated." });
    }
  });

  if (isLoading) return <SuperAdminLayout><div className="p-8">Loading...</div></SuperAdminLayout>;

  return (
    <SuperAdminLayout>
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Authentication Settings</h1>
            <p className="text-muted-foreground mt-1">Manage portal access, session security, and login behavior.</p>
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
              <Button onClick={() => setIsEditing(true)}>Edit Settings</Button>
            )}
          </div>
        </div>

        {/* 1. LOGIN METHODS */}
        <Card className="border-t-4 border-t-blue-500 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5 text-blue-500" />
              Login Methods
            </CardTitle>
            <CardDescription>Configure how users identify themselves during login.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
              <div className="space-y-0.5">
                <Label className="text-base font-semibold">Login Identifier</Label>
                <p className="text-sm text-muted-foreground">What users enter to log in</p>
              </div>
              <Select 
                disabled={!isEditing} 
                value={formData.loginIdentifier}
                onValueChange={(val) => setFormData({...formData, loginIdentifier: val})}
              >
                <SelectTrigger className="w-[200px] bg-white dark:bg-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="username">Username Only</SelectItem>
                  <SelectItem value="email">Email Only</SelectItem>
                  <SelectItem value="both">Email or Username</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between px-4 py-2">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Enable "Remember Me"</Label>
                <p className="text-xs text-muted-foreground">Allows users to stay logged in across browser restarts</p>
              </div>
              <Switch 
                disabled={!isEditing}
                checked={formData.enableRememberMe}
                onCheckedChange={(val) => setFormData({...formData, enableRememberMe: val})}
              />
            </div>
          </CardContent>
        </Card>

        {/* 2. PORTAL ACCESS CONTROL */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-indigo-500" />
              Portal Access Control
            </CardTitle>
            <CardDescription>Manage visibility and accessibility of different portal areas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                <div className="space-y-0.5">
                  <Label className="font-semibold">Student Portal</Label>
                  <p className="text-xs text-muted-foreground">Allow student access</p>
                </div>
                <Switch 
                  disabled={!isEditing}
                  checked={formData.enableStudentPortal}
                  onCheckedChange={(val) => setFormData({...formData, enableStudentPortal: val})}
                />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                <div className="space-y-0.5">
                  <Label className="font-semibold">Admin Portal</Label>
                  <p className="text-xs text-muted-foreground">Allow administrative access</p>
                </div>
                <Switch 
                  disabled={!isEditing}
                  checked={formData.enableAdminPortal}
                  onCheckedChange={(val) => setFormData({...formData, enableAdminPortal: val})}
                />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                <div className="space-y-0.5">
                  <Label className="font-semibold">Public Registration</Label>
                  <p className="text-xs text-muted-foreground">Allow new user self-signup</p>
                </div>
                <Switch 
                  disabled={!isEditing}
                  checked={formData.allowRegistration}
                  onCheckedChange={(val) => setFormData({...formData, allowRegistration: val})}
                />
              </div>
              <div className="space-y-2 p-4 border rounded-lg bg-card">
                <Label className="text-sm font-semibold">Default Registration Role</Label>
                <Select 
                  disabled={!isEditing || !formData.allowRegistration}
                  value={formData.defaultRegistrationRoleId.toString()}
                  onValueChange={(val) => setFormData({...formData, defaultRegistrationRoleId: parseInt(val)})}
                >
                  <SelectTrigger className="w-full bg-white dark:bg-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">Student</SelectItem>
                    <SelectItem value="5">Parent</SelectItem>
                    <SelectItem value="3">Teacher (Pending Approval)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. SESSION MANAGEMENT */}
        <Card className="border-t-4 border-t-red-500 shadow-sm overflow-hidden">
          <CardHeader className="bg-red-50/50 dark:bg-red-950/10">
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Clock className="h-5 w-5" />
              Session Management
            </CardTitle>
            <CardDescription>Critical settings for user session lifecycle and security.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4">
              <div className="space-y-0.5">
                <Label className="font-semibold">Session Timeout</Label>
                <p className="text-sm text-muted-foreground">Auto-logout after inactivity</p>
              </div>
              <div className="flex items-center gap-2">
                <Input 
                  type="number"
                  className="w-24 text-right"
                  disabled={!isEditing}
                  value={formData.sessionTimeout}
                  onChange={(e) => setFormData({...formData, sessionTimeout: parseInt(e.target.value) || 0})}
                />
                <span className="text-sm font-medium">minutes</span>
              </div>
            </div>

            <div className="flex items-center justify-between px-4 py-2 border-t border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-0.5">
                <Label className="font-semibold">Allow Multiple Logins</Label>
                <p className="text-xs text-muted-foreground">Can one account be used on multiple devices simultaneously?</p>
              </div>
              <Switch 
                disabled={!isEditing}
                checked={formData.allowMultipleLogins}
                onCheckedChange={(val) => setFormData({...formData, allowMultipleLogins: val})}
              />
            </div>

            <div className="px-4 py-2 bg-red-50/30 dark:bg-red-950/5 rounded-lg border border-red-100 dark:border-red-900/30 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-red-600 dark:text-red-400">Security Reset</h4>
                <p className="text-xs text-muted-foreground">Immediately terminate all active sessions for all users.</p>
              </div>
              <Button 
                variant="destructive" 
                size="sm"
                className="font-bold shadow-sm"
                onClick={() => forceLogoutMutation.mutate()}
                disabled={forceLogoutMutation.isPending}
              >
                <AlertOctagon className="h-4 w-4 mr-2" />
                Force Logout All Users
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 4. ACCOUNT STATE RULES */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
              <ShieldCheck className="h-5 w-5" />
              Account Rules
            </CardTitle>
            <CardDescription>Rules governing account lifecycle and first-time access.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4">
              <div className="space-y-0.5">
                <Label className="font-semibold">Auto-disable Inactive Accounts</Label>
                <p className="text-sm text-muted-foreground">Mark accounts as suspended after no activity</p>
              </div>
              <div className="flex items-center gap-2">
                <Input 
                  type="number"
                  className="w-24 text-right"
                  disabled={!isEditing}
                  value={formData.autoDisableInactiveDays}
                  onChange={(e) => setFormData({...formData, autoDisableInactiveDays: parseInt(e.target.value) || 0})}
                />
                <span className="text-sm font-medium">days</span>
              </div>
            </div>

            <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-0.5">
                <Label className="font-semibold">Admin Approval Required</Label>
                <p className="text-xs text-muted-foreground">New accounts must be verified by an admin before login</p>
              </div>
              <Switch 
                disabled={!isEditing}
                checked={formData.requireAdminApproval}
                onCheckedChange={(val) => setFormData({...formData, requireAdminApproval: val})}
              />
            </div>
          </CardContent>
        </Card>

        {/* 5. LOGIN FLOW */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-500" />
              Login Flow
            </CardTitle>
            <CardDescription>Customize the user experience during and after authentication.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">After Login Redirect To</Label>
                <Select 
                  disabled={!isEditing}
                  value={formData.redirectAfterLogin}
                  onValueChange={(val) => setFormData({...formData, redirectAfterLogin: val})}
                >
                  <SelectTrigger className="w-full bg-white dark:bg-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dashboard">Dashboard</SelectItem>
                    <SelectItem value="last_page">Last Visited Page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Login Error Messages</Label>
                <Select 
                  disabled={!isEditing}
                  value={formData.loginErrorDisplay}
                  onValueChange={(val) => setFormData({...formData, loginErrorDisplay: val})}
                >
                  <SelectTrigger className="w-full bg-white dark:bg-slate-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="generic">Generic (Safer)</SelectItem>
                    <SelectItem value="detailed">Detailed (Better UX)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
