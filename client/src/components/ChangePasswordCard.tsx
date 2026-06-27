import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Eye, EyeOff, CheckCircle, RotateCcw, ShieldCheck, ChevronRight } from "lucide-react";

interface ChangePasswordLinkCardProps {
  href: string;
}

export function ChangePasswordLinkCard({ href }: ChangePasswordLinkCardProps) {
  return (
    <Card className="dark:bg-slate-800 dark:border-slate-700 hover:shadow-md transition-shadow">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 h-10 w-10 rounded-full bg-primary/5 dark:bg-primary/5 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-primary dark:text-primary/70" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm dark:text-white">Change Password</p>
              <p className="text-xs text-muted-foreground mt-0.5">Update your login credentials securely</p>
            </div>
          </div>
          <Link href={href}>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              data-testid="link-change-password"
            >
              Update
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const defaultForm: PasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function getStrength(pwd: string) {
  if (!pwd) return null;
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { label: "Weak", color: "bg-red-500", textColor: "text-red-600", width: "w-1/4" };
  if (score === 2) return { label: "Fair", color: "bg-amber-500", textColor: "text-amber-600", width: "w-2/4" };
  if (score === 3) return { label: "Good", color: "bg-primary/85", textColor: "text-primary", width: "w-3/4" };
  return { label: "Strong", color: "bg-green-500", textColor: "text-green-600", width: "w-full" };
}

export function ChangePasswordCard() {
  const { toast } = useToast();
  const [form, setForm] = useState<PasswordForm>(defaultForm);
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [success, setSuccess] = useState(false);

  const strength = getStrength(form.newPassword);
  const passwordsMatch = form.newPassword && form.confirmPassword && form.newPassword === form.confirmPassword;
  const passwordsMismatch = form.confirmPassword && form.newPassword !== form.confirmPassword;

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await apiRequest("POST", "/api/auth/change-password", data);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to change password");
      }
      return res.json();
    },
    onSuccess: () => {
      setForm(defaultForm);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
      toast({ title: "Success", description: "Your password has been updated." });
    },
    onError: (error: Error) => {
      toast({
        title: "Change Failed",
        description: error.message || "Could not change password. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!form.currentPassword) {
      toast({ title: "Validation Error", description: "Please enter your current password.", variant: "destructive" });
      return;
    }
    if (!form.newPassword || form.newPassword.length < 6) {
      toast({ title: "Validation Error", description: "New password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (form.newPassword === form.currentPassword) {
      toast({ title: "Validation Error", description: "New password must be different from your current password.", variant: "destructive" });
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      toast({ title: "Validation Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate({ currentPassword: form.currentPassword, newPassword: form.newPassword });
  };

  return (
    <Card className="dark:bg-slate-800 dark:border-slate-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 dark:text-white">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Change Password
        </CardTitle>
        <CardDescription className="dark:text-slate-400">
          Update your login password. Use a strong, unique password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {success && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">Password updated successfully!</span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="cp-current" className="dark:text-slate-200 text-sm font-semibold">
              Current Password
            </Label>
            <div className="relative">
              <Input
                id="cp-current"
                type={show.current ? "text" : "password"}
                value={form.currentPassword}
                onChange={(e) => setForm(f => ({ ...f, currentPassword: e.target.value }))}
                placeholder="Enter current password"
                className="pr-10 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                data-testid="input-current-password"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShow(s => ({ ...s, current: !s.current }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                tabIndex={-1}
              >
                {show.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="cp-new" className="dark:text-slate-200 text-sm font-semibold">
              New Password
            </Label>
            <div className="relative">
              <Input
                id="cp-new"
                type={show.new ? "text" : "password"}
                value={form.newPassword}
                onChange={(e) => setForm(f => ({ ...f, newPassword: e.target.value }))}
                placeholder="Enter new password"
                className="pr-10 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                data-testid="input-new-password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShow(s => ({ ...s, new: !s.new }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                tabIndex={-1}
              >
                {show.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {/* Strength bar */}
            {form.newPassword && strength && (
              <div className="space-y-1">
                <div className="h-1 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full ${strength.color} ${strength.width} transition-all duration-300 rounded-full`} />
                </div>
                <p className={`text-xs font-medium ${strength.textColor}`}>{strength.label} password</p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="cp-confirm" className="dark:text-slate-200 text-sm font-semibold">
              Confirm New Password
            </Label>
            <div className="relative">
              <Input
                id="cp-confirm"
                type={show.confirm ? "text" : "password"}
                value={form.confirmPassword}
                onChange={(e) => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                placeholder="Repeat new password"
                className={`pr-10 dark:bg-slate-900 dark:border-slate-700 dark:text-white ${
                  passwordsMismatch ? "border-red-400 focus-visible:ring-red-400" :
                  passwordsMatch ? "border-green-400 focus-visible:ring-green-400" : ""
                }`}
                data-testid="input-confirm-password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShow(s => ({ ...s, confirm: !s.confirm }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                tabIndex={-1}
              >
                {show.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordsMismatch && (
              <p className="text-xs text-red-500">Passwords do not match</p>
            )}
            {passwordsMatch && (
              <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Passwords match
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button
            onClick={handleSubmit}
            disabled={changePasswordMutation.isPending}
            data-testid="button-change-password"
            className="w-full sm:w-auto"
          >
            {changePasswordMutation.isPending ? (
              <><RotateCcw className="h-4 w-4 mr-2 animate-spin" /> Updating...</>
            ) : (
              <><KeyRound className="h-4 w-4 mr-2" /> Update Password</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
