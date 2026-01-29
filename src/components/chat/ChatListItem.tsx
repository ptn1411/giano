import { formatDistanceToNow } from "date-fns";
import { Bot, Crown, Pin, MoreVertical } from "lucide-react";
import { Chat, User } from "@/services/api/types";
import { AvatarWithStatus } from "./AvatarWithStatus";
import { cn } from "@/lib/utils";
import { isBotFatherChat } from "@/lib/botfather";
import { useChatsStore } from "@/stores/chatsStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatListItemProps {
  chat: Chat;
  users: User[];
  currentUserId?: string;
  isActive: boolean;
  onClick: () => void;
}

export function ChatListItem({ chat, users, currentUserId, isActive, onClick }: ChatListItemProps) {
  const pinChat = useChatsStore((state) => state.pinChat);
  const unpinChat = useChatsStore((state) => state.unpinChat);
  
  const lastMessageTime = chat.lastMessage?.timestamp
    ? formatDistanceToNow(new Date(chat.lastMessage.timestamp), { addSuffix: false })
    : '';

  const isBotFather = isBotFatherChat(chat.id);

  const handlePinToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (chat.isPinned) {
      await unpinChat(chat.id);
    } else {
      await pinChat(chat.id);
    }
  };

  // Get the other participant's status for private chats
  const getParticipantStatus = (): 'online' | 'offline' | 'away' | undefined => {
    // Bots are always online
    if (chat.isBot || isBotFather) {
      return 'online';
    }
    
    // For private chats, find the other participant
    if (chat.type === 'private' && currentUserId) {
      const otherParticipantId = chat.participants.find(id => id !== currentUserId);
      if (otherParticipantId) {
        const otherUser = users.find(u => u.id === otherParticipantId);
        return otherUser?.status;
      }
    }
    
    // For groups, don't show status
    return undefined;
  };

  const participantStatus = getParticipantStatus();

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3 transition-colors",
          "hover:bg-accent/50",
          isActive && "bg-primary/10",
          isBotFather && "bg-gradient-to-r from-primary/5 to-transparent"
        )}
      >
        <AvatarWithStatus
          src={chat.avatar}
          alt={chat.name}
          status={participantStatus}
          size="lg"
        />
        
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {chat.isPinned && (
                <Pin className="h-3.5 w-3.5 text-primary shrink-0" />
              )}
              <span className={cn(
                "font-semibold truncate",
                isBotFather ? "text-primary" : "text-foreground"
              )}>
                {chat.name}
              </span>
              {isBotFather ? (
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-medium shrink-0">
                  <Crown className="h-3 w-3" />
                  OFFICIAL
                </span>
              ) : chat.isBot && (
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium shrink-0">
                  <Bot className="h-3 w-3" />
                  BOT
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {lastMessageTime}
            </span>
          </div>
          
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-sm text-muted-foreground truncate">
              {chat.isTyping ? (
                <span className="text-primary italic">
                  {chat.typingUser ? `${chat.typingUser} is typing...` : 'typing...'}
                </span>
              ) : isBotFather ? (
                'Create and manage your bots'
              ) : (
                chat.lastMessage?.text || 'No messages yet'
              )}
            </p>
            
            {chat.unreadCount > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Context Menu */}
      {!isBotFather && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-full hover:bg-accent transition-colors"
              >
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handlePinToggle}>
                <Pin className="h-4 w-4 mr-2" />
                {chat.isPinned ? 'Bỏ ghim' : 'Ghim cuộc trò chuyện'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
