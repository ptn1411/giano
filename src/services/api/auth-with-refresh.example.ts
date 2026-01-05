/**
 * Authentication API with Refresh Token Support
 * 
 * This is an example implementation showing how to integrate
 * the new refresh token mechanism into your frontend.
 * 
 * Features:
 * - Automatic token refresh on 401 errors
 * - Proactive token refresh before expiry
 * - Rate limit error handling
 * - Secure token storage
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

// ============================================
// Token Storage
// ============================================

export const TokenStorage = {
  getAccessToken(): string | null {
    return localStorage.getItem('token');
  },

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  },

  getTokenExpiry(): number {
    return parseInt(localStorage.getItem('tokenExpiry') || '0');
  },

  setTokens(session: SessionResponse): void {
    localStorage.setItem('token', session.token);
    localStorage.setItem('refreshToken', session.refreshToken);
    localStorage.setItem('tokenExpiry', session.expiresAt.toString());
    localStorage.setItem('refreshTokenExpiry', session.refreshExpiresAt.toString());
  },

  clearTokens(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tokenExpiry');
    localStorage.removeItem('refreshTokenExpiry');
  },

  isAccessTokenExpired(): boolean {
    const expiry = this.getTokenExpiry();
    return Date.now() >= expiry;
  },

  isAccessTokenExpiringSoon(minutesThreshold: number = 5): boolean {
    const expiry = this.getTokenExpiry();
    const threshold = minutesThreshold * 60 * 1000;
    return Date.now() >= (expiry - threshold);
  }
};

// ============================================
// Types
// ============================================

interface SessionResponse {
  token: string;
  expiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    status: string;
  };
}

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

interface RefreshRequest {
  refreshToken: string;
}

interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

// ============================================
// Axios Instance with Interceptors
// ============================================

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Add access token to requests
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Skip token for auth endpoints
    if (config.url?.includes('/auth/login') || 
        config.url?.includes('/auth/register') ||
        config.url?.includes('/auth/refresh')) {
      return config;
    }

    // Check if token is expiring soon and refresh proactively
    if (TokenStorage.isAccessTokenExpiringSoon(5)) {
      try {
        await refreshAccessToken();
      } catch (error) {
        console.error('Proactive token refresh failed:', error);
        // Continue with current token, will retry on 401
      }
    }

    // Add access token to request
    const token = TokenStorage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle 401 errors and refresh token
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle rate limit errors
    if (error.response?.status === 429) {
      const message = error.response.data?.error?.message || 'Too many requests';
      const retryAfter = message.match(/\d+/)?.[0] || '60';
      
      throw new Error(`Rate limit exceeded. Please try again in ${retryAfter} seconds.`);
    }

    // Handle 401 errors (token expired)
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newToken = await refreshAccessToken();
        processQueue(null, newToken);
        
        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        
        // Refresh failed, logout user
        TokenStorage.clearTokens();
        window.location.href = '/login';
        
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ============================================
// Auth API Functions
// ============================================

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(): Promise<string> {
  const refreshToken = TokenStorage.getRefreshToken();
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await axios.post<{ session: SessionResponse }>(
      `${API_URL}/auth/refresh`,
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const { session } = response.data;
    TokenStorage.setTokens(session);
    
    return session.token;
  } catch (error) {
    TokenStorage.clearTokens();
    throw error;
  }
}

/**
 * Login user
 */
export async function login(email: string, password: string): Promise<SessionResponse> {
  try {
    const response = await apiClient.post<{ session: SessionResponse }>(
      '/auth/login',
      { email, password }
    );

    const { session } = response.data;
    TokenStorage.setTokens(session);
    
    return session;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const apiError = error.response?.data as ApiError;
      throw new Error(apiError?.error?.message || 'Login failed');
    }
    throw error;
  }
}

/**
 * Register new user
 */
export async function register(
  email: string,
  password: string,
  name: string
): Promise<SessionResponse> {
  try {
    const response = await apiClient.post<{ session: SessionResponse }>(
      '/auth/register',
      { email, password, name }
    );

    const { session } = response.data;
    TokenStorage.setTokens(session);
    
    return session;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const apiError = error.response?.data as ApiError;
      throw new Error(apiError?.error?.message || 'Registration failed');
    }
    throw error;
  }
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    TokenStorage.clearTokens();
    window.location.href = '/login';
  }
}

/**
 * Get current session
 */
export async function getSession(): Promise<SessionResponse> {
  const response = await apiClient.get<{ session: SessionResponse }>('/auth/session');
  return response.data.session;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const token = TokenStorage.getAccessToken();
  const refreshToken = TokenStorage.getRefreshToken();
  
  // Has tokens and refresh token not expired
  return !!(token && refreshToken && !TokenStorage.isAccessTokenExpired());
}

// ============================================
// Export configured axios instance
// ============================================

export default apiClient;

// ============================================
// Usage Examples
// ============================================

/*

// 1. Login
try {
  const session = await login('user@example.com', 'password123');
  console.log('Logged in:', session.user.name);
  // Tokens are automatically stored
} catch (error) {
  if (error.message.includes('Rate limit')) {
    alert('Too many login attempts. Please wait.');
  } else {
    alert('Login failed: ' + error.message);
  }
}

// 2. Make authenticated requests
import apiClient from './auth-with-refresh';

// Token is automatically added and refreshed if needed
const chats = await apiClient.get('/chats');

// 3. Check authentication status
if (isAuthenticated()) {
  // User is logged in
} else {
  // Redirect to login
}

// 4. Logout
await logout();

// 5. Manual token refresh (usually not needed)
try {
  const newToken = await refreshAccessToken();
  console.log('Token refreshed');
} catch (error) {
  console.error('Refresh failed, user needs to login');
}

*/
