/**
 * API Services Index
 * Re-exports all API-related modules
 */

// API Client
export {
  apiClient,
  parseApiError,
  isErrorType,
  setAuthToken,
  getAuthToken,
  removeAuthToken,
  hasAuthToken,
} from './client';

// Auth Service
export { authService } from './auth';
export type { AuthResult } from './auth';

// Users Service
export { usersService } from './users';
export type { UsersResult, UserResult } from './users';

// Chats Service
export { chatsService } from './chats';
export type { ChatsResult, ChatResult } from './chats';

// Messages Service
export { messagesService } from './messages';
export type { MessagesResult, MessageResult, DeleteResult } from './messages';

// Upload Service
export { uploadService } from './upload';
export type { UploadResult, UploadType } from './upload';

// Settings Service
export { settingsService } from './settings';
export type {
  ProfileSettings,
  PrivacySettings,
  NotificationSettings,
  ChatSettings,
  DataStorageSettings,
  AppearanceSettings,
  Device,
  SettingsResult,
} from './settings';

// Bots Service
export { botsService } from './bots';
export type { BotCallbackRequest, BotCallbackResponse, BotCallbackResult } from './bots';

// BotFather Service
export { botfatherService } from './botfather';
export type { BotFatherMessageRequest, BotFatherMessageResponse, BotFatherResult } from './botfather';

// Error Utilities
export {
  parseApiError as parseError,
  getErrorTypeFromStatus,
  isErrorType as checkErrorType,
  isNetworkError,
  isAuthError,
  isValidationError,
  getUserFriendlyMessage,
  getErrorTitle,
  formatValidationErrors,
  isRetryableError,
  getSuggestedAction,
  logError,
  ERROR_CODES,
} from './errors';

// Types
export * from './types';
