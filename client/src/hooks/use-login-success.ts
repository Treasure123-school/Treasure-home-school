import { useEffect, useRef } from 'react';
import { useToast } from './use-toast';
import { useAuth } from '@/lib/auth';
import { getRoleNameById } from '@/lib/roles';

export function useLoginSuccess() {
  const { toast } = useToast();
  const { user } = useAuth();
  const hasShownRef = useRef(false);

  useEffect(() => {
    if (hasShownRef.current) return;

    const checkForLoginSuccess = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const isLoginSuccess = urlParams.get('login_success') === 'true';
      const isPasswordChanged = urlParams.get('password_changed') === 'true';

      if (isLoginSuccess && user) {
        hasShownRef.current = true;
        const roleName = getRoleNameById(user.roleId);

        toast({
          title: "Login Successful",
          description: isPasswordChanged 
            ? `Password updated. Welcome to your ${roleName} dashboard.`
            : `Welcome back! You are now signed in to your ${roleName} dashboard.`,
          className: 'border-green-500 bg-green-50 dark:bg-green-950/50',
          duration: 4000,
        });

        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }
    };

    const timeoutId = setTimeout(checkForLoginSuccess, 100);
    return () => clearTimeout(timeoutId);
  }, [user, toast]);
}
