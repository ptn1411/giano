/**
 * Application Configuration
 * Centralized configuration management with environment variable support
 */

// ============================================
// Environment Variables
// ============================================

/**
 * Check if demo mode is enabled
 * Demo mode uses mock data instead of real API calls
 * Useful for testing, showcasing, or when backend is unavailable
 */
export const isDemoMode = (): boolean => {
  const demoMode = import.meta.env.VITE_DEMO_MODE;
  return demoMode === 'true' || demoMode === true;
};

/**
 * Get the API base URL
 */
export const getApiUrl = (): string => {
  return import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
};

/**
 * Get the WebSocket URL
 */
export const getWsUrl = (): string => {
  return import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';
};

/**
 * Check if debug mode is enabled
 */
export const isDebugMode = (): boolean => {
  const debug = import.meta.env.VITE_DEBUG;
  return debug === 'true' || debug === true;
};

/**
 * Get API request timeout in milliseconds
 */
export const getApiTimeout = (): number => {
  const timeout = import.meta.env.VITE_API_TIMEOUT;
  return timeout ? parseInt(timeout, 10) : 30000;
};

/**
 * Get maximum file upload size in bytes
 */
export const getMaxUploadSize = (): number => {
  const size = import.meta.env.VITE_MAX_UPLOAD_SIZE;
  return size ? parseInt(size, 10) : 10485760; // 10MB default
};

/**
 * Get the Mediasoup server URL for voice/video calling
 */
export const getMediasoupUrl = (): string => {
  return import.meta.env.VITE_MEDIASOUP_URL || 'ws://localhost:3001';
};

// ============================================
// Configuration Object
// ============================================

export const config = {
  isDemoMode: isDemoMode(),
  apiUrl: getApiUrl(),
  wsUrl: getWsUrl(),
  isDebugMode: isDebugMode(),
  apiTimeout: getApiTimeout(),
  maxUploadSize: getMaxUploadSize(),
  mediasoupUrl: getMediasoupUrl(),
} as const;

export default config;
