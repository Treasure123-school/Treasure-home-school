import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GraduationCap, CheckCircle, AlertCircle, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Link, useLocation } from 'wouter';

interface SettingsData {
  schoolName: string;
  schoolMotto: string;
}

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters').regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one uppercase letter, one lowercase letter, and one number'
  ),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export default function ResetPassword() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: settings } = useQuery<SettingsData>({
    queryKey: ["/api/public/settings"],
    refetchInterval: 5000,
  });

  const schoolName = settings?.schoolName || "";
  const schoolMotto = settings?.schoolMotto || "";

  const [token, setToken] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      toast({
        title: "Invalid Reset Link",
        description: '❌ No reset token found. Please request a new password reset link.',
        className: 'border-red-500 bg-red-50 dark:bg-red-950/50',
      });
    }
  }, [toast]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordForm) => {
      if (!token) {
        throw new Error('No reset token found');
      }
      const response = await apiRequest('POST', '/api/auth/reset-password', {
        token,
        newPassword: data.newPassword,
      });
      return await response.json();
    },
    onSuccess: () => {
      setResetSuccess(true);
      toast({
        title: "Password Reset Successful",
        description: '✅ Your password has been reset successfully. You can now login with your new password.',
        className: 'border-green-500 bg-green-50 dark:bg-green-950/50',
      });

      setTimeout(() => {
        navigate('/login');
      }, 3000);
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Failed to reset password. The link may have expired.';
      toast({
        title: "Reset Failed",
        description: `❌ ${errorMessage}`,
        className: 'border-red-500 bg-red-50 dark:bg-red-950/50',
      });
    },
  });

  const onSubmit = (data: ResetPasswordForm) => {
    resetPasswordMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-3 mb-6" data-testid="link-home">
            <div className="bg-primary rounded-lg p-3">
              <GraduationCap className="text-primary-foreground h-8 w-8" />
            </div>
            <div className="text-left">
              <h1 className="text-xl font-bold text-foreground">{schoolName}</h1>
              <p className="text-sm text-muted-foreground">{schoolMotto}</p>
            </div>
          </Link>
          <h2 className="text-2xl font-bold text-foreground" data-testid="text-title">
            🔐 Reset Your Password
          </h2>
          <p className="text-muted-foreground text-sm" data-testid="text-subtitle">
            Create a strong, secure password to protect your account
          </p>
        </div>

        <Card className="shadow-lg border border-border" data-testid="card-reset-password">
          <CardHeader className="space-y-1">
            <CardTitle className="text-center">Set New Password</CardTitle>
          </CardHeader>
          <CardContent>
            {!resetSuccess && token ? (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="newPassword" className="text-sm font-medium">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    {...register('newPassword')}
                    className="mt-2"
                    placeholder="Create a strong password"
                    data-testid="input-new-password"
                  />
                  {errors.newPassword && (
                    <p className="text-destructive text-sm mt-1 flex items-center gap-1" data-testid="error-new-password">
                      <AlertCircle className="h-3 w-3" />
                      {errors.newPassword.message}
                    </p>
                  )}
                  <div className="mt-2 p-3 bg-primary/5 dark:bg-primary/5 rounded-md border border-primary/30 dark:border-primary/30">
                    <p className="text-xs font-medium text-primary dark:text-primary/30 mb-2">Password must include:</p>
                    <ul className="text-xs text-primary dark:text-primary/50 space-y-1">
                      <li className="flex items-center gap-1.5">
                        <span className="text-primary dark:text-primary/70">✓</span>
                        At least 8 characters long
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="text-primary dark:text-primary/70">✓</span>
                        One uppercase letter (A-Z)
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="text-primary dark:text-primary/70">✓</span>
                        One lowercase letter (a-z)
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="text-primary dark:text-primary/70">✓</span>
                        One number (0-9)
                      </li>
                    </ul>
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    {...register('confirmPassword')}
                    className="mt-2"
                    placeholder="Re-enter your new password"
                    data-testid="input-confirm-password"
                  />
                  {errors.confirmPassword && (
                    <p className="text-destructive text-sm mt-1" data-testid="error-confirm-password">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <div className="p-3 bg-primary/5 dark:bg-primary/5 rounded-lg border border-primary/30 dark:border-primary/30">
                  <p className="text-sm text-primary dark:text-primary/50">
                    <strong>Security Tips:</strong> Use a mix of uppercase and lowercase letters, numbers, 
                    and symbols. Avoid using personal information.
                  </p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={resetPasswordMutation.isPending}
                  data-testid="button-submit"
                >
                  {resetPasswordMutation.isPending ? 'Resetting Password...' : 'Reset Password'}
                </Button>
              </form>
            ) : resetSuccess ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg border-2 border-green-300 dark:border-green-700">
                  <div className="p-2 bg-green-600 rounded-full flex-shrink-0">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-sm text-green-900 dark:text-green-100">
                    <p className="font-semibold text-base mb-2">🎉 Success! Password Reset Complete</p>
                    <p className="text-green-800 dark:text-green-200">
                      Your password has been successfully updated. You can now login with your new password.
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-3 flex items-center gap-1.5">
                      <span className="inline-block h-1.5 w-1.5 bg-green-600 rounded-full animate-pulse"></span>
                      Redirecting to login page...
                    </p>
                  </div>
                </div>

                <div className="text-center">
                  <Link 
                    href="/login" 
                    className="inline-flex items-center gap-2 text-primary text-sm font-medium hover:underline"
                    data-testid="link-login"
                  >
                    <span>Go to Login Now</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 sm:p-5 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 rounded-lg border-2 border-red-300 dark:border-red-700">
                  <div className="p-2 bg-red-600 rounded-full flex-shrink-0">
                    <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <div className="text-xs sm:text-sm text-red-900 dark:text-red-100">
                    <p className="font-semibold text-sm sm:text-base mb-2">⚠️ Reset Link Invalid or Expired</p>
                    <p className="text-red-800 dark:text-red-200">
                      This password reset link is no longer valid. Reset links expire after 15 minutes for security purposes, or the link may have already been used.
                    </p>
                  </div>
                </div>

                <div className="p-3 sm:p-4 bg-primary/5 dark:bg-primary/5 rounded-lg border border-primary/30 dark:border-primary/30">
                  <p className="text-xs sm:text-sm font-medium text-primary dark:text-primary/30 mb-2">📋 Next Steps:</p>
                  <ul className="text-[10px] sm:text-xs text-primary dark:text-primary/50 space-y-1.5 ml-4 list-disc">
                    <li>Return to the <strong>Forgot Password</strong> page</li>
                    <li>Request a new password reset link with your username/email</li>
                    <li>Check your email inbox (and spam folder)</li>
                    <li>Complete the reset within 15 minutes of receiving the new link</li>
                    <li>Contact your class teacher or school administrator if you need assistance</li>
                  </ul>
                </div>

                <div className="text-center space-y-3 pt-2">
                  <Link 
                    href="/forgot-password" 
                    className="block"
                    data-testid="link-forgot-password"
                  >
                    <Button className="w-full" variant="default">
                      <Mail className="h-4 w-4 mr-2" />
                      Request New Reset Link
                    </Button>
                  </Link>
                  <Link 
                    href="/login" 
                    className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
                    data-testid="link-login"
                  >
                    <span>←</span>
                    <span>Back to Login</span>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
