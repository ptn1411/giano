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
       * Requirement 6.1: Load all settings categories
       */
      fetchAllSettings: async () => {
        set({ isLoading: true, error: null });

        try {
          // Fetch all settings in parallel
          const [
            profileResult,
            privacyResult,
            notificationsResult,
            chatSettingsResult,
            dataStorageResult,
            appearanceResult,
            devicesResult,
          ] = await Promise.allSettled([
            settingsService.getProfile(),
            settingsService.getPrivacy(),
            settingsService.getNotifications(),
            settingsService.getChatSettings(),
            settingsService.getDataStorage(),
            settingsService.getAppearance(),
            settingsService.getDevices(),
          ]);

          // Extract data from settled promises
          const profile = profileResult.status === 'fulfilled' ? profileResult.value.data : null;
          const privacy = privacyResult.status === 'fulfilled' ? privacyResult.value.data : null;
          const notifications = notificationsResult.status === 'fulfilled' ? notificationsResult.value.data : null;
          const chatSettings = chatSettingsResult.status === 'fulfilled' ? chatSettingsResult.value.data : null;
          const dataStorage = dataStorageResult.status === 'fulfilled' ? dataStorageResult.value.data : null;
          const appearance = appearanceResult.status === 'fulfilled' ? appearanceResult.value.data : null;
          const devices = devicesResult.status === 'fulfilled' ? devicesResult.value.data || [] : [];

          // Collect any errors
          const errors = [
            profileResult.status === 'rejected' ? 'profile' : null,
            privacyResult.status === 'rejected' ? 'privacy' : null,
            notificationsResult.status === 'rejected' ? 'notifications' : null,
            chatSettingsResult.status === 'rejected' ? 'chat settings' : null,
            dataStorageResult.status === 'rejected' ? 'data storage' : null,
            appearanceResult.status === 'rejected' ? 'appearance' : null,
            devicesResult.status === 'rejected' ? 'devices' : null,
          ].filter(Boolean);

          set({
            profile,
            privacy,
            notifications,
            chatSettings,
            dataStorage,
            appearance,
            isLoading: false,
            error: errors.length > 0 ? `Failed to load: ${errors.join(', ')}` : null,
          });

          // Don't update devices in state to avoid overwriting optimistic updates
          // Only update if we successfully fetched them
          if (devicesResult.status === 'fulfilled' && devicesResult.value.data) {
            set({ devices: devicesResult.value.data });
          }
        } catch (error) {
          console.error('Unexpected error loading settings:', error);
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
       * Requirement 6.2: Save changes to backend immediately
       * Requirement 6.4: Revert on failure
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
          console.error('Failed to update profile:', result.error);
          set({ profile: currentProfile, error: result.error });
          return { error: result.error };
        }

        // Update with server response
        set({ profile: result.data, error: null });
        return { error: null };
      },

      /**
       * Update privacy settings
       * Requirement 7.3: Call PUT /settings/privacy
       * Requirement 6.2: Save changes to backend immediately
       * Requirement 6.4: Revert on failure
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
          console.error('Failed to update privacy:', result.error);
          set({ privacy: currentPrivacy, error: result.error });
          return { error: result.error };
        }

        // Update with server response
        set({ privacy: result.data, error: null });
        return { error: null };
      },

      /**
       * Update notification settings
       * Requirement 7.4: Call PUT /settings/notifications
       * Requirement 6.2: Save changes to backend immediately
       * Requirement 6.4: Revert on failure
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
          console.error('Failed to update notifications:', result.error);
          set({ notifications: currentNotifications, error: result.error });
          return { error: result.error };
        }

        // Update with server response
        set({ notifications: result.data, error: null });
        return { error: null };
      },

      /**
       * Update chat settings
       * Requirement 6.2: Save changes to backend immediately
       * Requirement 6.4: Revert on failure
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
          console.error('Failed to update chat settings:', result.error);
          set({ chatSettings: currentChatSettings, error: result.error });
          return { error: result.error };
        }

        // Update with server response
        set({ chatSettings: result.data, error: null });
        return { error: null };
      },

      /**
       * Update data storage settings
       * Requirement 6.2: Save changes to backend immediately
       * Requirement 6.4: Revert on failure
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
          console.error('Failed to update data storage:', result.error);
          set({ dataStorage: currentDataStorage, error: result.error });
          return { error: result.error };
        }

        // Update with server response
        set({ dataStorage: result.data, error: null });
        return { error: null };
      },

      /**
       * Update appearance settings
       * Requirement 7.5: Call PUT /settings/appearance
       * Requirement 6.2: Save changes to backend immediately
       * Requirement 6.4: Revert on failure
       * Requirement 12.4: Persist to localStorage
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
          console.error('Failed to update appearance:', result.error);
          set({ appearance: currentAppearance, error: result.error });
          return { error: result.error };
        }

        // Update with server response (will be persisted to localStorage by zustand persist)
        set({ appearance: result.data, error: null });
        return { error: null };
      },

      /**
       * Terminate a device session
       * Requirement 7.8: Call DELETE /settings/devices/:deviceId
       * Requirement 10.2: End specific session
       * Requirement 10.5: Remove from list immediately
       */
      terminateDevice: async (deviceId: string) => {
        const currentDevices = get().devices;
        
        // Check if trying to terminate current session
        const device = currentDevices.find(d => d.id === deviceId);
        if (device?.isCurrent) {
          const error = 'Cannot terminate current session';
          console.error(error);
          set({ error });
          return { error };
        }
        
        // Optimistic update - remove device from list
        set({ devices: currentDevices.filter(d => d.id !== deviceId) });

        const result = await settingsService.terminateDevice(deviceId);
        
        if (result.error) {
          // Rollback on error
          console.error('Failed to terminate device:', result.error);
          set({ devices: currentDevices, error: result.error });
          return { error: result.error };
        }

        set({ error: null });
        return { error: null };
      },

      /**
       * Terminate all other device sessions
       * Requirement 10.3: End all sessions except current
       * Requirement 10.5: Update list immediately
       */
      terminateAllOtherDevices: async () => {
        const currentDevices = get().devices;
        
        // Optimistic update - keep only current device
        set({ devices: currentDevices.filter(d => d.isCurrent) });

        const result = await settingsService.terminateAllOtherDevices();
        
        if (result.error) {
          // Rollback on error
          console.error('Failed to terminate all other devices:', result.error);
          set({ devices: currentDevices, error: result.error });
          return { error: result.error };
        }

        set({ error: null });
        return { error: null };
      },

      /**
       * Clear cache
       * Requirement 7.6: Call POST /settings/clear-cache
       * Requirement 9.2: Show updated storage statistics
       */
      clearCache: async () => {
        const result = await settingsService.clearCache();
        
        if (result.error) {
          console.error('Failed to clear cache:', result.error);
          set({ error: result.error });
          return { error: result.error };
        }

        // Refresh data storage settings to get updated cache size
        const dataStorageResult = await settingsService.getDataStorage();
        if (dataStorageResult.data) {
          set({ dataStorage: dataStorageResult.data, error: null });
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
      // Requirement 12.4: Persist appearance settings to localStorage
      partialize: (state) => ({
        appearance: state.appearance,
      }),
      // Apply appearance settings after rehydration from localStorage
      // Requirement 12.3: Restore settings on page reload
      onRehydrateStorage: () => (state) => {
        if (state?.appearance) {
          console.log('[Settings Store] Rehydrated appearance settings from localStorage:', state.appearance);
          // Appearance settings will be synced with theme store through the Settings page
          // or through a dedicated appearance initializer if needed
        }
      },
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
