import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { apiRequest } from './queryClient';

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

  const logout = useCallback(async () => {
    try {
      await apiRequest('POST', '/api/auth/logout', {}).catch(() => {});
    } catch {}

    setUser(null);
    localStorage.removeItem('auth-user');
    localStorage.removeItem('token');
    localStorage.removeItem('last-activity');
  }, []);

  // Mount-time: restore session from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('auth-user');

    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        localStorage.setItem('last-activity', Date.now().toString());
      } catch {
        localStorage.removeItem('auth-user');
        localStorage.removeItem('token');
        localStorage.removeItem('last-activity');
      }
    }

    setIsLoading(false);
  }, []);

  const login = (userData: AuthUser, token: string) => {
    setUser(userData);
    localStorage.setItem('auth-user', JSON.stringify(userData));
    localStorage.setItem('token', token);
    localStorage.setItem('last-activity', Date.now().toString());
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
