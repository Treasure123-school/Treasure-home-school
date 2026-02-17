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
    
    // Auto-logout on reload (since sessionStorage or similar would be better, but user specifically asked for reload logout)
    // We can use a session flag to detect reloads
    const isReload = sessionStorage.getItem('is-reload') === 'true';
    
    if (storedUser && !isReload) {
      try {
        const parsedUser = JSON.parse(storedUser);
        // 5 minute inactivity check
        if (lastActivity && (now - parseInt(lastActivity) > 5 * 60 * 1000)) {
          logout();
        } else {
          setUser(parsedUser);
          localStorage.setItem('last-activity', now.toString());
        }
      } catch {
        logout();
      }
    } else if (isReload) {
      logout();
      sessionStorage.removeItem('is-reload');
    }
    
    setIsLoading(false);

    // Set reload flag for next load
    const handleUnload = () => {
      sessionStorage.setItem('is-reload', 'true');
    };
    window.addEventListener('beforeunload', handleUnload);

    // Inactivity tracking
    const activityHandler = () => {
      localStorage.setItem('last-activity', Date.now().toString());
    };
    window.addEventListener('mousemove', activityHandler);
    window.addEventListener('keydown', activityHandler);
    window.addEventListener('click', activityHandler);
    window.addEventListener('scroll', activityHandler);

    // Auto-logout timer
    const interval = setInterval(() => {
      const last = localStorage.getItem('last-activity');
      if (last && (Date.now() - parseInt(last) > 5 * 60 * 1000)) {
        logout();
      }
    }, 60000); // Check every minute

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
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
    sessionStorage.removeItem('is-reload');
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth-user');
    localStorage.removeItem('token');
    localStorage.removeItem('last-activity');
    sessionStorage.removeItem('is-reload');
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
