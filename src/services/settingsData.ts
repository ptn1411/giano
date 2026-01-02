// Settings Types
export interface UserProfile {
  id: string;
  name: string;
  username: string;
  bio: string;
  phone: string;
  email: string;
  avatar: string;
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
  storageUsed: number; // in MB
  cacheSize: number; // in MB
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
  lastActive: Date;
  isCurrent: boolean;
}

// Mock Data
export const mockProfile: UserProfile = {
  id: 'user-1',
  name: 'John Doe',
  username: 'johndoe',
  bio: 'Hey there! I am using this chat app.',
  phone: '+1 (555) 123-4567',
  email: 'john.doe@email.com',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=You',
};

export const mockPrivacySettings: PrivacySettings = {
  lastSeen: 'everyone',
  profilePhoto: 'everyone',
  calls: 'contacts',
  groups: 'contacts',
  forwards: true,
  readReceipts: true,
  twoFactorAuth: false,
};

export const mockNotificationSettings: NotificationSettings = {
  messageNotifications: true,
  groupNotifications: true,
  channelNotifications: true,
  inAppSounds: true,
  inAppVibrate: true,
  inAppPreview: true,
  contactJoined: false,
};

export const mockChatSettings: ChatSettings = {
  enterToSend: true,
  mediaAutoDownload: 'wifi',
  saveToGallery: false,
  autoPlayGifs: true,
  autoPlayVideos: true,
  raiseToSpeak: false,
  sendByEnter: true,
};

export const mockDataStorageSettings: DataStorageSettings = {
  storageUsed: 1250,
  cacheSize: 456,
  keepMedia: '1month',
  autoDownloadPhotos: true,
  autoDownloadVideos: false,
  autoDownloadFiles: false,
  dataSaver: false,
};

export const mockAppearanceSettings: AppearanceSettings = {
  theme: 'system',
  accentColor: '#6366f1',
  fontSize: 'medium',
  chatBackground: 'default',
  bubbleStyle: 'rounded',
  animationsEnabled: true,
};

export const mockDevices: Device[] = [
  {
    id: 'device-1',
    name: 'Chrome on MacBook Pro',
    type: 'web',
    location: 'San Francisco, USA',
    lastActive: new Date(),
    isCurrent: true,
  },
  {
    id: 'device-2',
    name: 'iPhone 15 Pro',
    type: 'mobile',
    location: 'San Francisco, USA',
    lastActive: new Date(Date.now() - 3600000),
    isCurrent: false,
  },
  {
    id: 'device-3',
    name: 'Desktop App',
    type: 'desktop',
    location: 'New York, USA',
    lastActive: new Date(Date.now() - 86400000),
    isCurrent: false,
  },
  {
    id: 'device-4',
    name: 'iPad Pro',
    type: 'tablet',
    location: 'Los Angeles, USA',
    lastActive: new Date(Date.now() - 172800000),
    isCurrent: false,
  },
];

// Simulated API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Settings API Service
export const settingsApi = {
  async getProfile(): Promise<UserProfile> {
    await delay(200);
    return { ...mockProfile };
  },

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    await delay(300);
    Object.assign(mockProfile, updates);
    return { ...mockProfile };
  },

  async getPrivacySettings(): Promise<PrivacySettings> {
    await delay(200);
    return { ...mockPrivacySettings };
  },

  async updatePrivacySettings(updates: Partial<PrivacySettings>): Promise<PrivacySettings> {
    await delay(200);
    Object.assign(mockPrivacySettings, updates);
    return { ...mockPrivacySettings };
  },

  async getNotificationSettings(): Promise<NotificationSettings> {
    await delay(200);
    return { ...mockNotificationSettings };
  },

  async updateNotificationSettings(updates: Partial<NotificationSettings>): Promise<NotificationSettings> {
    await delay(200);
    Object.assign(mockNotificationSettings, updates);
    return { ...mockNotificationSettings };
  },

  async getChatSettings(): Promise<ChatSettings> {
    await delay(200);
    return { ...mockChatSettings };
  },

  async updateChatSettings(updates: Partial<ChatSettings>): Promise<ChatSettings> {
    await delay(200);
    Object.assign(mockChatSettings, updates);
    return { ...mockChatSettings };
  },

  async getDataStorageSettings(): Promise<DataStorageSettings> {
    await delay(200);
    return { ...mockDataStorageSettings };
  },

  async updateDataStorageSettings(updates: Partial<DataStorageSettings>): Promise<DataStorageSettings> {
    await delay(200);
    Object.assign(mockDataStorageSettings, updates);
    return { ...mockDataStorageSettings };
  },

  async getAppearanceSettings(): Promise<AppearanceSettings> {
    await delay(200);
    return { ...mockAppearanceSettings };
  },

  async updateAppearanceSettings(updates: Partial<AppearanceSettings>): Promise<AppearanceSettings> {
    await delay(200);
    Object.assign(mockAppearanceSettings, updates);
    return { ...mockAppearanceSettings };
  },

  async getDevices(): Promise<Device[]> {
    await delay(300);
    return [...mockDevices];
  },

  async terminateDevice(deviceId: string): Promise<void> {
    await delay(200);
    const index = mockDevices.findIndex(d => d.id === deviceId);
    if (index !== -1 && !mockDevices[index].isCurrent) {
      mockDevices.splice(index, 1);
    }
  },

  async terminateAllOtherDevices(): Promise<void> {
    await delay(300);
    const currentDevice = mockDevices.find(d => d.isCurrent);
    mockDevices.length = 0;
    if (currentDevice) {
      mockDevices.push(currentDevice);
    }
  },

  async clearCache(): Promise<void> {
    await delay(500);
    mockDataStorageSettings.cacheSize = 0;
  },
};
