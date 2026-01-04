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

// ============================================
// Demo Mode Flag
// ============================================

/**
 * Check if the application is running in demo mode
 * Demo mode uses mock data instead of real API calls
 */
export const isInDemoMode = isDemoMode;

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

  // Request interceptor - add JWT token (Requirement 1.1)
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
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

  // Response interceptor - handle errors (Requirement 1.2, 1.5)
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      return response;
    },
    (error: AxiosError<ApiErrorResponse>) => {
      // Handle 401 Unauthorized - redirect to login (Requirement 1.2)
      if (error.response?.status === 401) {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        // Only redirect if not already on auth page
        if (!window.location.pathname.includes('/auth')) {
          window.location.href = '/auth';
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
 * Store JWT token in localStorage
 */
export const setAuthToken = (token: string): void => {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
};

/**
 * Get JWT token from localStorage
 */
export const getAuthToken = (): string | null => {
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

/**
 * Remove JWT token from localStorage
 */
export const removeAuthToken = (): void => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

/**
 * Check if user has a stored token
 */
export const hasAuthToken = (): boolean => {
  return !!localStorage.getItem(AUTH_TOKEN_KEY);
};

// ============================================
// Export API Client Instance
// ============================================

export const apiClient = createApiClient();

export default apiClient;
