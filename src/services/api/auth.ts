/**
 * Auth API Service
 * Handles authentication-related API calls
 * Requirements: 2.1-2.6
 */

import { apiClient, setAuthToken, removeAuthToken, getAuthToken, parseApiError } from './client';
import {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  AuthSession,
} from './types';

// ============================================
// Auth Service Interface
// ============================================

export interface AuthResult {
  session: AuthSession | null;
  error: string | null;
}

// ============================================
// Auth API Service
// ============================================

export const authService = {
  /**
   * Login with email and password
   * Requirement 2.2: Call POST /auth/login and store the session
   */
  async login(email: string, password: string): Promise<AuthResult> {
    try {
      const request: LoginRequest = { email, password };
      const response = await apiClient.post<AuthResponse>('/auth/login', request);
      
      const { session } = response.data;
      
      // Requirement 2.5: Persist JWT token in localStorage
      setAuthToken(session.token);
      
      return { session, error: null };
    } catch (error) {
      // Requirement 2.6: Display error messages from API response
      const parsedError = parseApiError(error);
      return { session: null, error: parsedError.message };
    }
  },

  /**
   * Register a new user
   * Requirement 2.1: Call POST /auth/register and store the session
   */
  async register(email: string, password: string, name: string): Promise<AuthResult> {
    try {
      const request: RegisterRequest = { email, password, name };
      const response = await apiClient.post<AuthResponse>('/auth/register', request);
      
      const { session } = response.data;
      
      // Requirement 2.5: Persist JWT token in localStorage
      setAuthToken(session.token);
      
      return { session, error: null };
    } catch (error) {
      // Requirement 2.6: Display error messages from API response
      const parsedError = parseApiError(error);
      return { session: null, error: parsedError.message };
    }
  },

  /**
   * Logout the current user
   * Requirement 2.3: Call POST /auth/logout and clear local session
   */
  async logout(): Promise<void> {
    try {
      // Only call API if we have a token
      if (getAuthToken()) {
        await apiClient.post('/auth/logout');
      }
    } catch (error) {
      // Log error but don't throw - we still want to clear local state
      console.error('[Auth] Logout API error:', error);
    } finally {
      // Always clear local token
      removeAuthToken();
    }
  },

  /**
   * Get current session from server
   * Requirement 2.4: Call GET /auth/session to restore session if token exists
   */
  async getSession(): Promise<AuthSession | null> {
    try {
      // Only attempt if we have a stored token
      if (!getAuthToken()) {
        return null;
      }
      
      const response = await apiClient.get<AuthResponse>('/auth/session');
      const { session } = response.data;
      
      // Update token if server returns a new one
      if (session.token) {
        setAuthToken(session.token);
      }
      
      return session;
    } catch (error) {
      // If session fetch fails, clear the invalid token
      const parsedError = parseApiError(error);
      if (parsedError.type === 'auth') {
        removeAuthToken();
      }
      return null;
    }
  },

  /**
   * Check if user has a valid stored token
   */
  hasStoredToken(): boolean {
    return !!getAuthToken();
  },
};

export default authService;
