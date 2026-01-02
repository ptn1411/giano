import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Shield,
  Bell,
  MessageSquare,
  Database,
  Palette,
  Smartphone,
  ChevronRight,
  Camera,
  Edit2,
  Eye,
  EyeOff,
  Lock,
  UserPlus,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Monitor,
  Trash2,
  LogOut,
  Globe,
  Wifi,
  WifiOff,
  Check,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  settingsApi,
  UserProfile,
  PrivacySettings,
  NotificationSettings,
  ChatSettings,
  DataStorageSettings,
  AppearanceSettings,
  Device,
} from "@/services/settingsData";

type SettingsSection = 
  | 'main'
  | 'account'
  | 'privacy'
  | 'notifications'
  | 'chat'
  | 'data'
  | 'appearance'
  | 'devices';

interface SettingItemProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  destructive?: boolean;
}

function SettingItem({ icon, title, description, onClick, trailing, destructive }: SettingItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-accent/50 transition-colors",
        destructive && "text-destructive"
      )}
    >
      <div className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full",
        destructive ? "bg-destructive/10" : "bg-primary/10"
      )}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("font-medium", destructive ? "text-destructive" : "text-foreground")}>
          {title}
        </p>
        {description && (
          <p className="text-sm text-muted-foreground truncate">{description}</p>
        )}
      </div>
      {trailing || <ChevronRight className="h-5 w-5 text-muted-foreground" />}
    </button>
  );
}

