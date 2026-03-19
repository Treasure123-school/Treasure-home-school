import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { useLocation } from 'wouter';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { apiRequest } from './queryClient';
import { useToast } from '@/hooks/use-toast';

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: number;
  username?: string;
  role?: string;
  profileImageUrl?: string;
  profileCompleted?: boolean;
  profileCompletionPercentage?: number;
  profileSkipped?: boolean;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: string;
  recoveryEmail?: string;
}
interface AuthContextType {
  user: AuthUser | null;
  login: (userData: AuthUser, token: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSessionExpiring: boolean;
  stayLoggedIn: () => void;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Constants for session management
const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity before logout
const WARNING_MS = 1 * 60 * 1000;  // Show warning 1 minute before logout
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart', 'mousedown', 'wheel'] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionExpiring, setIsSessionExpiring] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Use refs to avoid stale closures in event handlers and intervals
  const sessionExpiringRef = useRef(false);
  const logoutRef = useRef<(msg?: string) => void>(() => {});

  // Keep the ref in sync with state
  useEffect(() => {
    sessionExpiringRef.current = isSessionExpiring;
  }, [isSessionExpiring]);

  const logout = useCallback(async (forcedMsg?: string) => {
    try {
      await apiRequest('POST', '/api/auth/logout', {}).catch(() => {});
    } catch {}

    setUser(null);
    localStorage.removeItem('auth-user');
    localStorage.removeItem('token');
    localStorage.removeItem('last-activity');
    setIsSessionExpiring(false);

    if (forcedMsg) {
      toast({
        title: "Session Expired",
        description: forcedMsg,
        variant: "destructive",
      });
      setLocation('/login');
    }
  }, [setLocation, toast]);

  // Keep logoutRef in sync so the interval always calls the latest version
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  const stayLoggedIn = useCallback(() => {
    localStorage.setItem('last-activity', Date.now().toString());
    setIsSessionExpiring(false);
  }, []);

  // ── Mount-time: check stored session & attach listeners ──
  useEffect(() => {
    const storedUser = localStorage.getItem('auth-user');
    const lastActivity = localStorage.getItem('last-activity');
    const now = Date.now();

    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (lastActivity && (now - parseInt(lastActivity) > TIMEOUT_MS)) {
          logoutRef.current("You have been signed out due to inactivity.");
        } else {
          setUser(parsedUser);
          localStorage.setItem('last-activity', now.toString());
        }
      } catch {
        logoutRef.current();
      }
    }

    setIsLoading(false);

    // Only attach activity listeners if user is signed in
    if (!storedUser) return;

    // ── Activity tracking ──
    // Every user interaction (mouse, keyboard, scroll, touch) resets the idle clock.
    // Throttled to once every 3 seconds to avoid excessive localStorage writes.
    let lastUpdate = 0;
    const activityHandler = () => {
      // While the warning modal is visible, don't silently dismiss it —
      // the user must explicitly click "Stay Logged In"
      if (sessionExpiringRef.current) return;

      const now = Date.now();
      if (now - lastUpdate > 3000) {
        localStorage.setItem('last-activity', now.toString());
        lastUpdate = now;
      }
    };

    // Attach on the capture phase so we never miss events even if
    // a child component calls stopPropagation()
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, activityHandler, { passive: true, capture: true });
    }

    // ── Idle check interval (every 5 s) ──
    const interval = setInterval(() => {
      const lastStr = localStorage.getItem('last-activity');
      if (!lastStr) return;

      const idleMs = Date.now() - parseInt(lastStr, 10);

      if (idleMs > TIMEOUT_MS) {
        logoutRef.current("You have been securely logged out due to inactivity.");
      } else if (idleMs > TIMEOUT_MS - WARNING_MS) {
        setIsSessionExpiring(true);
      } else {
        setIsSessionExpiring(false);
      }
    }, 5000);

    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, activityHandler, { capture: true } as EventListenerOptions);
      }
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run ONCE on mount — refs handle changing values

  const login = (userData: AuthUser, token: string) => {
    setUser(userData);
    localStorage.setItem('auth-user', JSON.stringify(userData));
    localStorage.setItem('token', token);
    localStorage.setItem('last-activity', Date.now().toString());
  };

  const manualLogout = () => {
    logout();
  };

  const updateUser = (updates: Partial<AuthUser>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem('auth-user', JSON.stringify(updatedUser));
    }
  };

  const isAuthenticated = user !== null;

  return (
    <AuthContext.Provider value={{ user, login, logout: manualLogout, updateUser, isAuthenticated, isLoading, isSessionExpiring, stayLoggedIn }}>
      {children}

      {/* Session Expiry Warning Modal */}
      <AlertDialog open={isSessionExpiring} onOpenChange={(open) => {
        if (!open) stayLoggedIn();
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Session Expiring</AlertDialogTitle>
            <AlertDialogDescription>
              You've been inactive for a while. Your session will expire in about 1 minute.
              Click the button below to stay logged in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={(e) => {
              e.preventDefault();
              stayLoggedIn();
            }}>
              Stay Logged In
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
