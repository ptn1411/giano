/**
 * Settings Store
 * Manages all user settings state using Zustand with real API integration
 * Requirements: 7.1-7.8
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  settingsService,
  ProfileSettings,
  PrivacySettings,
  NotificationSettings,
  ChatSettings,
  DataStorageSettings,
  AppearanceSettings,
  Device,
} from '@/services/api';

// ============================================
// Types
// ============================================

interface SettingsState {
  // Data
  profile: ProfileSettings | null;
  privacy: PrivacySettings | null;
  notifications: NotificationSettings | null;
  chatSettings: ChatSettings | null;
  dataStorage: DataStorageSettings | null;
  appearance: AppearanceSettings | null;
  devices: Device[];

  // Loading states
  isLoading: boolean;
  isProfileLoading: boolean;
  isPrivacyLoading: boolean;
  isNotificationsLoading: boolean;
  isChatSettingsLoading: boolean;
  isDataStorageLoading: boolean;
  isAppearanceLoading: boolean;
  isDevicesLoading: boolean;

  // Error states
  error: string | null;

  // Actions - Fetch
  fetchAllSettings: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  fetchPrivacy: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  fetchChatSettings: () => Promise<void>;
  fetchDataStorage: () => Promise<void>;
  fetchAppearance: () => Promise<void>;
  fetchDevices: () => Promise<void>;

  // Actions - Update
  updateProfile: (updates: Partial<ProfileSettings>) => Promise<{ error: string | null }>;
  updatePrivacy: (updates: Partial<PrivacySettings>) => Promise<{ error: string | null }>;
  updateNotifications: (updates: Partial<NotificationSettings>) => Promise<{ error: string | null }>;
  updateChatSettings: (updates: Partial<ChatSettings>) => Promise<{ error: string | null }>;
  updateDataStorage: (updates: Partial<DataStorageSettings>) => Promise<{ error: string | null }>;
  updateAppearance: (updates: Partial<AppearanceSettings>) => Promise<{ error: string | null }>;

  // Actions - Device management
  terminateDevice: (deviceId: string) => Promise<{ error: string | null }>;
  terminateAllOtherDevices: () => Promise<{ error: string | null }>;

  // Actions - Cache
  clearCache: () => Promise<{ error: string | null }>;

  // Actions - Reset
  reset: () => void;
}

// ============================================
// Initial State
// ============================================

const initialState = {
  profile: null,
  privacy: null,
  notifications: null,
  chatSettings: null,
  dataStorage: null,
  appearance: null,
  devices: [],
  isLoading: false,
  isProfileLoading: false,
  isPrivacyLoading: false,
  isNotificationsLoading: false,
  isChatSettingsLoading: false,
  isDataStorageLoading: false,
  isAppearanceLoading: false,
  isDevicesLoading: false,
  error: null,
};

// ============================================
// Settings Store
// ============================================

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...initialState,

      /**
       * Fetch all settings at once
       * Requirement 7.1: Fetch all settings from respective endpoints
       */
      fetchAllSettings: async () => {
        set({ isLoading: true, error: null });

        try {
          const [
            profileResult,
            privacyResult,
            notificationsResult,
            chatSettingsResult,
            dataStorageResult,
            appearanceResult,
            devicesResult,
          ] = await Promise.all([
            settingsService.getProfile(),
            settingsService.getPrivacy(),
            settingsService.getNotifications(),
            settingsService.getChatSettings(),
            settingsService.getDataStorage(),
            settingsService.getAppearance(),
            settingsService.getDevices(),
          ]);

          set({
            profile: profileResult.data,
            privacy: privacyResult.data,
            notifications: notificationsResult.data,
            chatSettings: chatSettingsResult.data,
            dataStorage: dataStorageResult.data,
            appearance: appearanceResult.data,
            devices: devicesResult.data || [],
            isLoading: false,
          });
        } catch {
          set({ isLoading: false, error: 'Failed to load settings' });
        }
      },

      /**
       * Fetch profile settings
       */
      fetchProfile: async () => {
        set({ isProfileLoading: true });
        const result = await settingsService.getProfile();
        set({
          profile: result.data,
          isProfileLoading: false,
          error: result.error,
        });
      },

      /**
       * Fetch privacy settings
       */
      fetchPrivacy: async () => {
        set({ isPrivacyLoading: true });
        const result = await settingsService.getPrivacy();
        set({
          privacy: result.data,
          isPrivacyLoading: false,
          error: result.error,
        });
      },

      /**
       * Fetch notification settings
       */
      fetchNotifications: async () => {
        set({ isNotificationsLoading: true });
        const result = await settingsService.getNotifications();
        set({
          notifications: result.data,
          isNotificationsLoading: false,
          error: result.error,
        });
      },

      /**
       * Fetch chat settings
       */
      fetchChatSettings: async () => {
        set({ isChatSettingsLoading: true });
        const result = await settingsService.getChatSettings();
        set({
          chatSettings: result.data,
          isChatSettingsLoading: false,
          error: result.error,
        });
      },

      /**
       * Fetch data storage settings
       */
      fetchDataStorage: async () => {
        set({ isDataStorageLoading: true });
        const result = await settingsService.getDataStorage();
        set({
          dataStorage: result.data,
          isDataStorageLoading: false,
          error: result.error,
        });
      },

      /**
       * Fetch appearance settings
       */
      fetchAppearance: async () => {
        set({ isAppearanceLoading: true });
        const result = await settingsService.getAppearance();
        set({
          appearance: result.data,
          isAppearanceLoading: false,
          error: result.error,
        });
      },

      /**
       * Fetch devices list
       * Requirement 7.7: Fetch from GET /settings/devices
       */
      fetchDevices: async () => {
        set({ isDevicesLoading: true });
        const result = await settingsService.getDevices();
        set({
          devices: result.data || [],
          isDevicesLoading: false,
          error: result.error,
        });
      },

      /**
       * Update profile settings
       * Requirement 7.2: Call PUT /settings/profile
       */
      updateProfile: async (updates: Partial<ProfileSettings>) => {
        const currentProfile = get().profile;
        
        // Optimistic update
        if (currentProfile) {
          set({ profile: { ...currentProfile, ...updates } });
        }

        const result = await settingsService.updateProfile(updates);
        
        if (result.error) {
          // Rollback on error
          set({ profile: currentProfile, error: result.error });
          return { error: result.error };
        }

        set({ profile: result.data });
        return { error: null };
      },

      /**
       * Update privacy settings
       * Requirement 7.3: Call PUT /settings/privacy
       */
      updatePrivacy: async (updates: Partial<PrivacySettings>) => {
        const currentPrivacy = get().privacy;
        
        // Optimistic update
        if (currentPrivacy) {
          set({ privacy: { ...currentPrivacy, ...updates } });
        }

        const result = await settingsService.updatePrivacy(updates);
        
        if (result.error) {
          // Rollback on error
          set({ privacy: currentPrivacy, error: result.error });
          return { error: result.error };
        }

        set({ privacy: result.data });
        return { error: null };
      },

      /**
       * Update notification settings
       * Requirement 7.4: Call PUT /settings/notifications
       */
      updateNotifications: async (updates: Partial<NotificationSettings>) => {
        const currentNotifications = get().notifications;
        
        // Optimistic update
        if (currentNotifications) {
          set({ notifications: { ...currentNotifications, ...updates } });
        }

        const result = await settingsService.updateNotifications(updates);
        
        if (result.error) {
          // Rollback on error
          set({ notifications: currentNotifications, error: result.error });
          return { error: result.error };
        }

        set({ notifications: result.data });
        return { error: null };
      },

      /**
       * Update chat settings
       */
      updateChatSettings: async (updates: Partial<ChatSettings>) => {
        const currentChatSettings = get().chatSettings;
        
        // Optimistic update
        if (currentChatSettings) {
          set({ chatSettings: { ...currentChatSettings, ...updates } });
        }

        const result = await settingsService.updateChatSettings(updates);
        
        if (result.error) {
          // Rollback on error
          set({ chatSettings: currentChatSettings, error: result.error });
          return { error: result.error };
        }

        set({ chatSettings: result.data });
        return { error: null };
      },

      /**
       * Update data storage settings
       */
      updateDataStorage: async (updates: Partial<DataStorageSettings>) => {
        const currentDataStorage = get().dataStorage;
        
        // Optimistic update
        if (currentDataStorage) {
          set({ dataStorage: { ...currentDataStorage, ...updates } });
        }

        const result = await settingsService.updateDataStorage(updates);
        
        if (result.error) {
          // Rollback on error
          set({ dataStorage: currentDataStorage, error: result.error });
          return { error: result.error };
        }

        set({ dataStorage: result.data });
        return { error: null };
      },

      /**
       * Update appearance settings
       * Requirement 7.5: Call PUT /settings/appearance
       */
      updateAppearance: async (updates: Partial<AppearanceSettings>) => {
        const currentAppearance = get().appearance;
        
        // Optimistic update
        if (currentAppearance) {
          set({ appearance: { ...currentAppearance, ...updates } });
        }

        const result = await settingsService.updateAppearance(updates);
        
        if (result.error) {
          // Rollback on error
          set({ appearance: currentAppearance, error: result.error });
          return { error: result.error };
        }

        set({ appearance: result.data });
        return { error: null };
      },

      /**
       * Terminate a device session
       * Requirement 7.8: Call DELETE /settings/devices/:deviceId
       */
      terminateDevice: async (deviceId: string) => {
        const currentDevices = get().devices;
        
        // Optimistic update - remove device from list
        set({ devices: currentDevices.filter(d => d.id !== deviceId) });

        const result = await settingsService.terminateDevice(deviceId);
        
        if (result.error) {
          // Rollback on error
          set({ devices: currentDevices, error: result.error });
          return { error: result.error };
        }

        return { error: null };
      },

      /**
       * Terminate all other device sessions
       */
      terminateAllOtherDevices: async () => {
        const currentDevices = get().devices;
        
        // Optimistic update - keep only current device
        set({ devices: currentDevices.filter(d => d.isCurrent) });

        const result = await settingsService.terminateAllOtherDevices();
        
        if (result.error) {
          // Rollback on error
          set({ devices: currentDevices, error: result.error });
          return { error: result.error };
        }

        return { error: null };
      },

      /**
       * Clear cache
       * Requirement 7.6: Call POST /settings/clear-cache
       */
      clearCache: async () => {
        const result = await settingsService.clearCache();
        
        if (result.error) {
          set({ error: result.error });
          return { error: result.error };
        }

        // Refresh data storage settings to get updated cache size
        const dataStorageResult = await settingsService.getDataStorage();
        if (dataStorageResult.data) {
          set({ dataStorage: dataStorageResult.data });
        }

        return { error: null };
      },

      /**
       * Reset store to initial state
       */
      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'settings-storage',
      // Only persist appearance settings for offline access
      partialize: (state) => ({
        appearance: state.appearance,
      }),
    }
  )
);

// ============================================
// Selectors
// ============================================

export const selectProfile = (state: SettingsState) => state.profile;
export const selectPrivacy = (state: SettingsState) => state.privacy;
export const selectNotifications = (state: SettingsState) => state.notifications;
export const selectChatSettings = (state: SettingsState) => state.chatSettings;
export const selectDataStorage = (state: SettingsState) => state.dataStorage;
export const selectAppearance = (state: SettingsState) => state.appearance;
export const selectDevices = (state: SettingsState) => state.devices;
export const selectIsLoading = (state: SettingsState) => state.isLoading;
export const selectError = (state: SettingsState) => state.error;
