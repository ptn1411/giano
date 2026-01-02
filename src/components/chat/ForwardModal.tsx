import { useState } from "react";
import { X, Search, Forward, Check } from "lucide-react";
import { Chat, Message } from "@/services/mockData";
import { cn } from "@/lib/utils";

interface ForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message | null;
  chats: Chat[];
  onForward: (chatId: string, message: Message) => void;
}

export function ForwardModal({ isOpen, onClose, message, chats, onForward }: ForwardModalProps) {
  const [search, setSearch] = useState("");
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  if (!isOpen || !message) return null;

  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleForward = () => {
    if (selectedChatId && message) {
      onForward(selectedChatId, message);
      setSelectedChatId(null);
      setSearch("");
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedChatId(null);
    setSearch("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-card rounded-2xl shadow-xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Forward Message</h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-accent transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Message Preview */}
        <div className="px-4 py-3 bg-accent/30 border-b border-border">
          <p className="text-xs text-muted-foreground mb-1">Forwarding message:</p>
          <p className="text-sm text-foreground line-clamp-2">
            {message.text || (message.attachments?.length ? `${message.attachments.length} attachment(s)` : "Message")}
          </p>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-background border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="max-h-64 overflow-y-auto">
          {filteredChats.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              No chats found
            </div>
          ) : (
            filteredChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setSelectedChatId(chat.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 transition-colors",
                  selectedChatId === chat.id
                    ? "bg-primary/10"
                    : "hover:bg-accent"
                )}
              >
                <img
                  src={chat.avatar}
                  alt={chat.name}
                  className="h-10 w-10 rounded-full object-cover"
                />
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium text-foreground truncate">{chat.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {chat.type === 'group' ? 'Group' : 'Private chat'}
                  </p>
                </div>
                {selectedChatId === chat.id && (
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleForward}
            disabled={!selectedChatId}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
              selectedChatId
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            <Forward className="h-4 w-4" />
            Forward
          </button>
        </div>
      </div>
    </div>
  );
}
