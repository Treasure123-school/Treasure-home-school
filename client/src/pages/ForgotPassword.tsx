import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GraduationCap, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';

interface SettingsData {
  schoolName: string;
  schoolMotto: string;
}

const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const { toast } = useToast();
  const [emailSent, setEmailSent] = useState(false);

  const { data: settings } = useQuery<SettingsData>({
    queryKey: ["/api/superadmin/settings"],
  });

  const schoolName = settings?.schoolName || "";
  const schoolMotto = settings?.schoolMotto || "";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordForm) => {
      const response = await apiRequest('POST', '/api/auth/forgot-password', data);
      return await response.json();
    },
    onSuccess: (data) => {
      setEmailSent(true);

      if (data.developmentMode && (data.resetToken || data.resetLink)) {
        toast({
          title: "Reset Code Generated (Dev Mode)",
          description: (
            <div className="space-y-2">
              <p className="flex items-center gap-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                {data.message}
              </p>
              {data.resetToken && (
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-300">
                  <p className="text-xs font-semibold mb-1">🔑 Reset Code:</p>
                  <p className="text-sm font-mono font-bold text-blue-700 dark:text-blue-300">
                    {data.resetToken.substring(0, 8).toUpperCase()}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Expires in: {data.expiresIn}
                  </p>
                </div>
              )}
              <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded border border-yellow-200">
                <p className="text-xs font-semibold mb-1">🔗 Or use this link:</p>
                <a
                  href={data.resetLink}
                  className="text-xs text-blue-600 hover:underline break-all"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {data.resetLink}
                </a>
              </div>
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                In production, this will be sent to: {data.email}
              </p>
            </div>
          ),
          className: 'border-green-500 bg-green-50 dark:bg-green-950/50',
          duration: 15000,
        });
      } else {
        toast({
          title: "Reset Link Sent",
          description: '✅ If an account exists with that email/username, a password reset link will be sent.',
          className: 'border-green-500 bg-green-50 dark:bg-green-950/50',
        });
      }
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Failed to send reset link. Please try again.';
      toast({
        title: "Request Failed",
        description: (
          <div className="space-y-2">
            <p>{errorMessage}</p>
            <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
              <p className="text-xs font-medium">What to do next:</p>
              <ul className="text-xs space-y-1 mt-1">
                <li>• Double-check your username or email</li>
                <li>• Ensure you're using your registered account</li>
                <li>• Contact school administrator if you need help</li>
                <li>• Check your email spam folder for reset links</li>
              </ul>
            </div>
          </div>
        ),
        className: 'border-red-500 bg-red-50 dark:bg-red-950/50',
      });
    },
  });

  const onSubmit = (data: ForgotPasswordForm) => {
    forgotPasswordMutation.mutate(data);
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
            Forgot Password
          </h2>
          <p className="text-muted-foreground" data-testid="text-subtitle">
            Enter your username or email to receive a reset link
          </p>
        </div>

        <Card className="w-full border-2 border-blue-200 dark:border-blue-800">
          <CardHeader className="text-center">
            <div className="bg-blue-100 dark:bg-blue-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-2xl">Reset Your Password</CardTitle>
            <p className="text-muted-foreground mt-2">
              Enter your username or email address and we'll send you instructions to reset your password
            </p>
          </CardHeader>
          <CardContent>
            {!emailSent ? (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="identifier" className="text-sm font-medium">
                    Username or Email Address
                  </Label>
                  <Input
                    id="identifier"
                    type="text"
                    {...register('identifier')}
                    className="mt-2"
                    placeholder="e.g., THS-STU-2025-PR3-001 or your email"
                    data-testid="input-identifier"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    <strong>Students/Parents:</strong> Use your THS username (e.g., THS-STU-2025-PR3-001)<br/>
                    <strong>Teachers/Admins:</strong> Password reset is handled through Google. If locked out, contact Admin.
                  </p>
                  {errors.identifier && (
                    <p className="text-destructive text-sm mt-1 flex items-center gap-1" data-testid="error-identifier">
                      <AlertCircle className="h-3 w-3" />
                      {errors.identifier.message}
                    </p>
                  )}
                </div>

                <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-600 rounded-full">
                      <Mail className="h-3.5 w-3.5 text-white" />
                    </div>
                    <p className="text-sm text-blue-900 dark:text-blue-100 font-semibold flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      How Password Reset Works
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="mt-1 h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">1</span>
                      </div>
                      <p className="text-xs text-blue-800 dark:text-blue-200">Enter your THS username or email address</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="mt-1 h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">2</span>
                      </div>
                      <p className="text-xs text-blue-800 dark:text-blue-200">Receive a secure reset link via email (valid for 15 minutes)</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="mt-1 h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">3</span>
                      </div>
                      <p className="text-xs text-blue-800 dark:text-blue-200">Click the link to create a new strong password</p>
                    </div>
                  </div>
                  <div className="space-y-1 pt-2 border-t border-blue-200 dark:border-blue-700">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        Check spam/junk folder if you don't see the email within 2 minutes
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        <strong>For Teachers/Admins:</strong> Use Google account recovery if you can't access your Google email
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 text-base font-medium"
                  disabled={forgotPasswordMutation.isPending}
                  data-testid="button-submit"
                >
                  {forgotPasswordMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending Reset Link...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Send Reset Link
                    </span>
                  )}
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-3 sm:p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl border border-green-200/50 dark:border-green-800/50">
                  <div className="flex items-start gap-2">
                    <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-green-800 dark:text-green-200 mb-1 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                        Reset Email Sent Successfully
                      </p>
                      <p className="text-[10px] sm:text-xs text-green-700 dark:text-green-300">
                        Check your email inbox for the password reset link. The link expires in 15 minutes for your security.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-[10px] sm:text-xs text-blue-800 dark:text-blue-200">
                      <p className="font-medium mb-1.5">Didn't receive the email?</p>
                      <ul className="space-y-1 ml-3 list-disc">
                        <li>Wait a few minutes - delivery may take time</li>
                        <li>Check your spam/junk folder</li>
                        <li>Verify you entered the correct username/email</li>
                        <li>Contact the school administrator if issue persists</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="text-center pt-2">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-primary text-sm font-medium hover:underline"
                    data-testid="link-back-to-login"
                  >
                    <span>←</span>
                    <span>Back to Login</span>
                  </Link>
                </div>
              </div>
            )}

            {!emailSent && (
              <div className="text-center mt-6">
                <Link
                  href="/login"
                  className="text-primary text-sm hover:underline"
                  data-testid="link-back-to-login"
                >
                  ← Back to Login
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}