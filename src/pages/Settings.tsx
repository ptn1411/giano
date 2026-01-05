import { useState, useEffect, useRef } from "react";
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
  Sun,
  Moon,
  Monitor,
  Trash2,
  LogOut,
  Globe,
  Check,
  Loader2,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useTheme, colorThemes, ThemeMode } from "@/hooks/useTheme";
import { useAuthStore } from "@/stores/authStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { uploadService } from "@/services/api/upload";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { TransportIndicator } from "@/components/chat/TransportIndicator";
import type {
  ProfileSettings,
  PrivacySettings,
  NotificationSettings,
  ChatSettings,
  DataStorageSettings,
  AppearanceSettings,
  Device,
} from "@/services/api";


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
  onCheckedChange,
  disabled = false,
}: { 
  title: string; 
  description?: string; 
  checked: boolean; 
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex-1 min-w-0 pr-4">
        <p className="font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}


export default function Settings() {
  const navigate = useNavigate();
  const { logout, session } = useAuthStore();
  const { themeMode, setTheme, colorTheme: activeColorTheme, setColorTheme } = useTheme();
  const [section, setSection] = useState<SettingsSection>('main');
  const [editedProfile, setEditedProfile] = useState<ProfileSettings | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validationErrors, setValidationErrors] = useState<{
    username?: string;
    email?: string;
    phone?: string;
  }>({});
  const [isSaving, setIsSaving] = useState(false);

  // Get state and actions from settings store
  const {
    profile,
    privacy,
    notifications,
    chatSettings,
    dataStorage,
    appearance,
    devices,
    isLoading,
    error,
    fetchAllSettings,
    updateProfile,
    updatePrivacy,
    updateNotifications,
    updateChatSettings,
    updateDataStorage,
    updateAppearance,
    clearCache,
    terminateDevice,
    terminateAllOtherDevices,
  } = useSettingsStore();

  useEffect(() => {
    if (session) {
      fetchAllSettings();
    }
  }, [session, fetchAllSettings]);

  // Sync edited profile with profile from store
  useEffect(() => {
    if (profile) {
      // Merge with session user data if available
      const mergedProfile: ProfileSettings = session ? {
        ...profile,
        name: session.user.name || profile.name,
        avatar: session.user.avatar || profile.avatar,
        email: session.user.email || profile.email,
        phone: session.user.phone || profile.phone,
      } : profile;
      setEditedProfile(mergedProfile);
    }
  }, [profile, session]);

  const handleBack = () => {
    if (section === 'main') {
      navigate('/');
    } else {
      setSection('main');
    }
  };

  const handleSaveProfile = async () => {
    if (!validateProfileForm()) {
      toast({
        title: 'Validation failed',
        description: 'Please fix the errors before saving',
        variant: 'destructive',
      });
      return;
    }

    if (editedProfile) {
      setIsSaving(true);
      try {
        const { error } = await updateProfile(editedProfile);
        if (error) {
          throw new Error(error);
        }
        toast({ title: 'Profile updated', description: 'Your changes have been saved' });
      } catch (error) {
        console.error('Profile update error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
        toast({ 
          title: 'Error', 
          description: errorMessage, 
          variant: 'destructive' 
        });
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleUpdatePrivacy = async (updates: Partial<PrivacySettings>) => {
    setIsSaving(true);
    try {
      const { error } = await updatePrivacy(updates);
      if (error) {
        throw new Error(error);
      }
      toast({ title: 'Settings saved' });
    } catch (error) {
      console.error('Privacy update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update privacy settings';
      toast({ 
        title: 'Error', 
        description: errorMessage, 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateNotifications = async (updates: Partial<NotificationSettings>) => {
    setIsSaving(true);
    try {
      const { error } = await updateNotifications(updates);
      if (error) {
        throw new Error(error);
      }
      toast({ title: 'Settings saved' });
    } catch (error) {
      console.error('Notifications update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update notification settings';
      toast({ 
        title: 'Error', 
        description: errorMessage, 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateChatSettings = async (updates: Partial<ChatSettings>) => {
    setIsSaving(true);
    try {
      const { error } = await updateChatSettings(updates);
      if (error) {
        throw new Error(error);
      }
      toast({ title: 'Settings saved' });
    } catch (error) {
      console.error('Chat settings update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update chat settings';
      toast({ 
        title: 'Error', 
        description: errorMessage, 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateDataStorage = async (updates: Partial<DataStorageSettings>) => {
    setIsSaving(true);
    try {
      const { error } = await updateDataStorage(updates);
      if (error) {
        throw new Error(error);
      }
      toast({ title: 'Settings saved' });
    } catch (error) {
      console.error('Data storage update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update data storage settings';
      toast({ 
        title: 'Error', 
        description: errorMessage, 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateAppearance = async (updates: Partial<AppearanceSettings>) => {
    setIsSaving(true);
    try {
      // Apply theme changes immediately
      if (updates.theme) {
        setTheme(updates.theme as ThemeMode);
      }
      if (updates.accentColor) {
        const colorMap: Record<string, string> = {
          '#0284c7': 'default',
          '#0d9488': 'ocean',
          '#16a34a': 'forest',
          '#f97316': 'sunset',
          '#a855f7': 'purple',
          '#6366f1': 'default',
          '#22c55e': 'forest',
          '#f59e0b': 'sunset',
          '#ef4444': 'sunset',
          '#ec4899': 'purple',
          '#8b5cf6': 'purple',
        };
        const colorId = colorMap[updates.accentColor];
        if (colorId) {
          setColorTheme(colorId as 'default' | 'ocean' | 'forest' | 'sunset' | 'purple');
        }
      }
      const { error } = await updateAppearance(updates);
      if (error) {
        throw new Error(error);
      }
      toast({ title: 'Settings saved' });
    } catch (error) {
      console.error('Appearance update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update appearance settings';
      toast({ 
        title: 'Error', 
        description: errorMessage, 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearCache = async () => {
    setIsSaving(true);
    try {
      const { error } = await clearCache();
      if (error) {
        throw new Error(error);
      }
      toast({ title: 'Cache cleared', description: 'All cached data has been removed' });
    } catch (error) {
      console.error('Cache clear error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to clear cache';
      toast({ 
        title: 'Error', 
        description: errorMessage, 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTerminateDevice = async (deviceId: string) => {
    setIsSaving(true);
    try {
      const { error } = await terminateDevice(deviceId);
      if (error) {
        throw new Error(error);
      }
      toast({ title: 'Session terminated' });
    } catch (error) {
      console.error('Device termination error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to terminate session';
      toast({ 
        title: 'Error', 
        description: errorMessage, 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTerminateAllDevices = async () => {
    setIsSaving(true);
    try {
      const { error } = await terminateAllOtherDevices();
      if (error) {
        throw new Error(error);
      }
      toast({ title: 'All other sessions terminated' });
    } catch (error) {
      console.error('Terminate all devices error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to terminate sessions';
      toast({ 
        title: 'Error', 
        description: errorMessage, 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
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

  const handleLogout = async () => {
    await logout();
    toast({ 
      title: 'Logged out', 
      description: 'You have been logged out successfully' 
    });
    navigate('/auth');
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const validation = uploadService.validateFile(file, 5); // 5MB limit for avatars
    if (!validation.valid) {
      toast({
        title: 'Upload failed',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingAvatar(true);

    try {
      // Upload the file
      const result = await uploadService.uploadFile(file, 'image');

      if (!result.success || !result.attachment) {
        throw new Error(result.error || 'Upload failed');
      }

      // Update profile with new avatar URL
      const avatarUrl = result.attachment.url;
      const { error } = await updateProfile({ avatar: avatarUrl });

      if (error) {
        throw new Error(error);
      }

      // Update local state
      setEditedProfile(prev => prev ? { ...prev, avatar: avatarUrl } : null);

      toast({
        title: 'Avatar updated',
        description: 'Your profile picture has been updated',
      });
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload avatar',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingAvatar(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Validation functions
  const validateUsername = (username: string): string | undefined => {
    if (!username) {
      return 'Username is required';
    }
    if (username.length < 3) {
      return 'Username must be at least 3 characters';
    }
    if (username.length > 32) {
      return 'Username must be less than 32 characters';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return 'Username can only contain letters, numbers, and underscores';
    }
    return undefined;
  };

  const validateEmail = (email: string): string | undefined => {
    if (!email) {
      return undefined; // Email is optional
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    return undefined;
  };

  const validatePhone = (phone: string): string | undefined => {
    if (!phone) {
      return undefined; // Phone is optional
    }
    // Remove spaces, dashes, and parentheses for validation
    const cleanPhone = phone.replace(/[\s\-()]/g, '');
    // Check if it's a valid phone number (10-15 digits, optionally starting with +)
    if (!/^\+?\d{10,15}$/.test(cleanPhone)) {
      return 'Please enter a valid phone number';
    }
    return undefined;
  };

  const validateProfileForm = (): boolean => {
    if (!editedProfile) return false;

    const errors: typeof validationErrors = {};
    
    const usernameError = validateUsername(editedProfile.username);
    if (usernameError) errors.username = usernameError;

    const emailError = validateEmail(editedProfile.email || '');
    if (emailError) errors.email = emailError;

    const phoneError = validatePhone(editedProfile.phone || '');
    if (phoneError) errors.phone = phoneError;

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProfileFieldChange = (field: keyof ProfileSettings, value: string) => {
    setEditedProfile(prev => prev ? { ...prev, [field]: value } : null);
    
    // Clear validation error for this field
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field as keyof typeof validationErrors];
      return newErrors;
    });
  };


  const renderMainSection = () => {
    if (isLoading) {
      return <LoadingSkeleton />;
    }

    return (
      <div className="divide-y divide-border">
        {/* Profile Summary */}
        {editedProfile && (
          <div className="p-4 flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={editedProfile.avatar} alt={editedProfile.name} />
              <AvatarFallback>{editedProfile.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-foreground">{editedProfile.name}</h2>
              <p className="text-sm text-muted-foreground">@{editedProfile.username}</p>
              <p className="text-sm text-muted-foreground">{editedProfile.phone}</p>
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

        {/* Logout Button */}
        <div className="py-2">
          <SettingItem
            icon={<LogOut className="h-5 w-5 text-destructive" />}
            title="Log Out"
            description="Sign out of your account"
            onClick={handleLogout}
            destructive
            trailing={null}
          />
        </div>

        {/* Error display */}
        {error && (
          <div className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </div>
    );
  };

  const renderAccountSection = () => (
    <div className="divide-y divide-border">
      {editedProfile && (
        <>
          {/* Avatar Section */}
          <div className="p-6 flex flex-col items-center">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={editedProfile.avatar} alt={editedProfile.name} />
                <AvatarFallback>{editedProfile.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <button 
                onClick={handleAvatarClick}
                disabled={isUploadingAvatar}
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploadingAvatar ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Edit Profile Form */}
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={editedProfile.name || ''}
                onChange={(e) => handleProfileFieldChange('name', e.target.value)}
                placeholder="Your name"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={editedProfile.username || ''}
                onChange={(e) => handleProfileFieldChange('username', e.target.value)}
                placeholder="Username"
                className={validationErrors.username ? 'border-destructive' : ''}
                disabled={isSaving}
              />
              {validationErrors.username && (
                <p className="text-sm text-destructive">{validationErrors.username}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={editedProfile.bio || ''}
                onChange={(e) => handleProfileFieldChange('bio', e.target.value)}
                placeholder="A few words about yourself"
                rows={3}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={editedProfile.phone || ''}
                onChange={(e) => handleProfileFieldChange('phone', e.target.value)}
                placeholder="Phone number"
                className={validationErrors.phone ? 'border-destructive' : ''}
                disabled={isSaving}
              />
              {validationErrors.phone && (
                <p className="text-sm text-destructive">{validationErrors.phone}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={editedProfile.email || ''}
                onChange={(e) => handleProfileFieldChange('email', e.target.value)}
                placeholder="Email address"
                type="email"
                className={validationErrors.email ? 'border-destructive' : ''}
                disabled={isSaving}
              />
              {validationErrors.email && (
                <p className="text-sm text-destructive">{validationErrors.email}</p>
              )}
            </div>
            <Button 
              onClick={handleSaveProfile} 
              className="w-full"
              disabled={Object.keys(validationErrors).length > 0 || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
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
              <Select value={privacy.lastSeen} onValueChange={(v) => handleUpdatePrivacy({ lastSeen: v as PrivacySettings['lastSeen'] })} disabled={isSaving}>
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
              <Select value={privacy.profilePhoto} onValueChange={(v) => handleUpdatePrivacy({ profilePhoto: v as PrivacySettings['profilePhoto'] })} disabled={isSaving}>
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
              <Select value={privacy.calls} onValueChange={(v) => handleUpdatePrivacy({ calls: v as PrivacySettings['calls'] })} disabled={isSaving}>
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
              <Select value={privacy.groups} onValueChange={(v) => handleUpdatePrivacy({ groups: v as PrivacySettings['groups'] })} disabled={isSaving}>
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
              onCheckedChange={(checked) => handleUpdatePrivacy({ readReceipts: checked })}
              disabled={isSaving}
            />
            <ToggleItem
              title="Forwarded Message Links"
              description="Link to your account when forwarding"
              checked={privacy.forwards}
              onCheckedChange={(checked) => handleUpdatePrivacy({ forwards: checked })}
              disabled={isSaving}
            />
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Security</h3>
            <ToggleItem
              title="Two-Factor Authentication"
              description="Add an extra layer of security"
              checked={privacy.twoFactorAuth}
              onCheckedChange={(checked) => handleUpdatePrivacy({ twoFactorAuth: checked })}
              disabled={isSaving}
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
              onCheckedChange={(checked) => handleUpdateNotifications({ messageNotifications: checked })}
              disabled={isSaving}
            />
            <ToggleItem
              title="Group Notifications"
              description="Get notified for group messages"
              checked={notifications.groupNotifications}
              onCheckedChange={(checked) => handleUpdateNotifications({ groupNotifications: checked })}
              disabled={isSaving}
            />
            <ToggleItem
              title="Channel Notifications"
              description="Get notified for channel updates"
              checked={notifications.channelNotifications}
              onCheckedChange={(checked) => handleUpdateNotifications({ channelNotifications: checked })}
              disabled={isSaving}
            />
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">In-App</h3>
            <ToggleItem
              title="In-App Sounds"
              description="Play sounds while in the app"
              checked={notifications.inAppSounds}
              onCheckedChange={(checked) => handleUpdateNotifications({ inAppSounds: checked })}
              disabled={isSaving}
            />
            <ToggleItem
              title="In-App Vibration"
              description="Vibrate for notifications"
              checked={notifications.inAppVibrate}
              onCheckedChange={(checked) => handleUpdateNotifications({ inAppVibrate: checked })}
              disabled={isSaving}
            />
            <ToggleItem
              title="Message Preview"
              description="Show message content in notifications"
              checked={notifications.inAppPreview}
              onCheckedChange={(checked) => handleUpdateNotifications({ inAppPreview: checked })}
              disabled={isSaving}
            />
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Other</h3>
            <ToggleItem
              title="Contact Joined"
              description="Notify when a contact joins"
              checked={notifications.contactJoined}
              onCheckedChange={(checked) => handleUpdateNotifications({ contactJoined: checked })}
              disabled={isSaving}
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
              onCheckedChange={(checked) => handleUpdateChatSettings({ sendByEnter: checked })}
              disabled={isSaving}
            />
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Media</h3>
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Auto-Download Media</p>
                <p className="text-sm text-muted-foreground">When to download media automatically</p>
              </div>
              <Select value={chatSettings.mediaAutoDownload} onValueChange={(v) => handleUpdateChatSettings({ mediaAutoDownload: v as ChatSettings['mediaAutoDownload'] })} disabled={isSaving}>
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
              onCheckedChange={(checked) => handleUpdateChatSettings({ saveToGallery: checked })}
              disabled={isSaving}
            />
            <ToggleItem
              title="Auto-Play GIFs"
              description="Play GIFs automatically in chat"
              checked={chatSettings.autoPlayGifs}
              onCheckedChange={(checked) => handleUpdateChatSettings({ autoPlayGifs: checked })}
              disabled={isSaving}
            />
            <ToggleItem
              title="Auto-Play Videos"
              description="Play videos automatically in chat"
              checked={chatSettings.autoPlayVideos}
              onCheckedChange={(checked) => handleUpdateChatSettings({ autoPlayVideos: checked })}
              disabled={isSaving}
            />
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Voice Messages</h3>
            <ToggleItem
              title="Raise to Speak"
              description="Hold phone to ear to record"
              checked={chatSettings.raiseToSpeak}
              onCheckedChange={(checked) => handleUpdateChatSettings({ raiseToSpeak: checked })}
              disabled={isSaving}
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
          {/* Transport Connection Info */}
          <div className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Connection</h3>
            <div className="p-4 rounded-lg border border-border bg-card">
              <TransportIndicator showDetails={true} />
            </div>
          </div>

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
              <Button variant="outline" className="w-full" onClick={handleClearCache} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Cache
                  </>
                )}
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
              <Select value={dataStorage.keepMedia} onValueChange={(v) => handleUpdateDataStorage({ keepMedia: v as DataStorageSettings['keepMedia'] })} disabled={isSaving}>
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
              onCheckedChange={(checked) => handleUpdateDataStorage({ autoDownloadPhotos: checked })}
              disabled={isSaving}
            />
            <ToggleItem
              title="Videos"
              description="Automatically download videos"
              checked={dataStorage.autoDownloadVideos}
              onCheckedChange={(checked) => handleUpdateDataStorage({ autoDownloadVideos: checked })}
              disabled={isSaving}
            />
            <ToggleItem
              title="Files"
              description="Automatically download files"
              checked={dataStorage.autoDownloadFiles}
              onCheckedChange={(checked) => handleUpdateDataStorage({ autoDownloadFiles: checked })}
              disabled={isSaving}
            />
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Network</h3>
            <ToggleItem
              title="Data Saver"
              description="Reduce data usage on mobile networks"
              checked={dataStorage.dataSaver}
              onCheckedChange={(checked) => handleUpdateDataStorage({ dataSaver: checked })}
              disabled={isSaving}
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
                  onClick={() => handleUpdateAppearance({ theme: value as AppearanceSettings['theme'] })}
                  disabled={isSaving}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors",
                    themeMode === value 
                      ? "border-primary bg-primary/10" 
                      : "border-border hover:bg-accent/50",
                    isSaving && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Icon className={cn(
                    "h-6 w-6",
                    themeMode === value ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "text-sm font-medium",
                    themeMode === value ? "text-primary" : "text-foreground"
                  )}>{label}</span>
                  {themeMode === value && (
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
                  onClick={() => handleUpdateAppearance({ fontSize: value as AppearanceSettings['fontSize'] })}
                  disabled={isSaving}
                  className={cn(
                    "p-3 rounded-lg border text-center transition-colors",
                    appearance.fontSize === value 
                      ? "border-primary bg-primary/10 text-primary" 
                      : "border-border hover:bg-accent/50 text-foreground",
                    isSaving && "opacity-50 cursor-not-allowed"
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
              {colorThemes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setColorTheme(theme.id as 'default' | 'ocean' | 'forest' | 'sunset' | 'purple')}
                  disabled={isSaving}
                  className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center transition-transform hover:scale-110",
                    activeColorTheme === theme.id && "ring-2 ring-offset-2 ring-offset-background ring-foreground",
                    isSaving && "opacity-50 cursor-not-allowed"
                  )}
                  style={{ backgroundColor: theme.preview }}
                  title={theme.name}
                >
                  {activeColorTheme === theme.id && (
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
              onCheckedChange={(checked) => handleUpdateAppearance({ animationsEnabled: checked })}
              disabled={isSaving}
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
              onClick={handleTerminateAllDevices}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Terminating...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  Terminate All Other Sessions
                </>
              )}
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
                    {device.location} • {format(new Date(device.lastActive), 'MMM d, h:mm a')}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleTerminateDevice(device.id)}
                  disabled={isSaving}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
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
