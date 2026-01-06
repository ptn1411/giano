import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InviteLinkDialog } from "@/components/InviteLinkDialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Attachment, Chat, User } from "@/services/api/types";
import { useAuthStore } from "@/stores/authStore";
import { selectIsInCall, useCallStore } from "@/stores/callStore";
import {
  ArrowLeft,
  BellOff,
  Info,
  Link as LinkIcon,
  LogOut,
  Menu,
  MessageSquare,
  Mic,
  Monitor,
  MoreVertical,
  Phone,
  Pin,
  Radio,
  Search,
  Trash2,
  Video,
} from "lucide-react";
import { useState } from "react";
import { AvatarWithStatus } from "./AvatarWithStatus";
import { ContactInfoModal } from "./ContactInfoModal";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { LiveStreamModal } from "./LiveStreamModal";
import { ScreenShareModal } from "./ScreenShareModal";
import { VoiceRoomModal } from "./VoiceRoomModal";

interface ChatHeaderProps {
  chat: Chat;
  participants: User[];
  sharedMedia?: Attachment[];
  onMenuClick: () => void;
  onBack: () => void;
  onSearchClick: () => void;
  onClearChat?: () => void;
  onDeleteChat?: () => void;
  onLeaveGroup?: () => void;
  showBackButton?: boolean;
}