function ToggleItem({ 
  title, 
  description, 
  checked, 
  onCheckedChange 
}: { 
  title: string; 
  description?: string; 
  checked: boolean; 
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex-1 min-w-0 pr-4">
        <p className="font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const [section, setSection] = useState<SettingsSection>('main');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [privacy, setPrivacy] = useState<PrivacySettings | null>(null);
  const [notifications, setNotifications] = useState<NotificationSettings | null>(null);
  const [chatSettings, setChatSettings] = useState<ChatSettings | null>(null);
  const [dataStorage, setDataStorage] = useState<DataStorageSettings | null>(null);
  const [appearance, setAppearance] = useState<AppearanceSettings | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editedProfile, setEditedProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const [
      profileData,
      privacyData,
      notifData,
      chatData,
      dataData,
      appearanceData,
      devicesData,
    ] = await Promise.all([
      settingsApi.getProfile(),
      settingsApi.getPrivacySettings(),
      settingsApi.getNotificationSettings(),
      settingsApi.getChatSettings(),
      settingsApi.getDataStorageSettings(),
      settingsApi.getAppearanceSettings(),
      settingsApi.getDevices(),
    ]);
    setProfile(profileData);
    setPrivacy(privacyData);
    setNotifications(notifData);
    setChatSettings(chatData);
    setDataStorage(dataData);
    setAppearance(appearanceData);
    setDevices(devicesData);
    setEditedProfile(profileData);
  };

  const handleBack = () => {
    if (section === 'main') {
      navigate('/');
    } else {
      setSection('main');
    }
  };

  const handleSaveProfile = async () => {
    if (editedProfile) {
      await settingsApi.updateProfile(editedProfile);
      setProfile(editedProfile);
      setEditingProfile(false);
      toast({ title: 'Profile updated', description: 'Your changes have been saved' });
    }
  };

  const updatePrivacy = async (updates: Partial<PrivacySettings>) => {
    const updated = await settingsApi.updatePrivacySettings(updates);
    setPrivacy(updated);
    toast({ title: 'Settings saved' });
  };

  const updateNotifications = async (updates: Partial<NotificationSettings>) => {
    const updated = await settingsApi.updateNotificationSettings(updates);
    setNotifications(updated);
    toast({ title: 'Settings saved' });
  };

  const updateChatSettings = async (updates: Partial<ChatSettings>) => {
    const updated = await settingsApi.updateChatSettings(updates);
    setChatSettings(updated);
    toast({ title: 'Settings saved' });
  };

  const updateDataStorage = async (updates: Partial<DataStorageSettings>) => {
    const updated = await settingsApi.updateDataStorageSettings(updates);
    setDataStorage(updated);
    toast({ title: 'Settings saved' });
  };

  const updateAppearance = async (updates: Partial<AppearanceSettings>) => {
    const updated = await settingsApi.updateAppearanceSettings(updates);
    setAppearance(updated);
    toast({ title: 'Settings saved' });
  };

  const clearCache = async () => {
    await settingsApi.clearCache();
    const updated = await settingsApi.getDataStorageSettings();
    setDataStorage(updated);
    toast({ title: 'Cache cleared', description: 'All cached data has been removed' });
  };

  const terminateDevice = async (deviceId: string) => {
    await settingsApi.terminateDevice(deviceId);
    const updated = await settingsApi.getDevices();
    setDevices(updated);
    toast({ title: 'Session terminated' });
  };

  const terminateAllDevices = async () => {
    await settingsApi.terminateAllOtherDevices();
    const updated = await settingsApi.getDevices();
    setDevices(updated);
    toast({ title: 'All other sessions terminated' });
  };

  const getDeviceIcon = (type: Device['type']) => {
    switch (type) {
      case 'mobile': return <Smartphone className="h-5 w-5" />;
      case 'desktop': return <Monitor className="h-5 w-5" />;
      case 'tablet': return <Smartphone className="h-5 w-5" />;
      case 'web': return <Globe className="h-5 w-5" />;
    }
  };

  const getSectionTitle = () => {
    switch (section) {
      case 'main': return 'Settings';
      case 'account': return 'Account & Profile';
      case 'privacy': return 'Privacy & Security';
      case 'notifications': return 'Notifications';
      case 'chat': return 'Chat Settings';
      case 'data': return 'Data & Storage';
      case 'appearance': return 'Appearance';
      case 'devices': return 'Devices & Sessions';
    }
  };

  const renderMainSection = () => (
    <div className="divide-y divide-border">
      {/* Profile Summary */}
      {profile && (
        <div className="p-4 flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={profile.avatar} alt={profile.name} />
            <AvatarFallback>{profile.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">{profile.name}</h2>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
            <p className="text-sm text-muted-foreground">{profile.phone}</p>
          </div>
        </div>
      )}

      <div className="py-2">
        <SettingItem
          icon={<User className="h-5 w-5 text-primary" />}
          title="Account & Profile"
          description="Edit profile, username, bio"
          onClick={() => setSection('account')}
        />
        <SettingItem
          icon={<Shield className="h-5 w-5 text-primary" />}
          title="Privacy & Security"
          description="Last seen, read receipts, 2FA"
          onClick={() => setSection('privacy')}
        />
        <SettingItem
          icon={<Bell className="h-5 w-5 text-primary" />}
          title="Notifications"
          description="Message, group, sound settings"
          onClick={() => setSection('notifications')}
        />
        <SettingItem
          icon={<MessageSquare className="h-5 w-5 text-primary" />}
          title="Chat Settings"
          description="Media, keyboard, send button"
          onClick={() => setSection('chat')}
        />
        <SettingItem
          icon={<Database className="h-5 w-5 text-primary" />}
          title="Data & Storage"
          description="Storage usage, auto-download"
          onClick={() => setSection('data')}
        />
        <SettingItem
          icon={<Palette className="h-5 w-5 text-primary" />}
          title="Appearance"
          description="Theme, colors, font size"
          onClick={() => setSection('appearance')}
        />
        <SettingItem
          icon={<Smartphone className="h-5 w-5 text-primary" />}
          title="Devices & Sessions"
          description={`${devices.length} active sessions`}
          onClick={() => setSection('devices')}
        />
      </div>
    </div>
  );

  const renderAccountSection = () => (
    <div className="divide-y divide-border">
      {profile && (
        <>
          {/* Avatar Section */}
          <div className="p-6 flex flex-col items-center">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profile.avatar} alt={profile.name} />
                <AvatarFallback>{profile.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <button className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg">
                <Camera className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Edit Profile Form */}
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={editedProfile?.name || ''}
                onChange={(e) => setEditedProfile(prev => prev ? {...prev, name: e.target.value} : null)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={editedProfile?.username || ''}
                onChange={(e) => setEditedProfile(prev => prev ? {...prev, username: e.target.value} : null)}
                placeholder="Username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={editedProfile?.bio || ''}
                onChange={(e) => setEditedProfile(prev => prev ? {...prev, bio: e.target.value} : null)}
                placeholder="A few words about yourself"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={editedProfile?.phone || ''}
                onChange={(e) => setEditedProfile(prev => prev ? {...prev, phone: e.target.value} : null)}
                placeholder="Phone number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={editedProfile?.email || ''}
                onChange={(e) => setEditedProfile(prev => prev ? {...prev, email: e.target.value} : null)}
                placeholder="Email address"
                type="email"
              />
            </div>
            <Button onClick={handleSaveProfile} className="w-full">
              Save Changes
            </Button>
          </div>
        </>
      )}
    </div>
  );

  const renderPrivacySection = () => (
    <div className="divide-y divide-border">
      {privacy && (
        <>
          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Who can see my...</h3>
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Last Seen</p>
                <p className="text-sm text-muted-foreground">Who can see when you were online</p>
              </div>
              <Select value={privacy.lastSeen} onValueChange={(v) => updatePrivacy({ lastSeen: v as PrivacySettings['lastSeen'] })}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone">Everyone</SelectItem>
                  <SelectItem value="contacts">Contacts</SelectItem>
                  <SelectItem value="nobody">Nobody</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Profile Photo</p>
                <p className="text-sm text-muted-foreground">Who can see your profile photo</p>
              </div>
              <Select value={privacy.profilePhoto} onValueChange={(v) => updatePrivacy({ profilePhoto: v as PrivacySettings['profilePhoto'] })}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone">Everyone</SelectItem>
                  <SelectItem value="contacts">Contacts</SelectItem>
                  <SelectItem value="nobody">Nobody</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Calls</p>
                <p className="text-sm text-muted-foreground">Who can call you</p>
              </div>
              <Select value={privacy.calls} onValueChange={(v) => updatePrivacy({ calls: v as PrivacySettings['calls'] })}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone">Everyone</SelectItem>
                  <SelectItem value="contacts">Contacts</SelectItem>
                  <SelectItem value="nobody">Nobody</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Groups</p>
                <p className="text-sm text-muted-foreground">Who can add you to groups</p>
              </div>
              <Select value={privacy.groups} onValueChange={(v) => updatePrivacy({ groups: v as PrivacySettings['groups'] })}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone">Everyone</SelectItem>
                  <SelectItem value="contacts">Contacts</SelectItem>
                  <SelectItem value="nobody">Nobody</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Messages</h3>
            <ToggleItem
              title="Read Receipts"
              description="Show when you've read messages"
              checked={privacy.readReceipts}
              onCheckedChange={(checked) => updatePrivacy({ readReceipts: checked })}
            />
            <ToggleItem
              title="Forwarded Message Links"
              description="Link to your account when forwarding"
              checked={privacy.forwards}
              onCheckedChange={(checked) => updatePrivacy({ forwards: checked })}
            />
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Security</h3>
            <ToggleItem
              title="Two-Factor Authentication"
              description="Add an extra layer of security"
              checked={privacy.twoFactorAuth}
              onCheckedChange={(checked) => updatePrivacy({ twoFactorAuth: checked })}
            />
          </div>
        </>
      )}
    </div>
  );

  const renderNotificationsSection = () => (
    <div className="divide-y divide-border">
      {notifications && (
        <>
          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Notifications</h3>
            <ToggleItem
              title="Message Notifications"
              description="Get notified for new messages"
              checked={notifications.messageNotifications}
              onCheckedChange={(checked) => updateNotifications({ messageNotifications: checked })}
            />
            <ToggleItem
              title="Group Notifications"
              description="Get notified for group messages"
              checked={notifications.groupNotifications}
              onCheckedChange={(checked) => updateNotifications({ groupNotifications: checked })}
            />
            <ToggleItem
              title="Channel Notifications"
              description="Get notified for channel updates"
              checked={notifications.channelNotifications}
              onCheckedChange={(checked) => updateNotifications({ channelNotifications: checked })}
            />
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">In-App</h3>
            <ToggleItem
              title="In-App Sounds"
              description="Play sounds while in the app"
              checked={notifications.inAppSounds}
              onCheckedChange={(checked) => updateNotifications({ inAppSounds: checked })}
            />
            <ToggleItem
              title="In-App Vibration"
              description="Vibrate for notifications"
              checked={notifications.inAppVibrate}
              onCheckedChange={(checked) => updateNotifications({ inAppVibrate: checked })}
            />
            <ToggleItem
              title="Message Preview"
              description="Show message content in notifications"
              checked={notifications.inAppPreview}
              onCheckedChange={(checked) => updateNotifications({ inAppPreview: checked })}
            />
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Other</h3>
            <ToggleItem
              title="Contact Joined"
              description="Notify when a contact joins"
              checked={notifications.contactJoined}
              onCheckedChange={(checked) => updateNotifications({ contactJoined: checked })}
            />
          </div>
        </>
      )}
    </div>
  );

  const renderChatSection = () => (
    <div className="divide-y divide-border">
      {chatSettings && (
        <>
          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Keyboard</h3>
            <ToggleItem
              title="Send with Enter"
              description="Press Enter to send messages"
              checked={chatSettings.sendByEnter}
              onCheckedChange={(checked) => updateChatSettings({ sendByEnter: checked })}
            />
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Media</h3>
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Auto-Download Media</p>
                <p className="text-sm text-muted-foreground">When to download media automatically</p>
              </div>
              <Select value={chatSettings.mediaAutoDownload} onValueChange={(v) => updateChatSettings({ mediaAutoDownload: v as ChatSettings['mediaAutoDownload'] })}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wifi">Wi-Fi Only</SelectItem>
                  <SelectItem value="always">Always</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ToggleItem
              title="Save to Gallery"
              description="Automatically save media to your gallery"
              checked={chatSettings.saveToGallery}
              onCheckedChange={(checked) => updateChatSettings({ saveToGallery: checked })}
            />
            <ToggleItem
              title="Auto-Play GIFs"
              description="Play GIFs automatically in chat"
              checked={chatSettings.autoPlayGifs}
              onCheckedChange={(checked) => updateChatSettings({ autoPlayGifs: checked })}
            />
            <ToggleItem
              title="Auto-Play Videos"
              description="Play videos automatically in chat"
              checked={chatSettings.autoPlayVideos}
              onCheckedChange={(checked) => updateChatSettings({ autoPlayVideos: checked })}
            />
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Voice Messages</h3>
            <ToggleItem
              title="Raise to Speak"
              description="Hold phone to ear to record"
              checked={chatSettings.raiseToSpeak}
              onCheckedChange={(checked) => updateChatSettings({ raiseToSpeak: checked })}
            />
          </div>
        </>
      )}
    </div>
  );

  const renderDataSection = () => (
    <div className="divide-y divide-border">
      {dataStorage && (
        <>
          <div className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Storage Usage</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-foreground">Used Storage</span>
                <span className="text-muted-foreground">{(dataStorage.storageUsed / 1024).toFixed(2)} GB</span>
              </div>
              <Progress value={(dataStorage.storageUsed / 5000) * 100} className="h-2" />
              <div className="flex justify-between text-sm">
                <span className="text-foreground">Cache Size</span>
                <span className="text-muted-foreground">{dataStorage.cacheSize} MB</span>
              </div>
              <Button variant="outline" className="w-full" onClick={clearCache}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Cache
              </Button>
            </div>
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Media Retention</h3>
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Keep Media</p>
                <p className="text-sm text-muted-foreground">How long to keep downloaded media</p>
              </div>
              <Select value={dataStorage.keepMedia} onValueChange={(v) => updateDataStorage({ keepMedia: v as DataStorageSettings['keepMedia'] })}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1week">1 Week</SelectItem>
                  <SelectItem value="1month">1 Month</SelectItem>
                  <SelectItem value="3months">3 Months</SelectItem>
                  <SelectItem value="forever">Forever</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Auto-Download</h3>
            <ToggleItem
              title="Photos"
              description="Automatically download photos"
              checked={dataStorage.autoDownloadPhotos}
              onCheckedChange={(checked) => updateDataStorage({ autoDownloadPhotos: checked })}
            />
            <ToggleItem
              title="Videos"
              description="Automatically download videos"
              checked={dataStorage.autoDownloadVideos}
              onCheckedChange={(checked) => updateDataStorage({ autoDownloadVideos: checked })}
            />
            <ToggleItem
              title="Files"
              description="Automatically download files"
              checked={dataStorage.autoDownloadFiles}
              onCheckedChange={(checked) => updateDataStorage({ autoDownloadFiles: checked })}
            />
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Network</h3>
            <ToggleItem
              title="Data Saver"
              description="Reduce data usage on mobile networks"
              checked={dataStorage.dataSaver}
              onCheckedChange={(checked) => updateDataStorage({ dataSaver: checked })}
            />
          </div>
        </>
      )}
    </div>
  );

  const renderAppearanceSection = () => (
    <div className="divide-y divide-border">
      {appearance && (
        <>
          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Theme</h3>
            <div className="px-4 py-3 grid grid-cols-3 gap-3">
              {[
                { value: 'light', icon: Sun, label: 'Light' },
                { value: 'dark', icon: Moon, label: 'Dark' },
                { value: 'system', icon: Monitor, label: 'System' },
              ].map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => updateAppearance({ theme: value as AppearanceSettings['theme'] })}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors",
                    appearance.theme === value 
                      ? "border-primary bg-primary/10" 
                      : "border-border hover:bg-accent/50"
                  )}
                >
                  <Icon className={cn(
                    "h-6 w-6",
                    appearance.theme === value ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "text-sm font-medium",
                    appearance.theme === value ? "text-primary" : "text-foreground"
                  )}>{label}</span>
                  {appearance.theme === value && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Font Size</h3>
            <div className="px-4 py-3 grid grid-cols-3 gap-3">
              {[
                { value: 'small', label: 'Small' },
                { value: 'medium', label: 'Medium' },
                { value: 'large', label: 'Large' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => updateAppearance({ fontSize: value as AppearanceSettings['fontSize'] })}
                  className={cn(
                    "p-3 rounded-lg border text-center transition-colors",
                    appearance.fontSize === value 
                      ? "border-primary bg-primary/10 text-primary" 
                      : "border-border hover:bg-accent/50 text-foreground"
                  )}
                >
                  <span className={cn(
                    "font-medium",
                    value === 'small' && "text-sm",
                    value === 'medium' && "text-base",
                    value === 'large' && "text-lg"
                  )}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Accent Color</h3>
            <div className="px-4 py-3 flex gap-3 flex-wrap">
              {['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'].map((color) => (
                <button
                  key={color}
                  onClick={() => updateAppearance({ accentColor: color })}
                  className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center transition-transform hover:scale-110",
                    appearance.accentColor === color && "ring-2 ring-offset-2 ring-offset-background ring-foreground"
                  )}
                  style={{ backgroundColor: color }}
                >
                  {appearance.accentColor === color && (
                    <Check className="h-5 w-5 text-white" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Other</h3>
            <ToggleItem
              title="Animations"
              description="Enable smooth animations"
              checked={appearance.animationsEnabled}
              onCheckedChange={(checked) => updateAppearance({ animationsEnabled: checked })}
            />
          </div>
        </>
      )}
    </div>
  );

  const renderDevicesSection = () => (
    <div className="divide-y divide-border">
      <div className="p-4">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <Globe className="h-8 w-8 text-primary" />
          <div>
            <p className="font-medium text-foreground">This Device</p>
            <p className="text-sm text-muted-foreground">
              {devices.find(d => d.isCurrent)?.name || 'Current Session'}
            </p>
          </div>
        </div>
      </div>

      {devices.filter(d => !d.isCurrent).length > 0 && (
        <>
          <div className="p-4">
            <Button 
              variant="destructive" 
              className="w-full"
              onClick={terminateAllDevices}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Terminate All Other Sessions
            </Button>
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Other Sessions</h3>
            {devices.filter(d => !d.isCurrent).map((device) => (
              <div key={device.id} className="px-4 py-3 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent">
                  {getDeviceIcon(device.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{device.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {device.location} • {format(device.lastActive, 'MMM d, h:mm a')}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => terminateDevice(device.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      {devices.filter(d => !d.isCurrent).length === 0 && (
        <div className="p-8 text-center">
          <Check className="h-12 w-12 mx-auto text-primary mb-3" />
          <p className="font-medium text-foreground">No other sessions</p>
          <p className="text-sm text-muted-foreground">You're only logged in on this device</p>
        </div>
      )}
    </div>
  );

  const renderSection = () => {
    switch (section) {
      case 'main': return renderMainSection();
      case 'account': return renderAccountSection();
      case 'privacy': return renderPrivacySection();
      case 'notifications': return renderNotificationsSection();
      case 'chat': return renderChatSection();
      case 'data': return renderDataSection();
      case 'appearance': return renderAppearanceSection();
      case 'devices': return renderDevicesSection();
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button
          onClick={handleBack}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">{getSectionTitle()}</h1>
      </header>

      {/* Content */}
      <ScrollArea className="flex-1">
        {renderSection()}
      </ScrollArea>
    </div>
  );
}
