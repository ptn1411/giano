import { useState, useEffect } from "react";
import { X, Search, Loader2, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { usersService } from "@/services/api/users";
import { chatsService } from "@/services/api/chats";
import { useChatsStore } from "@/stores/chatsStore";
import { User } from "@/services/api/types";

interface SelectContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChatCreated: (chatId: string) => void;
}

export function SelectContactModal({ isOpen, onClose, onChatCreated }: SelectContactModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creatingChat, setCreatingChat] = useState<string | null>(null);
  
  const addChat = useChatsStore((state) => state.addChat);

  // Load connected users
  const loadUsers = async (search?: string) => {
    setLoading(true);
    setError(null);
    
    const result = await usersService.getUsers(search, true, 50);
    
    setLoading(false);
    
    if (result.error) {
      setError(result.error);
      return;
    }

    setUsers(result.users);
  };

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      loadUsers(searchQuery || undefined);
    }, 300);

    return () => clearTimeout(timer);
  }, [isOpen, searchQuery]);

  const handleStartChat = async (user: User) => {
    setCreatingChat(user.id);
    
    const result = await chatsService.createPrivateChat(user);
    
    setCreatingChat(null);

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
    setCreatingChat(null);
    setUsers([]);
    onClose();
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
          <h2 className="text-lg font-semibold text-foreground">New Chat</h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-accent transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts..."
              className={cn(
                "w-full pl-10 pr-4 py-3 rounded-xl border bg-background",
                "focus:outline-none focus:ring-2 focus:ring-primary/50",
                "placeholder:text-muted-foreground border-border"
              )}
              autoFocus
            />
          </div>
          {error && (
            <p className="text-sm text-destructive mt-2">{error}</p>
          )}
        </div>

        {/* Users List */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <p className="text-muted-foreground text-center">
                {searchQuery ? "No contacts found" : "No connected contacts yet"}
              </p>
              <p className="text-sm text-muted-foreground text-center mt-2">
                Use "Find User" to search for new contacts
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleStartChat(user)}
                  disabled={creatingChat === user.id}
                  className={cn(
                    "w-full p-4 flex items-center gap-3 hover:bg-accent transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-medium text-foreground truncate">
                      {user.name}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {user.status === 'online' ? (
                        <span className="text-green-500">Online</span>
                      ) : user.lastSeen ? (
                        `Last seen ${new Date(user.lastSeen).toLocaleString()}`
                      ) : (
                        'Offline'
                      )}
                    </p>
                  </div>
                  {creatingChat === user.id ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary flex-shrink-0" />
                  ) : (
                    <MessageCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