export function ChatHeader({
  chat,
  participants,
  sharedMedia = [],
  onMenuClick,
  onBack,
  onSearchClick,
  onClearChat,
  onDeleteChat,
  onLeaveGroup,
  showBackButton,
}: ChatHeaderProps) {
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showVoiceRoom, setShowVoiceRoom] = useState(false);
  const [showLiveStream, setShowLiveStream] = useState(false);
  const [showScreenShare, setShowScreenShare] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showInviteLink, setShowInviteLink] = useState(false);
  const currentUser = useAuthStore((state) => state.session?.user);

  // Call store integration
  const initiateCall = useCallStore((state) => state.initiateCall);
  const isInCall = useCallStore(selectIsInCall);

  // Get the other participant for private chats
  const otherParticipant =
    chat.type === "private"
      ? participants.find((p) => p.id !== currentUser?.id)
      : null;

  const isOnline =
    chat.type === "private" &&
    participants.some((p) => p.id !== currentUser?.id && p.status === "online");

  const statusText =
    chat.type === "group"
      ? `${participants.length} thành viên`
      : isOnline
      ? "đang hoạt động"
      : "ngoại tuyến";

  const handleViewInfo = () => {
    setShowContactInfo(true);
  };

  /**
   * Handle voice call initiation
   * Requirement 1.1: Voice call initiation
   */
  const handleVoiceCall = async () => {
    if (isInCall) {
      toast({
        title: "Đang trong cuộc gọi",
        description: "Vui lòng kết thúc cuộc gọi hiện tại trước",
        variant: "destructive",
      });
      return;
    }

    if (chat.type === "private" && otherParticipant) {
      console.log("[ChatHeader] Initiating voice call:", {
        userId: otherParticipant.id,
        userName: otherParticipant.name,
        chatId: chat.id,
        currentUserId: currentUser?.id,
      });
      await initiateCall(
        otherParticipant.id,
        otherParticipant.name,
        otherParticipant.avatar || "",
        chat.id,
        "voice",
        currentUser?.id || ""
      );
    } else {
      toast({
        title: "Cuộc gọi thoại",
        description: "Cuộc gọi thoại chỉ khả dụng cho chat riêng tư",
      });
    }
  };

  /**
   * Handle video call initiation
   * Requirement 1.2: Video call initiation
   */
  const handleVideoCall = async () => {
    if (isInCall) {
      toast({
        title: "Đang trong cuộc gọi",
        description: "Vui lòng kết thúc cuộc gọi hiện tại trước",
        variant: "destructive",
      });
      return;
    }

    if (chat.type === "private" && otherParticipant) {
      console.log("[ChatHeader] Initiating video call:", {
        userId: otherParticipant.id,
        userName: otherParticipant.name,
        chatId: chat.id,
        currentUserId: currentUser?.id,
      });
      await initiateCall(
        otherParticipant.id,
        otherParticipant.name,
        otherParticipant.avatar || "",
        chat.id,
        "video",
        currentUser?.id || ""
      );
    } else {
      toast({
        title: "Cuộc gọi video",
        description: "Cuộc gọi video chỉ khả dụng cho chat riêng tư",
      });
    }
  };

  const handleMuteNotifications = () => {
    toast({
      title: "Đã tắt thông báo",
      description: `Bạn sẽ không nhận thông báo từ ${chat.name}`,
    });
  };

  const handlePinChat = () => {
    toast({
      title: "Đã ghim cuộc trò chuyện",
      description: `${chat.name} đã được ghim lên đầu`,
    });
  };

  const handleClearChat = () => {
    setShowClearConfirm(true);
  };

  const handleConfirmClear = () => {
    setShowClearConfirm(false);
    if (onClearChat) {
      onClearChat();
    }
    toast({
      title: "Đã xóa tin nhắn",
      description: "Tất cả tin nhắn đã được xóa",
    });
  };

  const handleDeleteChat = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    setShowDeleteConfirm(false);
    if (onDeleteChat) {
      onDeleteChat();
    }
    toast({
      title: "Đã xóa cuộc trò chuyện",
      description: `${chat.name} đã bị xóa`,
      variant: "destructive",
    });
  };

  const handleLeaveGroup = () => {
    setShowLeaveConfirm(true);
  };

  const handleConfirmLeave = () => {
    setShowLeaveConfirm(false);
    if (onLeaveGroup) {
      onLeaveGroup();
    }
    toast({
      title: "Đã rời nhóm",
      description: `Bạn đã rời khỏi ${chat.name}`,
    });
  };

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        {showBackButton && (
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent lg:hidden">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}

        <button
          onClick={onMenuClick}
          className="hidden h-9 w-9 items-center justify-center rounded-full hover:bg-accent lg:flex">
          <Menu className="h-5 w-5" />
        </button>

        <AvatarWithStatus
          src={chat.avatar}
          alt={chat.name}
          status={
            chat.type === "private"
              ? isOnline
                ? "online"
                : "offline"
              : undefined
          }
          size="md"
        />

        <div>
          <h2 className="font-semibold text-foreground">{chat.name}</h2>
          <p
            className={cn(
              "text-xs",
              chat.isTyping ? "text-primary" : "text-muted-foreground"
            )}>
            {chat.isTyping
              ? `${chat.typingUser || "Ai đó"} đang nhập...`
              : statusText}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onSearchClick}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent text-foreground"
          title="Tìm kiếm tin nhắn">
          <Search className="h-5 w-5" />
        </button>
        <button
          onClick={handleVoiceCall}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent text-foreground"
          title="Gọi thoại">
          <Phone className="h-5 w-5" />
        </button>
        <button
          onClick={handleVideoCall}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent text-foreground"
          title="Gọi video">
          <Video className="h-5 w-5" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent text-foreground">
              <MoreVertical className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 bg-card border-border">
            <DropdownMenuItem
              onClick={handleViewInfo}
              className="gap-3 cursor-pointer">
              <Info className="h-4 w-4" />
              <span>
                {chat.type === "group" ? "Thông tin nhóm" : "Xem liên hệ"}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onSearchClick}
              className="gap-3 cursor-pointer">
              <Search className="h-4 w-4" />
              <span>Tìm trong cuộc trò chuyện</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />

            {/* Call & Stream Options */}
            <DropdownMenuItem
              onClick={handleVoiceCall}
              className="gap-3 cursor-pointer">
              <Phone className="h-4 w-4" />
              <span>Gọi thoại</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleVideoCall}
              className="gap-3 cursor-pointer">
              <Video className="h-4 w-4" />
              <span>Gọi video</span>
            </DropdownMenuItem>
            {chat.type === "group" && (
              <>
                <DropdownMenuItem
                  onClick={() => setShowVoiceRoom(true)}
                  className="gap-3 cursor-pointer">
                  <Mic className="h-4 w-4" />
                  <span>Tạo phòng thoại</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowLiveStream(true)}
                  className="gap-3 cursor-pointer">
                  <Radio className="h-4 w-4" />
                  <span>Phát trực tiếp</span>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem
              onClick={() => setShowScreenShare(true)}
              className="gap-3 cursor-pointer">
              <Monitor className="h-4 w-4" />
              <span>Chia sẻ màn hình</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleMuteNotifications}
              className="gap-3 cursor-pointer">
              <BellOff className="h-4 w-4" />
              <span>Tắt thông báo</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handlePinChat}
              className="gap-3 cursor-pointer">
              <Pin className="h-4 w-4" />
              <span>Ghim cuộc trò chuyện</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowInviteLink(true)}
              className="gap-3 cursor-pointer">
              <LinkIcon className="h-4 w-4" />
              <span>
                {chat.type === "group" ? "Tạo link mời" : "Chia sẻ link hồ sơ"}
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleClearChat}
              className="gap-3 cursor-pointer">
              <MessageSquare className="h-4 w-4" />
              <span>Xóa tin nhắn</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDeleteChat}
              className="gap-3 cursor-pointer text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4" />
              <span>Xóa cuộc trò chuyện</span>
            </DropdownMenuItem>
            {chat.type === "group" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLeaveGroup}
                  className="gap-3 cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" />
                  <span>Rời nhóm</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Modals */}
      <ContactInfoModal
        open={showContactInfo}
        onOpenChange={setShowContactInfo}
        chat={chat}
        participants={participants}
        sharedMedia={sharedMedia}
      />

      <InviteLinkDialog
        open={showInviteLink}
        onOpenChange={setShowInviteLink}
        type={chat.type === "group" ? "group" : "direct"}
        chatId={chat.type === "group" ? chat.id : undefined}
        chatName={chat.name}
      />

      {chat.type === "group" && (
        <>
          <VoiceRoomModal
            open={showVoiceRoom}
            onOpenChange={setShowVoiceRoom}
            roomName={`${chat.name} Voice Room`}
            participants={participants}
          />

          <LiveStreamModal
            open={showLiveStream}
            onOpenChange={setShowLiveStream}
            isHost={true}
            streamTitle={`Live in ${chat.name}`}
            hostName={currentUser?.name || "You"}
            hostAvatar={
              currentUser?.avatar ||
              "https://api.dicebear.com/7.x/avataaars/svg?seed=You"
            }
          />
        </>
      )}

      <ScreenShareModal
        open={showScreenShare}
        onOpenChange={setShowScreenShare}
        isSharing={isScreenSharing}
        sharerName={currentUser?.name || "You"}
        sharerAvatar={
          currentUser?.avatar ||
          "https://api.dicebear.com/7.x/avataaars/svg?seed=You"
        }
        onStartSharing={() => setIsScreenSharing(true)}
        onStopSharing={() => setIsScreenSharing(false)}
      />

      {/* Confirm Modals */}
      <DeleteConfirmModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleConfirmClear}
        messagePreview={`Clear all messages in "${chat.name}"?`}
      />

      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        messagePreview={`Delete chat "${chat.name}"?`}
      />

      {chat.type === "group" && (
        <DeleteConfirmModal
          isOpen={showLeaveConfirm}
          onClose={() => setShowLeaveConfirm(false)}
          onConfirm={handleConfirmLeave}
          messagePreview={`Leave group "${chat.name}"?`}
        />
      )}
    </header>
  );
}
