/**
 * Settings API Service
 * Handles all settings-related API calls
 * Requirements: 7.1-7.8
 */

import { apiClient, parseApiError } from './client';

// ============================================
// Settings Types
// ============================================

export interface ProfileSettings {
  name: string;
  username: string;
  bio?: string;
  avatar?: string;
  phone?: string;
  email?: string;
}

export interface PrivacySettings {
  lastSeen: 'everyone' | 'contacts' | 'nobody';
  profilePhoto: 'everyone' | 'contacts' | 'nobody';
  calls: 'everyone' | 'contacts' | 'nobody';
  groups: 'everyone' | 'contacts' | 'nobody';
  forwards: boolean;
  readReceipts: boolean;
  twoFactorAuth: boolean;
}

export interface NotificationSettings {
  messageNotifications: boolean;
  groupNotifications: boolean;
  channelNotifications: boolean;
  inAppSounds: boolean;
  inAppVibrate: boolean;
  inAppPreview: boolean;
  contactJoined: boolean;
}

export interface ChatSettings {
  enterToSend: boolean;
  mediaAutoDownload: 'wifi' | 'always' | 'never';
  saveToGallery: boolean;
  autoPlayGifs: boolean;
  autoPlayVideos: boolean;
  raiseToSpeak: boolean;
  sendByEnter: boolean;
}

export interface DataStorageSettings {
  storageUsed: number;
  cacheSize: number;
  keepMedia: '1week' | '1month' | '3months' | 'forever';
  autoDownloadPhotos: boolean;
  autoDownloadVideos: boolean;
  autoDownloadFiles: boolean;
  dataSaver: boolean;
}

export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  fontSize: 'small' | 'medium' | 'large';
  chatBackground: string;
  bubbleStyle: 'rounded' | 'square';
  animationsEnabled: boolean;
}

export interface Device {
  id: string;
  name: string;
  type: 'desktop' | 'mobile' | 'tablet' | 'web';
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

// ============================================
// Response Types
// ============================================

interface ProfileResponse {
  profile: ProfileSettings;
}

interface PrivacyResponse {
  privacy: PrivacySettings;
}

interface NotificationResponse {
  notifications: NotificationSettings;
}

interface ChatSettingsResponse {
  chatSettings: ChatSettings;
}

interface DataStorageResponse {
  dataStorage: DataStorageSettings;
}

interface AppearanceResponse {
  appearance: AppearanceSettings;
}

interface DevicesResponse {
  devices: Device[];
}

// ============================================
// Result Types
// ============================================

export interface SettingsResult<T> {
  data: T | null;
  error: string | null;
}

// ============================================
// Settings API Service
// ============================================

export const settingsService = {
  async getProfile(): Promise<SettingsResult<ProfileSettings>> {
    try {
      const response = await apiClient.get<ProfileResponse>('/settings/profile');
      return { data: response.data.profile, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { data: null, error: parsedError.message };
    }
  },

  async updateProfile(updates: Partial<ProfileSettings>): Promise<SettingsResult<ProfileSettings>> {
    try {
      const response = await apiClient.put<ProfileResponse>('/settings/profile', updates);
      return { data: response.data.profile, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { data: null, error: parsedError.message };
    }
  },

  async getPrivacy(): Promise<SettingsResult<PrivacySettings>> {
    try {
      const response = await apiClient.get<PrivacyResponse>('/settings/privacy');
      return { data: response.data.privacy, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { data: null, error: parsedError.message };
    }
  },

  async updatePrivacy(updates: Partial<PrivacySettings>): Promise<SettingsResult<PrivacySettings>> {
    try {
      const response = await apiClient.put<PrivacyResponse>('/settings/privacy', updates);
      return { data: response.data.privacy, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { data: null, error: parsedError.message };
    }
  },

  async getNotifications(): Promise<SettingsResult<NotificationSettings>> {
    try {
      const response = await apiClient.get<NotificationResponse>('/settings/notifications');
      return { data: response.data.notifications, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { data: null, error: parsedError.message };
    }
  },

  async updateNotifications(updates: Partial<NotificationSettings>): Promise<SettingsResult<NotificationSettings>> {
    try {
      const response = await apiClient.put<NotificationResponse>('/settings/notifications', updates);
      return { data: response.data.notifications, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { data: null, error: parsedError.message };
    }
  },

  async getChatSettings(): Promise<SettingsResult<ChatSettings>> {
    try {
      const response = await apiClient.get<ChatSettingsResponse>('/settings/chat');
      return { data: response.data.chatSettings, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { data: null, error: parsedError.message };
    }
  },

  async updateChatSettings(updates: Partial<ChatSettings>): Promise<SettingsResult<ChatSettings>> {
    try {
      const response = await apiClient.put<ChatSettingsResponse>('/settings/chat', updates);
      return { data: response.data.chatSettings, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { data: null, error: parsedError.message };
    }
  },

  async getDataStorage(): Promise<SettingsResult<DataStorageSettings>> {
    try {
      const response = await apiClient.get<DataStorageResponse>('/settings/data-storage');
      return { data: response.data.dataStorage, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { data: null, error: parsedError.message };
    }
  },

  async updateDataStorage(updates: Partial<DataStorageSettings>): Promise<SettingsResult<DataStorageSettings>> {
    try {
      const response = await apiClient.put<DataStorageResponse>('/settings/data-storage', updates);
      return { data: response.data.dataStorage, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { data: null, error: parsedError.message };
    }
  },

  async getAppearance(): Promise<SettingsResult<AppearanceSettings>> {
    try {
      const response = await apiClient.get<AppearanceResponse>('/settings/appearance');
      return { data: response.data.appearance, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { data: null, error: parsedError.message };
    }
  },

  async updateAppearance(updates: Partial<AppearanceSettings>): Promise<SettingsResult<AppearanceSettings>> {
    try {
      const response = await apiClient.put<AppearanceResponse>('/settings/appearance', updates);
      return { data: response.data.appearance, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { data: null, error: parsedError.message };
    }
  },

  async clearCache(): Promise<SettingsResult<void>> {
    try {
      await apiClient.post('/settings/clear-cache');
      return { data: undefined, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { data: null, error: parsedError.message };
    }
  },

  async getDevices(): Promise<SettingsResult<Device[]>> {
    try {
      const response = await apiClient.get<DevicesResponse>('/settings/devices');
      return { data: response.data.devices, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { data: null, error: parsedError.message };
    }
  },

  async terminateDevice(deviceId: string): Promise<SettingsResult<void>> {
    try {
      await apiClient.delete(`/settings/devices/${deviceId}`);
      return { data: undefined, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { data: null, error: parsedError.message };
    }
  },

  async terminateAllOtherDevices(): Promise<SettingsResult<void>> {
    try {
      await apiClient.delete('/settings/devices');
      return { data: undefined, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { data: null, error: parsedError.message };
    }
  },
};

export default settingsService;
