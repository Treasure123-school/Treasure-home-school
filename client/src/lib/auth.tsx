import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored auth data on mount
    const storedUser = localStorage.getItem('auth-user');
    const lastActivity = localStorage.getItem('last-activity');
    const now = Date.now();
    const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        // 30 minute inactivity check
        if (lastActivity && (now - parseInt(lastActivity) > TIMEOUT_MS)) {
          logout();
        } else {
          setUser(parsedUser);
          localStorage.setItem('last-activity', now.toString());
        }
      } catch {
        logout();
      }
    }
    
    setIsLoading(false);

    // Inactivity tracking (Throttled to max once every 5 seconds)
    let lastUpdate = Date.now();
    const activityHandler = () => {
      const currentTime = Date.now();
      if (currentTime - lastUpdate > 5000) {
        localStorage.setItem('last-activity', currentTime.toString());
        lastUpdate = currentTime;
      }
    };
    
    window.addEventListener('mousemove', activityHandler, { passive: true });
    window.addEventListener('keydown', activityHandler, { passive: true });
    window.addEventListener('click', activityHandler, { passive: true });
    window.addEventListener('scroll', activityHandler, { passive: true });

    // Auto-logout timer
    const interval = setInterval(() => {
      const last = localStorage.getItem('last-activity');
      if (last && (Date.now() - parseInt(last) > TIMEOUT_MS)) {
        logout();
      }
    }, 60000); // Check every minute

    return () => {
      window.removeEventListener('mousemove', activityHandler);
      window.removeEventListener('keydown', activityHandler);
      window.removeEventListener('click', activityHandler);
      window.removeEventListener('scroll', activityHandler);
      clearInterval(interval);
    };
  }, []);

  const login = (userData: AuthUser, token: string) => {
    setUser(userData);
    localStorage.setItem('auth-user', JSON.stringify(userData));
    localStorage.setItem('token', token);
    localStorage.setItem('last-activity', Date.now().toString());
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth-user');
    localStorage.removeItem('token');
    localStorage.removeItem('last-activity');
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
    <AuthContext.Provider value={{ user, login, logout, updateUser, isAuthenticated, isLoading }}>
      {children}
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
