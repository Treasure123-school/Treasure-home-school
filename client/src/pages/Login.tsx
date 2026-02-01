import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, Eye, EyeOff, Lock, User, KeyRound, ArrowLeft, Shield, CheckCircle2 } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { Link, useLocation } from 'wouter';
import { getRoleNameById, getPortalByRoleId } from '@/lib/roles';
import schoolLogo from '@assets/school-logo.png';

interface SettingsData {
  schoolName: string;
  schoolMotto: string;
  schoolLogo?: string;
}

const loginSchema = z.object({
  identifier: z.string()
    .min(1, 'Username or email is required')
    .regex(/^[a-zA-Z0-9@._-]+$/, 'Invalid characters in username'),
  password: z.string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type LoginForm = z.infer<typeof loginSchema>;
type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

const RATE_LIMIT_ATTEMPTS = 5;
const RATE_LIMIT_DURATION = 10 * 60 * 1000;

interface RateLimitData {
  attempts: number;
  lockedUntil: number | null;
}

function getRateLimitData(): RateLimitData {
  try {
    const data = localStorage.getItem('login_rate_limit');
    if (data) {
      return JSON.parse(data);
    }
  } catch {}
  return { attempts: 0, lockedUntil: null };
}

function setRateLimitData(data: RateLimitData): void {
  localStorage.setItem('login_rate_limit', JSON.stringify(data));
}

function clearRateLimitData(): void {
  localStorage.removeItem('login_rate_limit');
}

export default function Login() {
  const { toast } = useToast();
  const { login } = useAuth();
  const [, navigate] = useLocation();

  const { data: settings } = useQuery<SettingsData>({
    queryKey: ["/api/public/settings"],
    refetchInterval: 5000,
  });

  const schoolName = settings?.schoolName || "Treasure-Home School";
  const schoolMotto = settings?.schoolMotto || "Honesty and Success";
  const displayLogo = settings?.schoolLogo || "";

  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [tempUserData, setTempUserData] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isCardVisible, setIsCardVisible] = useState(false);
  const [authPhase, setAuthPhase] = useState<'idle' | 'authenticating' | 'success'>('idle');
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitData>(getRateLimitData());
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);
  const [rememberMe, setRememberMe] = useState(false);
  const lastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsCardVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (rateLimitInfo.lockedUntil && rateLimitInfo.lockedUntil > Date.now()) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, rateLimitInfo.lockedUntil! - Date.now());
        setLockoutRemaining(remaining);
        if (remaining === 0) {
          clearRateLimitData();
          setRateLimitInfo({ attempts: 0, lockedUntil: null });
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [rateLimitInfo.lockedUntil]);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    control,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  const watchedFields = useWatch({ control });
  const isFormFilled = Boolean(watchedFields.identifier && watchedFields.password);

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors },
    reset: resetPasswordForm,
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const showSingleError = (message: string) => {
    if (lastErrorRef.current === message) return;
    lastErrorRef.current = message;
    setLoginError(message);
    setTimeout(() => {
      lastErrorRef.current = null;
    }, 5000);
  };

  const clearError = () => {
    setLoginError(null);
    lastErrorRef.current = null;
  };

  const isLockedOut = Boolean(rateLimitInfo.lockedUntil && rateLimitInfo.lockedUntil > Date.now());

  const formatLockoutTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleFailedAttempt = () => {
    const currentData = getRateLimitData();
    const newAttempts = currentData.attempts + 1;
    
    if (newAttempts >= RATE_LIMIT_ATTEMPTS) {
      const lockData: RateLimitData = {
        attempts: newAttempts,
        lockedUntil: Date.now() + RATE_LIMIT_DURATION,
      };
      setRateLimitData(lockData);
      setRateLimitInfo(lockData);
      setLockoutRemaining(RATE_LIMIT_DURATION);
    } else {
      const newData: RateLimitData = { attempts: newAttempts, lockedUntil: null };
      setRateLimitData(newData);
      setRateLimitInfo(newData);
    }
  };

  const normalizeErrorMessage = (message: string | undefined, statusType?: string): string => {
    if (statusType === 'pending_staff' || statusType === 'pending_setup') {
      return 'Your account is pending approval. Please contact the school administrator.';
    }
    if (statusType === 'suspended_staff' || statusType === 'suspended_parent' || statusType === 'suspended_student') {
      return 'Your account has been suspended. Please contact the school administrator.';
    }
    if (statusType === 'invalid_credentials' || !message || 
        message.toLowerCase().includes('invalid') || 
        message.toLowerCase().includes('incorrect') ||
        message.toLowerCase().includes('password') ||
        message.toLowerCase().includes('user')) {
      return 'Incorrect username or password.';
    }
    return 'An error occurred. Please try again.';
  };

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      if (isLockedOut) {
        throw new Error(`Too many failed attempts. Please wait ${formatLockoutTime(lockoutRemaining)}.`);
      }

      clearError();
      setAuthPhase('authenticating');
      
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const response = await apiRequest('POST', '/api/auth/login', data);
      const result = await response.json();

      if (!response.ok) {
        handleFailedAttempt();
        const normalizedMessage = normalizeErrorMessage(result.message, result.statusType);
        throw new Error(normalizedMessage);
      }
      
      clearRateLimitData();
      setRateLimitInfo({ attempts: 0, lockedUntil: null });
      return result;
    },
    onSuccess: (data) => {
      clearError();
      setAuthPhase('success');
      
      if (data.mustChangePassword || data.user.mustChangePassword) {
        setAuthPhase('idle');
        setTempUserData(data);
        setShowPasswordChange(true);
        return;
      }

      login(data.user, data.token);
      const targetPath = getPortalByRoleId(data.user.roleId);
      
      setTimeout(() => {
        navigate(`${targetPath}?login_success=true`);
      }, 600);
    },
    onError: (error: any) => {
      setAuthPhase('idle');
      showSingleError(error.message || 'Incorrect username or password.');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordForm) => {
      const previousToken = localStorage.getItem('token');
      localStorage.setItem('token', tempUserData.token);

      try {
        const response = await apiRequest('POST', '/api/auth/change-password', {
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        });
        const result = await response.json();
        
        if (!response.ok) {
          if (previousToken) {
            localStorage.setItem('token', previousToken);
          } else {
            localStorage.removeItem('token');
          }
          throw new Error(result.message || 'Failed to change password');
        }
        
        return result;
      } catch (error: any) {
        if (previousToken) {
          localStorage.setItem('token', previousToken);
        } else {
          localStorage.removeItem('token');
        }
        throw error;
      }
    },
    onSuccess: () => {
      login(tempUserData.user, tempUserData.token);
      const targetPath = getPortalByRoleId(tempUserData.user.roleId);

      setShowPasswordChange(false);
      setTempUserData(null);
      resetPasswordForm();

      navigate(`${targetPath}?login_success=true&password_changed=true`);
    },
    onError: (error: any) => {
      toast({
        title: 'Password Change Failed',
        description: error.message || 'Failed to change password. Please try again.',
        variant: 'destructive',
        duration: 5000,
      });
    },
  });

  const onSubmit = (data: LoginForm) => {
    if (isLockedOut) return;
    clearError();
    loginMutation.mutate(data);
  };

  const onPasswordChange = (data: ChangePasswordForm) => {
    changePasswordMutation.mutate(data);
  };

  const isButtonDisabled = !isFormFilled || !isValid || loginMutation.isPending || isLockedOut;

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 flex flex-col relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-100/30 dark:bg-blue-900/10 rounded-full blur-[100px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-blue-100/30 dark:bg-blue-900/10 rounded-full blur-[100px]" />
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        <div className="w-full max-w-md">
          <Card 
            className={`shadow-[0_20px_50px_rgba(8,_112,_184,_0.1)] border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 overflow-hidden transition-all duration-700 ease-out ${
              isCardVisible 
                ? 'opacity-100 translate-y-0 scale-100' 
                : 'opacity-0 translate-y-8 scale-95'
            }`}
            data-testid="card-login"
          >
            <div className="bg-transparent px-6 py-6 text-center flex flex-col items-center justify-center">
              <Link href="/" className="inline-block mb-4 transition-transform hover:scale-105" data-testid="link-home">
                <img
                  src={displayLogo}
                  alt="Treasure-Home School Logo"
                  className="h-20 w-auto max-w-[180px] object-contain drop-shadow-md"
                  data-testid="img-school-logo"
                />
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-school-name">
                {schoolName}
              </h1>
              <p className="text-blue-600 dark:text-blue-400 text-[10px] mt-1.5 font-bold tracking-widest uppercase">{schoolMotto}</p>
            </div>

            <CardContent className="p-6 pt-2">
              {authPhase === 'authenticating' && (
                <div className="text-center py-8 animate-in fade-in duration-300">
                  <div className="relative mx-auto w-16 h-16 mb-4">
                    <div className="absolute inset-0 rounded-full border-4 border-blue-100"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
                    <Shield className="absolute inset-0 m-auto h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">Authenticating</h3>
                  <p className="text-sm text-muted-foreground">Please wait while we verify your credentials...</p>
                </div>
              )}

              {authPhase === 'success' && (
                <div className="text-center py-8 animate-in fade-in zoom-in duration-300">
                  <div className="mx-auto w-16 h-16 mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">Authentication Successful</h3>
                  <p className="text-sm text-muted-foreground">Redirecting to your dashboard...</p>
                </div>
              )}

              {authPhase === 'idle' && (
                <>
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold tracking-tight text-foreground" data-testid="text-login-title">
                      Portal Login
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1" data-testid="text-login-subtitle">
                      Sign in to access your dashboard
                    </p>
                  </div>

                  {isLockedOut && (
                    <div 
                      className="mb-6 p-4 rounded-lg border bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                      data-testid="error-rate-limit"
                    >
                      <div className="flex items-start gap-3">
                        <Lock className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-800 dark:text-red-200">
                            Account Temporarily Locked
                          </p>
                          <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                            Too many failed login attempts. Please try again in{' '}
                            <span className="font-mono font-semibold">{formatLockoutTime(lockoutRemaining)}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {loginError && !isLockedOut && (
                    <div 
                      className="mb-6 p-4 rounded-lg border bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 animate-in fade-in slide-in-from-top-2 duration-300"
                      data-testid="error-login-message"
                    >
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-800 dark:text-red-200">
                            Login Failed
                          </p>
                          <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                            {loginError}
                          </p>
                          {rateLimitInfo.attempts > 0 && rateLimitInfo.attempts < RATE_LIMIT_ATTEMPTS && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                              {RATE_LIMIT_ATTEMPTS - rateLimitInfo.attempts} attempts remaining before lockout
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <form 
                    onSubmit={handleSubmit(onSubmit)} 
                    className="space-y-5"
                    autoComplete={rememberMe ? "on" : "off"}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="identifier" className="text-sm font-medium flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        Username or Email
                      </Label>
                      <Input
                        id="identifier"
                        type="text"
                        {...register('identifier')}
                        className={`h-12 text-base transition-all duration-200 ${
                          errors.identifier 
                            ? 'border-red-500 focus-visible:ring-red-500' 
                            : watchedFields.identifier && !errors.identifier
                            ? 'border-green-500 focus-visible:ring-green-500'
                            : ''
                        }`}
                        placeholder="Enter your username or email"
                        autoComplete={rememberMe ? "username" : "off"}
                        disabled={isLockedOut}
                        data-testid="input-identifier"
                        onChange={(e) => {
                          register('identifier').onChange(e);
                          if (loginError) clearError();
                        }}
                      />
                      {errors.identifier && (
                        <p className="text-destructive text-sm flex items-center gap-1 animate-in fade-in duration-200" data-testid="error-identifier">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {errors.identifier.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm font-medium flex items-center gap-2">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                        Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          {...register('password')}
                          className={`h-12 text-base pr-12 transition-all duration-200 ${
                            errors.password 
                              ? 'border-red-500 focus-visible:ring-red-500' 
                              : watchedFields.password && watchedFields.password.length >= 6
                              ? 'border-green-500 focus-visible:ring-green-500'
                              : ''
                          }`}
                          placeholder="Enter your password"
                          autoComplete={rememberMe ? "current-password" : "off"}
                          disabled={isLockedOut}
                          data-testid="input-password"
                          onChange={(e) => {
                            register('password').onChange(e);
                            if (loginError) clearError();
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          data-testid="button-toggle-password"
                          disabled={isLockedOut}
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-destructive text-sm flex items-center gap-1 animate-in fade-in duration-200" data-testid="error-password">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {errors.password.message}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="remember-me"
                          checked={rememberMe}
                          onCheckedChange={(checked) => setRememberMe(checked === true)}
                          disabled={isLockedOut}
                          data-testid="checkbox-remember-me"
                        />
                        <Label
                          htmlFor="remember-me"
                          className="text-sm font-medium text-muted-foreground cursor-pointer select-none"
                        >
                          Remember me
                        </Label>
                      </div>
                      <Link
                        href="/forgot-password"
                        className="text-sm text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1.5 transition-colors"
                        data-testid="link-forgot-password"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        Forgot Password?
                      </Link>
                    </div>

                    <Button
                      type="submit"
                      className={`w-full h-12 text-base font-semibold transition-all duration-300 shadow-sm ${
                        isButtonDisabled 
                          ? 'bg-blue-400 cursor-not-allowed' 
                          : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md active:scale-[0.98]'
                      }`}
                      disabled={isButtonDisabled}
                      data-testid="button-login"
                    >
                      Sign In
                    </Button>
                  </form>

                  <div className="mt-6 pt-6 border-t text-center">
                    <p className="text-sm text-muted-foreground">
                      Use your THS credentials to access your portal
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      <Dialog open={showPasswordChange} onOpenChange={setShowPasswordChange}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-password-change">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Lock className="h-5 w-5 text-orange-500" />
              Change Your Password
            </DialogTitle>
            <DialogDescription>
              For security, you must change your password before accessing your account.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePasswordSubmit(onPasswordChange)} className="space-y-5 mt-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="text-sm font-medium">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  {...registerPassword('currentPassword')}
                  className="h-11 pr-10"
                  placeholder="Enter current password"
                  data-testid="input-current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-toggle-current-password"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordErrors.currentPassword && (
                <p className="text-destructive text-sm">{passwordErrors.currentPassword.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-sm font-medium">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  {...registerPassword('newPassword')}
                  className="h-11 pr-10"
                  placeholder="Enter new password (min. 6 characters)"
                  data-testid="input-new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-toggle-new-password"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordErrors.newPassword && (
                <p className="text-destructive text-sm">{passwordErrors.newPassword.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  {...registerPassword('confirmPassword')}
                  className="h-11 pr-10"
                  placeholder="Confirm your new password"
                  data-testid="input-confirm-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-toggle-confirm-password"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordErrors.confirmPassword && (
                <p className="text-destructive text-sm">{passwordErrors.confirmPassword.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-11 font-semibold"
              disabled={changePasswordMutation.isPending}
              data-testid="button-change-password"
            >
              {changePasswordMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Updating Password...
                </span>
              ) : 'Update Password'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
