/**
 * Error Handling Utilities
 * Provides centralized error parsing and user-friendly messages
 * Requirements: 9.2
 */

import axios, { AxiosError } from 'axios';
import { ApiErrorResponse, ErrorType, ParsedError } from './types';

// ============================================
// Error Messages Map
// ============================================

/**
 * User-friendly error messages for different error types
 */
const ERROR_MESSAGES: Record<ErrorType, string> = {
  validation: 'Invalid request. Please check your input.',
  auth: 'Session expired. Please log in again.',
  forbidden: 'Access denied. You do not have permission.',
  not_found: 'The requested resource was not found.',
  rate_limit: 'Too many requests. Please try again later.',
  server: 'Server error. Please try again later.',
  network: 'Network error. Please check your connection.',
};

/**
 * Error codes that can be returned from the API
 */
export const ERROR_CODES = {
  // Auth errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  
  // Validation errors
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  MISSING_FIELD: 'MISSING_FIELD',
  
  // Resource errors
  CHAT_NOT_FOUND: 'CHAT_NOT_FOUND',
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  
  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',
  
  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

// ============================================
// Error Parsing Functions
// ============================================

/**
 * Parse API errors into user-friendly format
 * Handles network errors and displays appropriate messages (Requirement 9.2)
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
        message: ERROR_MESSAGES.network,
      };
    }

    // Map HTTP status to error type
    const errorType = getErrorTypeFromStatus(status);
    const defaultMessage = ERROR_MESSAGES[errorType];

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
 * Get error type from HTTP status code
 */
export const getErrorTypeFromStatus = (status?: number): ErrorType => {
  switch (status) {
    case 400:
      return 'validation';
    case 401:
      return 'auth';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 429:
      return 'rate_limit';
    default:
      return 'server';
  }
};

/**
 * Check if error is a specific type
 */
export const isErrorType = (error: ParsedError, type: ErrorType): boolean => {
  return error.type === type;
};

/**
 * Check if error is a network error
 */
export const isNetworkError = (error: ParsedError): boolean => {
  return error.type === 'network';
};

/**
 * Check if error is an authentication error
 */
export const isAuthError = (error: ParsedError): boolean => {
  return error.type === 'auth';
};

/**
 * Check if error is a validation error
 */
export const isValidationError = (error: ParsedError): boolean => {
  return error.type === 'validation';
};

// ============================================
// User-Friendly Message Helpers
// ============================================

/**
 * Get a user-friendly message for an error
 */
export const getUserFriendlyMessage = (error: ParsedError): string => {
  // If we have a specific message from the API, use it
  if (error.message && error.message !== ERROR_MESSAGES[error.type]) {
    return error.message;
  }
  
  // Otherwise, use the default message for the error type
  return ERROR_MESSAGES[error.type] || 'An unexpected error occurred.';
};

/**
 * Get a short error title based on error type
 */
export const getErrorTitle = (error: ParsedError): string => {
  switch (error.type) {
    case 'validation':
      return 'Invalid Input';
    case 'auth':
      return 'Authentication Error';
    case 'forbidden':
      return 'Access Denied';
    case 'not_found':
      return 'Not Found';
    case 'rate_limit':
      return 'Too Many Requests';
    case 'network':
      return 'Connection Error';
    case 'server':
    default:
      return 'Error';
  }
};

/**
 * Format validation errors from details object
 */
export const formatValidationErrors = (
  details?: Record<string, unknown>
): string[] => {
  if (!details) return [];
  
  return Object.entries(details)
    .filter(([, value]) => typeof value === 'string')
    .map(([field, message]) => `${field}: ${message}`);
};

// ============================================
// Error Recovery Helpers
// ============================================

/**
 * Determine if an error is retryable
 */
export const isRetryableError = (error: ParsedError): boolean => {
  return error.type === 'network' || error.type === 'server' || error.type === 'rate_limit';
};

/**
 * Get suggested action for an error
 */
export const getSuggestedAction = (error: ParsedError): string => {
  switch (error.type) {
    case 'network':
      return 'Check your internet connection and try again.';
    case 'auth':
      return 'Please log in again to continue.';
    case 'forbidden':
      return 'Contact support if you believe this is an error.';
    case 'not_found':
      return 'The item may have been deleted or moved.';
    case 'rate_limit':
      return 'Please wait a moment before trying again.';
    case 'validation':
      return 'Please check your input and try again.';
    case 'server':
    default:
      return 'Please try again later.';
  }
};

// ============================================
// Error Logging
// ============================================

/**
 * Log error for debugging (can be extended to send to error tracking service)
 */
export const logError = (
  error: ParsedError,
  context?: Record<string, unknown>
): void => {
  console.error('[API Error]', {
    type: error.type,
    message: error.message,
    code: error.code,
    details: error.details,
    context,
  });
};

// ============================================
// Export Types
// ============================================

export type { ParsedError, ErrorType };
