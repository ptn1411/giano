import { Menu, Phone, Video, MoreVertical, ArrowLeft, Search, Info, BellOff, Pin, Trash2, LogOut, MessageSquare } from "lucide-react";
import { Chat, User } from "@/services/mockData";
import { AvatarWithStatus } from "./AvatarWithStatus";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

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

  const handleViewInfo = () => {
    toast({
      title: chat.type === 'group' ? 'Group Info' : 'Contact Info',
      description: `Viewing info for ${chat.name}`,
    });
  };

  const handleMuteNotifications = () => {
    toast({
      title: 'Notifications muted',
      description: `You won't receive notifications from ${chat.name}`,
    });
  };

  const handlePinChat = () => {
    toast({
      title: 'Chat pinned',
      description: `${chat.name} has been pinned to the top`,
    });
  };

  const handleClearChat = () => {
    toast({
      title: 'Chat cleared',
      description: 'All messages have been cleared',
    });
  };

  const handleDeleteChat = () => {
    toast({
      title: 'Chat deleted',
      description: `${chat.name} has been deleted`,
      variant: 'destructive',
    });
  };

  const handleLeaveGroup = () => {
    toast({
      title: 'Left group',
      description: `You have left ${chat.name}`,
    });
  };

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
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent text-foreground">
              <MoreVertical className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-card border-border">
            <DropdownMenuItem onClick={handleViewInfo} className="gap-3 cursor-pointer">
              <Info className="h-4 w-4" />
              <span>{chat.type === 'group' ? 'Group info' : 'View contact'}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSearchClick} className="gap-3 cursor-pointer">
              <Search className="h-4 w-4" />
              <span>Search in conversation</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleMuteNotifications} className="gap-3 cursor-pointer">
              <BellOff className="h-4 w-4" />
              <span>Mute notifications</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePinChat} className="gap-3 cursor-pointer">
              <Pin className="h-4 w-4" />
              <span>Pin chat</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleClearChat} className="gap-3 cursor-pointer">
              <MessageSquare className="h-4 w-4" />
              <span>Clear chat</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDeleteChat} className="gap-3 cursor-pointer text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4" />
              <span>Delete chat</span>
            </DropdownMenuItem>
            {chat.type === 'group' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLeaveGroup} className="gap-3 cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" />
                  <span>Leave group</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
