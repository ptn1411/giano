import { useState } from "react";
import { Search, X, Loader2, Mail, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { usersService } from "@/services/api/users";
import { chatsService } from "@/services/api/chats";
import { useChatsStore } from "@/stores/chatsStore";
import { User } from "@/services/api/types";

interface SearchUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChatCreated: (chatId: string) => void;
}

export function SearchUserModal({ isOpen, onClose, onChatCreated }: SearchUserModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [creatingChat, setCreatingChat] = useState(false);
  
  const addChat = useChatsStore((state) => state.addChat);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError("Please enter a username or email");
      return;
    }

    setLoading(true);
    setError(null);
    setFoundUser(null);

    // Try to search by email first if it looks like an email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmail = emailRegex.test(searchQuery.trim());
    
    let result;
    if (isEmail) {
      result = await usersService.searchByEmail(searchQuery.trim());
    } else {
      // Search by username
      result = await usersService.searchByUsername(searchQuery.trim());
    }
    
    setLoading(false);
    
    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.user) {
      setFoundUser(result.user);
    }
  };

  const handleStartChat = async () => {
    if (!foundUser) return;

    setCreatingChat(true);
    
    const result = await chatsService.createPrivateChat(foundUser);
    
    setCreatingChat(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.chat) {
      addChat(result.chat);
      onChatCreated(result.chat.id);
      handleClose();
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    setError(null);
    setFoundUser(null);
    setLoading(false);
    setCreatingChat(false);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      handleSearch();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-card rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Find User</h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-accent transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Search Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Search by Username or Email
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setError(null);
                  setFoundUser(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Enter username or email..."
                className={cn(
                  "w-full pl-10 pr-4 py-3 rounded-xl border bg-background",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50",
                  "placeholder:text-muted-foreground",
                  error ? "border-destructive" : "border-border"
                )}
                autoFocus
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={loading || !searchQuery.trim()}
            className={cn(
              "w-full py-3 rounded-xl font-medium transition-all",
              "bg-primary text-primary-foreground",
              "hover:bg-primary/90",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "flex items-center justify-center gap-2"
            )}
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="h-5 w-5" />
                Search
              </>
            )}
          </button>

          {/* Found User */}
          {foundUser && (
            <div className="mt-4 p-4 rounded-xl bg-accent/50 border border-border">
              <div className="flex items-center gap-3">
                <img
                  src={foundUser.avatar}
                  alt={foundUser.name}
                  className="h-12 w-12 rounded-full object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {foundUser.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {foundUser.status === 'online' ? (
                      <span className="text-green-500">Online</span>
                    ) : (
                      'Offline'
                    )}
                  </p>
                </div>
                <button
                  onClick={handleStartChat}
                  disabled={creatingChat}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl",
                    "bg-primary text-primary-foreground",
                    "hover:bg-primary/90 transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {creatingChat ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <MessageCircle className="h-4 w-4" />
                      Chat
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Demo hint */}
          <p className="text-xs text-muted-foreground text-center">
            Search by username (e.g., alice, demo) or email (e.g., demo@example.com)
          </p>
        </div>
      </div>
    </div>
  );
}
