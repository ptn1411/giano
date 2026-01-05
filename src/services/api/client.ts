/**
 * API Client with Axios
 * Centralized HTTP client with authentication and error handling
 * Requirements: 1.1, 1.2, 1.4, 1.5
 */

import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import { ApiErrorResponse, ParsedError, ErrorType } from './types';
import { isDemoMode, getApiUrl, getApiTimeout } from '@/lib/config';

// ============================================
// Constants
// ============================================

const AUTH_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const TOKEN_EXPIRY_KEY = 'token_expiry';
const REFRESH_EXPIRY_KEY = 'refresh_expiry';

// ============================================
// Demo Mode Flag
// ============================================

/**
 * Check if the application is running in demo mode
 * Demo mode uses mock data instead of real API calls
 */
export const isInDemoMode = isDemoMode;

// ============================================
// Token Refresh State
// ============================================

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

// ============================================
// API Client Configuration
// ============================================

/**
 * Create and configure the Axios instance
 * Uses environment variables for base URL configuration (Requirement 1.4)
 */
const createApiClient = (): AxiosInstance => {
  const baseURL = getApiUrl();
  const timeout = getApiTimeout();

  const client = axios.create({
    baseURL,
    timeout,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor - add JWT token and handle proactive refresh (Requirement 1.1)
  client.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      // Skip token for auth endpoints
      if (config.url?.includes('/auth/login') || 
          config.url?.includes('/auth/register') ||
          config.url?.includes('/auth/refresh')) {
        return config;
      }

      // Check if token is expiring soon (within 5 minutes) and refresh proactively
      const expiry = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0');
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      if (expiry && (expiry - now < fiveMinutes) && !isRefreshing) {
        try {
          await refreshAccessToken();
        } catch (error) {
          console.error('[API] Proactive token refresh failed:', error);
          // Continue with current token, will retry on 401
        }
      }

      // Add access token to request
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      console.error('[API Request Error]', error);
      return Promise.reject(error);
    }
  );

  // Response interceptor - handle errors and token refresh (Requirement 1.2, 1.5)
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      return response;
    },
    async (error: AxiosError<ApiErrorResponse>) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      // Handle 429 Rate Limit
      if (error.response?.status === 429) {
        const message = error.response.data?.error?.message || 'Too many requests';
        const retryAfter = message.match(/\d+/)?.[0] || '60';
        
        console.error(`[API] Rate limit exceeded. Retry after ${retryAfter} seconds`);
        return Promise.reject(error);
      }

      // Handle 401 Unauthorized - try to refresh token (Requirement 1.2)
      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          // If already refreshing, queue this request
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then(token => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              return client(originalRequest);
            })
            .catch(err => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const newToken = await refreshAccessToken();
          processQueue(null, newToken);
          
          // Retry original request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return client(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError as Error, null);
          
          // Refresh failed, clear tokens and redirect to login
          clearAllTokens();
          if (!window.location.pathname.includes('/auth')) {
            window.location.href = '/auth';
          }
          
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      // Log error for debugging (Requirement 1.5)
      console.error('[API Response Error]', {
        status: error.response?.status,
        url: error.config?.url,
        message: error.message,
        data: error.response?.data,
      });

      return Promise.reject(error);
    }
  );

  return client;
};

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    // Use axios directly to avoid interceptor loop
    const response = await axios.post<{ session: { token: string; expiresAt: number; refreshToken: string; refreshExpiresAt: number } }>(
      `${getApiUrl()}/auth/refresh`,
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const { session } = response.data;
    
    // Update stored tokens
    localStorage.setItem(AUTH_TOKEN_KEY, session.token);
    localStorage.setItem(TOKEN_EXPIRY_KEY, session.expiresAt.toString());
    // Refresh token stays the same
    
    console.log('[API] Token refreshed successfully');
    return session.token;
  } catch (error) {
    console.error('[API] Token refresh failed:', error);
    clearAllTokens();
    throw error;
  }
}

// ============================================
// Error Handling Utilities
// ============================================

/**
 * Parse API errors into user-friendly format
 * Handles network errors and displays appropriate messages (Requirement 1.3)
 */
export const parseApiError = (error: unknown): ParsedError => {
  // Handle Axios errors
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    const apiError = axiosError.response?.data?.error;
    const status = axiosError.response?.status;

    // Network error (no response)
    if (!axiosError.response) {
      return {
        type: 'network',
        message: 'Network error. Please check your connection.',
      };
    }

    // Map HTTP status to error type
    let errorType: ErrorType;
    let defaultMessage: string;

    switch (status) {
      case 400:
        errorType = 'validation';
        defaultMessage = 'Invalid request. Please check your input.';
        break;
      case 401:
        errorType = 'auth';
        defaultMessage = 'Session expired. Please log in again.';
        break;
      case 403:
        errorType = 'forbidden';
        defaultMessage = 'Access denied. You do not have permission.';
        break;
      case 404:
        errorType = 'not_found';
        defaultMessage = 'Resource not found.';
        break;
      case 429:
        errorType = 'rate_limit';
        defaultMessage = 'Too many requests. Please try again later.';
        break;
      default:
        errorType = 'server';
        defaultMessage = 'Server error. Please try again later.';
    }

    return {
      type: errorType,
      message: apiError?.message || defaultMessage,
      code: apiError?.code,
      details: apiError?.details,
    };
  }

  // Handle non-Axios errors
  if (error instanceof Error) {
    return {
      type: 'server',
      message: error.message,
    };
  }

  // Unknown error
  return {
    type: 'server',
    message: 'An unexpected error occurred.',
  };
};

/**
 * Check if error is a specific type
 */
export const isErrorType = (error: ParsedError, type: ErrorType): boolean => {
  return error.type === type;
};

// ============================================
// Token Management
// ============================================

/**
 * Store authentication tokens in localStorage
 */
export const setAuthToken = (token: string, expiresAt: number, refreshToken: string, refreshExpiresAt: number): void => {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt.toString());
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(REFRESH_EXPIRY_KEY, refreshExpiresAt.toString());
};

/**
 * Get JWT token from localStorage
 */
export const getAuthToken = (): string | null => {
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

/**
 * Get refresh token from localStorage
 */
export const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

/**
 * Remove all authentication tokens from localStorage
 */
export const removeAuthToken = (): void => {
  clearAllTokens();
};

/**
 * Clear all tokens from localStorage
 */
function clearAllTokens(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(REFRESH_EXPIRY_KEY);
}

/**
 * Check if user has a stored token
 */
export const hasAuthToken = (): boolean => {
  return !!localStorage.getItem(AUTH_TOKEN_KEY);
};

/**
 * Check if access token is expired
 */
export const isAccessTokenExpired = (): boolean => {
  const expiry = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0');
  return Date.now() >= expiry;
};

/**
 * Check if access token is expiring soon (within specified minutes)
 */
export const isAccessTokenExpiringSoon = (minutesThreshold: number = 5): boolean => {
  const expiry = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0');
  const threshold = minutesThreshold * 60 * 1000;
  return Date.now() >= (expiry - threshold);
};

// ============================================
// Export API Client Instance
// ============================================

export const apiClient = createApiClient();

export default apiClient;
