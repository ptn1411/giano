/**
 * Auth Store
 * Manages authentication state using Zustand with real API integration
 * Requirements: 2.1-2.6
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService, AuthSession, removeAuthToken } from '@/services/api';

// ============================================
// Types
// ============================================

interface AuthState {
  session: AuthSession | null;
  isLoading: boolean;
  isInitialized: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signup: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  refreshToken: () => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  updateSession: (session: AuthSession | null) => void;
}

// ============================================
// Auth Store
// ============================================

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      isLoading: true,
      isInitialized: false,

      /**
       * Initialize auth state on app load
       * Requirement 2.4: Call GET /auth/session to restore session if token exists
       */
      initialize: async () => {
        if (get().isInitialized) return;
        
        try {
          // Check if we have a stored token before making API call
          if (!authService.hasStoredToken()) {
            set({ 
              session: null, 
              isLoading: false, 
              isInitialized: true 
            });
            return;
          }

          // Attempt to restore session from server
          const session = await authService.getSession();
          set({ 
            session, 
            isLoading: false, 
            isInitialized: true 
          });
        } catch {
          // Clear any invalid state on error
          removeAuthToken();
          set({ 
            session: null, 
            isLoading: false, 
            isInitialized: true 
          });
        }
      },

      /**
       * Login with email and password
       * Requirement 2.2: Call POST /auth/login and store the session
       * Requirement 2.5: Persist JWT token in localStorage (handled by authService)
       * Requirement 2.6: Display error messages from API response
       */
      login: async (email: string, password: string) => {
        const { session, error } = await authService.login(email, password);
        
        if (session) {
          set({ session });
        }
        
        return { error };
      },

      /**
       * Register a new user
       * Requirement 2.1: Call POST /auth/register and store the session
       * Requirement 2.5: Persist JWT token in localStorage (handled by authService)
       * Requirement 2.6: Display error messages from API response
       */
      signup: async (email: string, password: string, name: string) => {
        const { session, error } = await authService.register(email, password, name);
        
        if (session) {
          set({ session });
        }
        
        return { error };
      },

      /**
       * Refresh access token using refresh token
       */
      refreshToken: async () => {
        const { session, error } = await authService.refreshToken();
        
        if (session) {
          set({ session });
        }
        
        return { error };
      },

      /**
       * Logout the current user
       * Requirement 2.3: Call POST /auth/logout and clear local session
       */
      logout: async () => {
        await authService.logout();
        set({ session: null });
      },

      /**
       * Update session state directly (used for WebSocket updates, etc.)
       */
      updateSession: (session: AuthSession | null) => {
        set({ session });
      },
    }),
    {
      name: 'auth-storage',
      // Only persist session data, not loading states
      partialize: (state) => ({ session: state.session }),
    }
  )
);

// ============================================
// Selectors (for convenience)
// ============================================

export const selectIsAuthenticated = (state: AuthState) => !!state.session;
export const selectCurrentUser = (state: AuthState) => state.session?.user ?? null;
export const selectAuthToken = (state: AuthState) => state.session?.token ?? null;
