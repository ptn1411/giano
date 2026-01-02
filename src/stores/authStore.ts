import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, AuthSession } from '@/services/authData';

interface AuthState {
  session: AuthSession | null;
  isLoading: boolean;
  isInitialized: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signup: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  updateSession: (session: AuthSession | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      isLoading: true,
      isInitialized: false,

      initialize: async () => {
        if (get().isInitialized) return;
        
        try {
          const existingSession = await authApi.getSession();
          set({ 
            session: existingSession, 
            isLoading: false, 
            isInitialized: true 
          });
        } catch {
          set({ 
            session: null, 
            isLoading: false, 
            isInitialized: true 
          });
        }
      },

      login: async (email: string, password: string) => {
        const { session: newSession, error } = await authApi.login(email, password);
        if (newSession) {
          set({ session: newSession });
        }
        return { error };
      },

      signup: async (email: string, password: string, name: string) => {
        const { session: newSession, error } = await authApi.signup(email, password, name);
        if (newSession) {
          set({ session: newSession });
        }
        return { error };
      },

      logout: async () => {
        await authApi.logout();
        set({ session: null });
      },

      updateSession: (session: AuthSession | null) => {
        set({ session });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ session: state.session }),
    }
  )
);
