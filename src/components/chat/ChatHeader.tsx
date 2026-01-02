import { Menu, Phone, Video, MoreVertical, ArrowLeft, Search } from "lucide-react";
import { Chat, User } from "@/services/mockData";
import { AvatarWithStatus } from "./AvatarWithStatus";
import { cn } from "@/lib/utils";

interface ChatHeaderProps {
  chat: Chat;
  participants: User[];
  onMenuClick: () => void;
  onBack: () => void;
  onSearchClick: () => void;
  showBackButton?: boolean;
}

export function ChatHeader({
  chat,
  participants,
  onMenuClick,
  onBack,
  onSearchClick,
  showBackButton,
}: ChatHeaderProps) {
  const isOnline = chat.type === 'private' && participants.some(
    (p) => p.id !== 'user-1' && p.status === 'online'
  );

  const statusText = chat.type === 'group'
    ? `${participants.length} members`
    : isOnline
    ? 'online'
    : 'offline';

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        {showBackButton && (
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent lg:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        
        <button
          onClick={onMenuClick}
          className="hidden h-9 w-9 items-center justify-center rounded-full hover:bg-accent lg:flex"
        >
          <Menu className="h-5 w-5" />
        </button>

        <AvatarWithStatus
          src={chat.avatar}
          alt={chat.name}
          status={chat.type === 'private' ? (isOnline ? 'online' : 'offline') : undefined}
          size="md"
        />

        <div>
          <h2 className="font-semibold text-foreground">{chat.name}</h2>
          <p className={cn(
            "text-xs",
            chat.isTyping ? "text-primary" : "text-muted-foreground"
          )}>
            {chat.isTyping
              ? `${chat.typingUser || 'Someone'} is typing...`
              : statusText}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button 
          onClick={onSearchClick}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent text-foreground"
          title="Search messages"
        >
          <Search className="h-5 w-5" />
        </button>
        <button className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent text-foreground">
          <Phone className="h-5 w-5" />
        </button>
        <button className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent text-foreground">
          <Video className="h-5 w-5" />
        </button>
        <button className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent text-foreground">
          <MoreVertical className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
