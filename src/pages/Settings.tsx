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
  Link as LinkIcon,
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
import { InviteLinksSettings } from "@/components/settings/InviteLinksSettings";
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
  | 'devices'
  | 'inviteLinks';

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
        title: 'Lỗi xác thực',
        description: 'Vui lòng sửa các lỗi trước khi lưu',
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
        toast({ title: 'Đã cập nhật hồ sơ', description: 'Thay đổi của bạn đã được lưu' });
      } catch (error) {
        console.error('Profile update error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Không thể cập nhật hồ sơ';
        toast({ 
          title: 'Lỗi', 
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
      toast({ title: 'Đã lưu cài đặt' });
    } catch (error) {
      console.error('Privacy update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Không thể cập nhật cài đặt quyền riêng tư';
      toast({ 
        title: 'Lỗi', 
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
      toast({ title: 'Đã lưu cài đặt' });
    } catch (error) {
      console.error('Notifications update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Không thể cập nhật cài đặt thông báo';
      toast({ 
        title: 'Lỗi', 
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
      toast({ title: 'Đã lưu cài đặt' });
    } catch (error) {
      console.error('Chat settings update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Không thể cập nhật cài đặt chat';
      toast({ 
        title: 'Lỗi', 
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
      toast({ title: 'Đã lưu cài đặt' });
    } catch (error) {
      console.error('Data storage update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Không thể cập nhật cài đặt lưu trữ';
      toast({ 
        title: 'Lỗi', 
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
      toast({ title: 'Đã lưu cài đặt' });
    } catch (error) {
      console.error('Appearance update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Không thể cập nhật cài đặt giao diện';
      toast({ 
        title: 'Lỗi', 
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
      toast({ title: 'Đã xóa bộ nhớ đệm', description: 'Tất cả dữ liệu đệm đã được xóa' });
    } catch (error) {
      console.error('Cache clear error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Không thể xóa bộ nhớ đệm';
      toast({ 
        title: 'Lỗi', 
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
      toast({ title: 'Đã kết thúc phiên' });
    } catch (error) {
      console.error('Device termination error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Không thể kết thúc phiên';
      toast({ 
        title: 'Lỗi', 
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
      toast({ title: 'Đã kết thúc tất cả phiên khác' });
    } catch (error) {
      console.error('Terminate all devices error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Không thể kết thúc các phiên';
      toast({ 
        title: 'Lỗi', 
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
      case 'main': return 'Cài đặt';
      case 'account': return 'Tài khoản & Hồ sơ';
      case 'privacy': return 'Quyền riêng tư & Bảo mật';
      case 'notifications': return 'Thông báo';
      case 'chat': return 'Cài đặt Chat';
      case 'data': return 'Dữ liệu & Lưu trữ';
      case 'appearance': return 'Giao diện';
      case 'devices': return 'Thiết bị & Phiên';
      case 'inviteLinks': return 'Link mời';
    }
  };

  const handleLogout = async () => {
    await logout();
    toast({ 
      title: 'Đã đăng xuất', 
      description: 'Bạn đã đăng xuất thành công' 
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
      return 'Tên người dùng là bắt buộc';
    }
    if (username.length < 3) {
      return 'Tên người dùng phải có ít nhất 3 ký tự';
    }
    if (username.length > 32) {
      return 'Tên người dùng phải ít hơn 32 ký tự';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return 'Tên người dùng chỉ được chứa chữ cái, số và dấu gạch dưới';
    }
    return undefined;
  };

  const validateEmail = (email: string): string | undefined => {
    if (!email) {
      return undefined; // Email is optional
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Vui lòng nhập địa chỉ email hợp lệ';
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
      return 'Vui lòng nhập số điện thoại hợp lệ';
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
            title="Tài khoản & Hồ sơ"
            description="Chỉnh sửa hồ sơ, tên người dùng, tiểu sử"
            onClick={() => setSection('account')}
          />
          <SettingItem
            icon={<Shield className="h-5 w-5 text-primary" />}
            title="Quyền riêng tư & Bảo mật"
            description="Trạng thái hoạt động, xác nhận đã đọc, 2FA"
            onClick={() => setSection('privacy')}
          />
          <SettingItem
            icon={<Bell className="h-5 w-5 text-primary" />}
            title="Thông báo"
            description="Tin nhắn, nhóm, cài đặt âm thanh"
            onClick={() => setSection('notifications')}
          />
          <SettingItem
            icon={<MessageSquare className="h-5 w-5 text-primary" />}
            title="Cài đặt Chat"
            description="Media, bàn phím, nút gửi"
            onClick={() => setSection('chat')}
          />
          <SettingItem
            icon={<Database className="h-5 w-5 text-primary" />}
            title="Dữ liệu & Lưu trữ"
            description="Dung lượng, tự động tải xuống"
            onClick={() => setSection('data')}
          />
          <SettingItem
            icon={<Palette className="h-5 w-5 text-primary" />}
            title="Giao diện"
            description="Chủ đề, màu sắc, cỡ chữ"
            onClick={() => setSection('appearance')}
          />
          <SettingItem
            icon={<LinkIcon className="h-5 w-5 text-primary" />}
            title="Link mời"
            description="Quản lý link mời nhóm và chat"
            onClick={() => setSection('inviteLinks')}
          />
          <SettingItem
            icon={<Smartphone className="h-5 w-5 text-primary" />}
            title="Thiết bị & Phiên"
            description={`${devices.length} phiên đang hoạt động`}
            onClick={() => setSection('devices')}
          />
        </div>

        {/* Logout Button */}
        <div className="py-2">
          <SettingItem
            icon={<LogOut className="h-5 w-5 text-destructive" />}
            title="Đăng xuất"
            description="Đăng xuất khỏi tài khoản"
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
              <Label htmlFor="name">Tên</Label>
              <Input
                id="name"
                value={editedProfile.name || ''}
                onChange={(e) => handleProfileFieldChange('name', e.target.value)}
                placeholder="Tên của bạn"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Tên người dùng</Label>
              <Input
                id="username"
                value={editedProfile.username || ''}
                onChange={(e) => handleProfileFieldChange('username', e.target.value)}
                placeholder="Tên người dùng"
                className={validationErrors.username ? 'border-destructive' : ''}
                disabled={isSaving}
              />
              {validationErrors.username && (
                <p className="text-sm text-destructive">{validationErrors.username}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Tiểu sử</Label>
              <Textarea
                id="bio"
                value={editedProfile.bio || ''}
                onChange={(e) => handleProfileFieldChange('bio', e.target.value)}
                placeholder="Vài dòng về bạn"
                rows={3}
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Số điện thoại</Label>
              <Input
                id="phone"
                value={editedProfile.phone || ''}
                onChange={(e) => handleProfileFieldChange('phone', e.target.value)}
                placeholder="Số điện thoại"
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
                placeholder="Địa chỉ email"
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
                  Đang lưu...
                </>
              ) : (
                'Lưu thay đổi'
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
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Ai có thể xem...</h3>
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Trạng thái hoạt động</p>
                <p className="text-sm text-muted-foreground">Ai có thể xem khi bạn online</p>
              </div>
              <Select value={privacy.lastSeen} onValueChange={(v) => handleUpdatePrivacy({ lastSeen: v as PrivacySettings['lastSeen'] })} disabled={isSaving}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone">Tất cả</SelectItem>
                  <SelectItem value="contacts">Danh bạ</SelectItem>
                  <SelectItem value="nobody">Không ai</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Ảnh đại diện</p>
                <p className="text-sm text-muted-foreground">Ai có thể xem ảnh đại diện của bạn</p>
              </div>
              <Select value={privacy.profilePhoto} onValueChange={(v) => handleUpdatePrivacy({ profilePhoto: v as PrivacySettings['profilePhoto'] })} disabled={isSaving}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone">Tất cả</SelectItem>
                  <SelectItem value="contacts">Danh bạ</SelectItem>
                  <SelectItem value="nobody">Không ai</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Cuộc gọi</p>
                <p className="text-sm text-muted-foreground">Ai có thể gọi cho bạn</p>
              </div>
              <Select value={privacy.calls} onValueChange={(v) => handleUpdatePrivacy({ calls: v as PrivacySettings['calls'] })} disabled={isSaving}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone">Tất cả</SelectItem>
                  <SelectItem value="contacts">Danh bạ</SelectItem>
                  <SelectItem value="nobody">Không ai</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Nhóm</p>
                <p className="text-sm text-muted-foreground">Ai có thể thêm bạn vào nhóm</p>
              </div>
              <Select value={privacy.groups} onValueChange={(v) => handleUpdatePrivacy({ groups: v as PrivacySettings['groups'] })} disabled={isSaving}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone">Tất cả</SelectItem>
                  <SelectItem value="contacts">Danh bạ</SelectItem>
                  <SelectItem value="nobody">Không ai</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Tin nhắn</h3>
            <ToggleItem
              title="Xác nhận đã đọc"
              description="Hiển thị khi bạn đã đọc tin nhắn"
              checked={privacy.readReceipts}
              onCheckedChange={(checked) => handleUpdatePrivacy({ readReceipts: checked })}
              disabled={isSaving}
            />
            <ToggleItem
              title="Link tin nhắn chuyển tiếp"
              description="Liên kết đến tài khoản khi chuyển tiếp"
              checked={privacy.forwards}
              onCheckedChange={(checked) => handleUpdatePrivacy({ forwards: checked })}
              disabled={isSaving}
            />
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Bảo mật</h3>
            <ToggleItem
              title="Xác thực hai yếu tố"
              description="Thêm lớp bảo mật bổ sung"
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
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Thông báo</h3>
            <ToggleItem
              title="Thông báo tin nhắn"
              description="Nhận thông báo khi có tin nhắn mới"
              checked={notifications.messageNotifications}
              onCheckedChange={(checked) => handleUpdateNotifications({ messageNotifications: checked })}
              disabled={isSaving}
            />
            <ToggleItem
              title="Thông báo nhóm"
              description="Nhận thông báo tin nhắn nhóm"
              checked={notifications.groupNotifications}
              onCheckedChange={(checked) => handleUpdateNotifications({ groupNotifications: checked })}
              disabled={isSaving}
            />
            <ToggleItem
              title="Thông báo kênh"
              description="Nhận thông báo cập nhật kênh"
              checked={notifications.channelNotifications}
              onCheckedChange={(checked) => handleUpdateNotifications({ channelNotifications: checked })}
              disabled={isSaving}
            />
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Trong ứng dụng</h3>
            <ToggleItem
              title="Âm thanh trong ứng dụng"
              description="Phát âm thanh khi đang dùng ứng dụng"
              checked={notifications.inAppSounds}
              onCheckedChange={(checked) => handleUpdateNotifications({ inAppSounds: checked })}
              disabled={isSaving}
            />
            <ToggleItem
              title="Rung trong ứng dụng"
              description="Rung khi có thông báo"
              checked={notifications.inAppVibrate}
              onCheckedChange={(checked) => handleUpdateNotifications({ inAppVibrate: checked })}
              disabled={isSaving}
            />
            <ToggleItem
              title="Xem trước tin nhắn"
              description="Hiển thị nội dung tin nhắn trong thông báo"
              checked={notifications.inAppPreview}
              onCheckedChange={(checked) => handleUpdateNotifications({ inAppPreview: checked })}
              disabled={isSaving}
            />
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Khác</h3>
            <ToggleItem
              title="Liên hệ tham gia"
              description="Thông báo khi liên hệ tham gia"
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
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Bàn phím</h3>
            <ToggleItem
              title="Gửi bằng Enter"
              description="Nhấn Enter để gửi tin nhắn"
              checked={chatSettings.sendByEnter}
              onCheckedChange={(checked) => handleUpdateChatSettings({ sendByEnter: checked })}
              disabled={isSaving}
            />
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Media</h3>
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Tự động tải Media</p>
                <p className="text-sm text-muted-foreground">Khi nào tự động tải media</p>
              </div>
              <Select value={chatSettings.mediaAutoDownload} onValueChange={(v) => handleUpdateChatSettings({ mediaAutoDownload: v as ChatSettings['mediaAutoDownload'] })} disabled={isSaving}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wifi">Chỉ Wi-Fi</SelectItem>
                  <SelectItem value="always">Luôn luôn</SelectItem>
                  <SelectItem value="never">Không bao giờ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ToggleItem
              title="Lưu vào Thư viện"
              description="Tự động lưu media vào thư viện"
              checked={chatSettings.saveToGallery}
              onCheckedChange={(checked) => handleUpdateChatSettings({ saveToGallery: checked })}
              disabled={isSaving}
            />
            <ToggleItem
              title="Tự động phát GIF"
              description="Phát GIF tự động trong chat"
              checked={chatSettings.autoPlayGifs}
              onCheckedChange={(checked) => handleUpdateChatSettings({ autoPlayGifs: checked })}
              disabled={isSaving}
            />
            <ToggleItem
              title="Tự động phát Video"
              description="Phát video tự động trong chat"
              checked={chatSettings.autoPlayVideos}
              onCheckedChange={(checked) => handleUpdateChatSettings({ autoPlayVideos: checked })}
              disabled={isSaving}
            />
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Tin nhắn thoại</h3>
            <ToggleItem
              title="Giơ lên để nói"
              description="Giữ điện thoại sát tai để ghi âm"
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
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Kết nối</h3>
            <div className="p-4 rounded-lg border border-border bg-card">
              <TransportIndicator showDetails={true} />
            </div>
          </div>

          <div className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Dung lượng lưu trữ</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-foreground">Đã sử dụng</span>
                <span className="text-muted-foreground">{(dataStorage.storageUsed / 1024).toFixed(2)} GB</span>
              </div>
              <Progress value={(dataStorage.storageUsed / 5000) * 100} className="h-2" />
              <div className="flex justify-between text-sm">
                <span className="text-foreground">Bộ nhớ đệm</span>
                <span className="text-muted-foreground">{dataStorage.cacheSize} MB</span>
              </div>
              <Button variant="outline" className="w-full" onClick={handleClearCache} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang xóa...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Xóa bộ nhớ đệm
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Lưu giữ Media</h3>
            <div className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Giữ Media</p>
                <p className="text-sm text-muted-foreground">Thời gian giữ media đã tải</p>
              </div>
              <Select value={dataStorage.keepMedia} onValueChange={(v) => handleUpdateDataStorage({ keepMedia: v as DataStorageSettings['keepMedia'] })} disabled={isSaving}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1week">1 tuần</SelectItem>
                  <SelectItem value="1month">1 tháng</SelectItem>
                  <SelectItem value="3months">3 tháng</SelectItem>
                  <SelectItem value="forever">Mãi mãi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Tự động tải</h3>
            <ToggleItem
              title="Ảnh"
              description="Tự động tải ảnh"
              checked={dataStorage.autoDownloadPhotos}
              onCheckedChange={(checked) => handleUpdateDataStorage({ autoDownloadPhotos: checked })}
              disabled={isSaving}
            />
            <ToggleItem
              title="Video"
              description="Tự động tải video"
              checked={dataStorage.autoDownloadVideos}
              onCheckedChange={(checked) => handleUpdateDataStorage({ autoDownloadVideos: checked })}
              disabled={isSaving}
            />
            <ToggleItem
              title="Tệp"
              description="Tự động tải tệp"
              checked={dataStorage.autoDownloadFiles}
              onCheckedChange={(checked) => handleUpdateDataStorage({ autoDownloadFiles: checked })}
              disabled={isSaving}
            />
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Mạng</h3>
            <ToggleItem
              title="Tiết kiệm dữ liệu"
              description="Giảm sử dụng dữ liệu trên mạng di động"
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
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Chủ đề</h3>
            <div className="px-4 py-3 grid grid-cols-3 gap-3">
              {[
                { value: 'light', icon: Sun, label: 'Sáng' },
                { value: 'dark', icon: Moon, label: 'Tối' },
                { value: 'system', icon: Monitor, label: 'Hệ thống' },
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
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Cỡ chữ</h3>
            <div className="px-4 py-3 grid grid-cols-3 gap-3">
              {[
                { value: 'small', label: 'Nhỏ' },
                { value: 'medium', label: 'Vừa' },
                { value: 'large', label: 'Lớn' },
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
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Màu nhấn</h3>
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
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Khác</h3>
            <ToggleItem
              title="Hiệu ứng"
              description="Bật hiệu ứng mượt mà"
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
            <p className="font-medium text-foreground">Thiết bị này</p>
            <p className="text-sm text-muted-foreground">
              {devices.find(d => d.isCurrent)?.name || 'Phiên hiện tại'}
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
                  Đang kết thúc...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  Kết thúc tất cả phiên khác
                </>
              )}
            </Button>
          </div>

          <div className="py-2">
            <h3 className="px-4 py-2 text-sm font-medium text-muted-foreground">Các phiên khác</h3>
            {devices.filter(d => !d.isCurrent).map((device) => (
              <div key={device.id} className="px-4 py-3 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent">
                  {getDeviceIcon(device.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{device.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {device.location} • {format(new Date(device.lastActive), 'dd/MM, HH:mm')}
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
          <p className="font-medium text-foreground">Không có phiên khác</p>
          <p className="text-sm text-muted-foreground">Bạn chỉ đăng nhập trên thiết bị này</p>
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
      case 'inviteLinks': return <div className="p-4"><InviteLinksSettings /></div>;
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
