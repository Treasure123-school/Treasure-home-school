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
  ShieldAlert, 
  KeyRound, 
  UserLock, 
  RotateCcw, 
  Fingerprint, 
  Save,
  LogOut
} from "lucide-react";

export default function SuperAdminSecurityPolicies() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/superadmin/settings"],
  });

  const [formData, setFormData] = useState({
    minPasswordLength: 8,
    requirePasswordNumbers: true,
    requirePasswordLetters: true,
    requirePasswordSpecial: true,
    maxFailedLoginAttempts: 5,
    enableLockAccount: true,
    lockoutDuration: 15,
    passwordResetExpiry: 30,
    invalidateOldPasswordOnReset: true,
    enableTwoFactor: false,
    twoFactorTarget: 'admins',
    logoutOnPasswordChange: true
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        minPasswordLength: settings.minPasswordLength ?? 8,
        requirePasswordNumbers: settings.requirePasswordNumbers ?? true,
        requirePasswordLetters: settings.requirePasswordLetters ?? true,
        requirePasswordSpecial: settings.requirePasswordSpecial ?? true,
        maxFailedLoginAttempts: settings.maxFailedLoginAttempts ?? 5,
        enableLockAccount: settings.enableLockAccount ?? true,
        lockoutDuration: settings.lockoutDuration ?? 15,
        passwordResetExpiry: settings.passwordResetExpiry ?? 30,
        invalidateOldPasswordOnReset: settings.invalidateOldPasswordOnReset ?? true,
        enableTwoFactor: settings.enableTwoFactor ?? false,
        twoFactorTarget: settings.twoFactorTarget ?? 'admins',
        logoutOnPasswordChange: settings.logoutOnPasswordChange ?? true
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("PUT", "/api/superadmin/settings", data);
    },
    onSuccess: () => {
      toast({ title: "Policies Updated", description: "Security policies have been successfully saved." });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/settings"] });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  if (isLoading) return <SuperAdminLayout><div className="p-8">Loading policies...</div></SuperAdminLayout>;

  return (
    <SuperAdminLayout>
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Security Policies</h1>
            <p className="text-muted-foreground mt-1">Configure global protection rules and system-wide security standards.</p>
          </div>
          <div className="flex gap-3">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Policies
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>Edit Policies</Button>
            )}
          </div>
        </div>

        {/* 1. PASSWORD POLICY */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-blue-600" />
              Password Policy
            </CardTitle>
            <CardDescription>Set minimum requirements for user account passwords.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50/50 dark:bg-slate-900/20">
              <div className="space-y-0.5">
                <Label className="text-base font-semibold">Minimum Length</Label>
                <p className="text-xs text-muted-foreground">Shortest allowed password</p>
              </div>
              <div className="flex items-center gap-2">
                <Input 
                  type="number"
                  className="w-20 text-center"
                  disabled={!isEditing}
                  value={formData.minPasswordLength}
                  onChange={(e) => setFormData({...formData, minPasswordLength: parseInt(e.target.value) || 0})}
                />
                <span className="text-sm font-medium">chars</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <Label className="text-sm font-medium">Require Numbers</Label>
                <Switch 
                  disabled={!isEditing}
                  checked={formData.requirePasswordNumbers}
                  onCheckedChange={(val) => setFormData({...formData, requirePasswordNumbers: val})}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <Label className="text-sm font-medium">Require Letters</Label>
                <Switch 
                  disabled={!isEditing}
                  checked={formData.requirePasswordLetters}
                  onCheckedChange={(val) => setFormData({...formData, requirePasswordLetters: val})}
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <Label className="text-sm font-medium">Require Special Chars</Label>
                <Switch 
                  disabled={!isEditing}
                  checked={formData.requirePasswordSpecial}
                  onCheckedChange={(val) => setFormData({...formData, requirePasswordSpecial: val})}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. LOGIN PROTECTION */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-orange-500" />
              Login Protection
            </CardTitle>
            <CardDescription>Prevent brute-force attacks by limiting failed attempts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg bg-card">
              <div className="space-y-0.5">
                <Label className="text-base font-semibold">Max Failed Attempts</Label>
                <p className="text-sm text-muted-foreground">Attempts allowed before action</p>
              </div>
              <Input 
                type="number"
                className="w-24 text-right"
                disabled={!isEditing}
                value={formData.maxFailedLoginAttempts}
                onChange={(e) => setFormData({...formData, maxFailedLoginAttempts: parseInt(e.target.value) || 0})}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label className="font-semibold">Lock Account</Label>
                  <p className="text-xs text-muted-foreground">Temporarily disable account after max failures</p>
                </div>
                <Switch 
                  disabled={!isEditing}
                  checked={formData.enableLockAccount}
                  onCheckedChange={(val) => setFormData({...formData, enableLockAccount: val})}
                />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label className="font-semibold">Lock Duration</Label>
                  <p className="text-xs text-muted-foreground">Time before auto-unlock</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input 
                    type="number"
                    className="w-20 text-center"
                    disabled={!isEditing || !formData.enableLockAccount}
                    value={formData.lockoutDuration}
                    onChange={(e) => setFormData({...formData, lockoutDuration: parseInt(e.target.value) || 0})}
                  />
                  <span className="text-xs font-medium">mins</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. PASSWORD RESET */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-indigo-500" />
              Password Reset
            </CardTitle>
            <CardDescription>Rules for handling forgotten passwords and recovery.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-base font-semibold">Link Expiry</Label>
                <p className="text-sm text-muted-foreground">How long the reset link stays valid</p>
              </div>
              <div className="flex items-center gap-2">
                <Input 
                  type="number"
                  className="w-24 text-right"
                  disabled={!isEditing}
                  value={formData.passwordResetExpiry}
                  onChange={(e) => setFormData({...formData, passwordResetExpiry: parseInt(e.target.value) || 0})}
                />
                <span className="text-sm font-medium">minutes</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
              <div className="space-y-0.5">
                <Label className="font-semibold">Invalidate Old Password</Label>
                <p className="text-xs text-muted-foreground">Force previous password to expire immediately on reset</p>
              </div>
              <Switch 
                disabled={!isEditing}
                checked={formData.invalidateOldPasswordOnReset}
                onCheckedChange={(val) => setFormData({...formData, invalidateOldPasswordOnReset: val})}
              />
            </div>
          </CardContent>
        </Card>

        {/* 4. TWO-FACTOR AUTHENTICATION */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5 text-teal-600" />
              Two-Factor Authentication
            </CardTitle>
            <CardDescription>Add an extra layer of security via mobile authenticator apps.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-base font-semibold">Enable 2FA</Label>
                <p className="text-sm text-muted-foreground">Require secondary code for login</p>
              </div>
              <Switch 
                disabled={!isEditing}
                checked={formData.enableTwoFactor}
                onCheckedChange={(val) => setFormData({...formData, enableTwoFactor: val})}
              />
            </div>
            <div className="space-y-2 p-4 border rounded-lg bg-card">
              <Label className="text-sm font-semibold">Apply To</Label>
              <Select 
                disabled={!isEditing || !formData.enableTwoFactor}
                value={formData.twoFactorTarget}
                onValueChange={(val) => setFormData({...formData, twoFactorTarget: val})}
              >
                <SelectTrigger className="w-full bg-white dark:bg-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admins">Administrators Only (Recommended)</SelectItem>
                  <SelectItem value="all">All System Users</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 5. SESSION SECURITY */}
        <Card className="shadow-sm border-l-4 border-l-amber-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5 text-amber-600" />
              Session Security
            </CardTitle>
            <CardDescription>Enhance protection for active user sessions.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg bg-amber-50/20 dark:bg-amber-950/10">
              <div className="space-y-0.5">
                <Label className="font-semibold">Force Logout on Password Change</Label>
                <p className="text-xs text-muted-foreground">Terminates all sessions on other devices after a password update</p>
              </div>
              <Switch 
                disabled={!isEditing}
                checked={formData.logoutOnPasswordChange}
                onCheckedChange={(val) => setFormData({...formData, logoutOnPasswordChange: val})}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
