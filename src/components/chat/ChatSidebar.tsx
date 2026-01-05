import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Settings } from "lucide-react";
import { Chat as ApiChat, User as ApiUser } from "@/services/api/types";
import { AvatarWithStatus } from "./AvatarWithStatus";
import { ThemeToggle } from "./ThemeToggle";
import { SearchBar } from "./SearchBar";
import { ChatListItem } from "./ChatListItem";
import { ChatListSkeleton } from "./ChatListSkeleton";
import { cn } from "@/lib/utils";

interface ChatSidebarProps {
  chats: ApiChat[];
  users: ApiUser[];
  currentUser: { id: string; name: string; avatar: string; status: 'online' | 'offline' | 'away' } | null;
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onSearch: (query: string) => void;
  onNewChat: () => void;
  isOpen: boolean;
  onToggle: () => void;
  loading?: boolean;
}

export function ChatSidebar({
  chats,
  users,
  currentUser,
  activeChatId,
  onSelectChat,
  onSearch,
  onNewChat,
  isOpen,
  onToggle,
  loading,
}: ChatSidebarProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearch(query);
  };

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-full flex-col border-r border-border bg-card transition-transform duration-300 sm:w-80 lg:relative lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onToggle}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            {currentUser && (
              <div className="flex items-center gap-3">
                <AvatarWithStatus
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  status={currentUser.status}
                  size="md"
                />
                <div>
                  <p className="font-semibold text-foreground">{currentUser.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{currentUser.status}</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button 
              onClick={handleSettingsClick}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent text-foreground"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Search */}
        <div className="p-4">
          <SearchBar
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Search chats..."
          />
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <ChatListSkeleton />
          ) : chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center animate-fade-in">
              <p className="text-muted-foreground">No chats found</p>
              <button
                onClick={onNewChat}
                className="mt-2 text-sm text-primary hover:underline"
              >
                Start a new chat
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {chats.map((chat, index) => (
                <div 
                  key={chat.id} 
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <ChatListItem
                    chat={chat}
                    users={users}
                    currentUserId={currentUser?.id}
                    isActive={chat.id === activeChatId}
                    onClick={() => onSelectChat(chat.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
