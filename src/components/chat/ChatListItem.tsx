import { formatDistanceToNow } from "date-fns";
import { Bot, Crown } from "lucide-react";
import { Chat } from "@/services/api/types";
import { AvatarWithStatus } from "./AvatarWithStatus";
import { cn } from "@/lib/utils";
import { isBotFatherChat } from "@/lib/botfather";

interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
}

export function ChatListItem({ chat, isActive, onClick }: ChatListItemProps) {
  const lastMessageTime = chat.lastMessage?.timestamp
    ? formatDistanceToNow(new Date(chat.lastMessage.timestamp), { addSuffix: false })
    : '';

  const isBotFather = isBotFatherChat(chat.id);

  return (
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
        status={chat.type === 'private' ? 'online' : chat.isBot ? 'online' : undefined}
        size="lg"
      />
      
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
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
  );
}
