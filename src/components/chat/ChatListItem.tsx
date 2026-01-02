import { formatDistanceToNow } from "date-fns";
import { Chat } from "@/services/mockData";
import { AvatarWithStatus } from "./AvatarWithStatus";
import { cn } from "@/lib/utils";

interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
}

export function ChatListItem({ chat, isActive, onClick }: ChatListItemProps) {
  const lastMessageTime = chat.lastMessage?.timestamp
    ? formatDistanceToNow(new Date(chat.lastMessage.timestamp), { addSuffix: false })
    : '';

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3 transition-colors",
        "hover:bg-accent/50",
        isActive && "bg-primary/10"
      )}
    >
      <AvatarWithStatus
        src={chat.avatar}
        alt={chat.name}
        status={chat.type === 'private' ? 'online' : undefined}
        size="lg"
      />
      
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-foreground truncate">
            {chat.name}
          </span>
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
  );
}
