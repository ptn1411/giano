import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authApi, AuthSession } from '@/services/authData';

interface AuthContextType {
  session: AuthSession | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signup: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    authApi.getSession().then((existingSession) => {
      setSession(existingSession);
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { session: newSession, error } = await authApi.login(email, password);
    if (newSession) {
      setSession(newSession);
    }
    return { error };
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    const { session: newSession, error } = await authApi.signup(email, password, name);
    if (newSession) {
      setSession(newSession);
    }
    return { error };
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, isLoading, login, signup, logout }}>
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
