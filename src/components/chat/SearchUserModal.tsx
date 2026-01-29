import { cn } from "@/lib/utils";
import { BotPublic, botsService } from "@/services/api/bots";
import { chatsService } from "@/services/api/chats";
import { User } from "@/services/api/types";
import { usersService } from "@/services/api/users";
import { useChatsStore } from "@/stores/chatsStore";
import { Bot, Loader2, MessageCircle, Search, X } from "lucide-react";
import { useState } from "react";

interface SearchUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChatCreated: (chatId: string) => void;
}

// Type to hold either a user or a bot
type SearchResult =
  | { type: "user"; data: User }
  | { type: "bot"; data: BotPublic };

export function SearchUserModal({
  isOpen,
  onClose,
  onChatCreated,
}: SearchUserModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [creatingChat, setCreatingChat] = useState(false);

  const addChat = useChatsStore((state) => state.addChat);

  // Check if query looks like a bot username (ends with _bot)
  const isBotUsername = (query: string): boolean => {
    return query.trim().toLowerCase().endsWith("_bot");
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError("Vui lòng nhập tên người dùng hoặc bot");
      return;
    }

    setLoading(true);
    setError(null);
    setSearchResult(null);

    const query = searchQuery.trim();

    // Check if searching for a bot (username ends with _bot)
    if (isBotUsername(query)) {
      const result = await botsService.searchByUsername(query);
      setLoading(false);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.bot) {
        setSearchResult({ type: "bot", data: result.bot });
      }
      return;
    }

    // Otherwise search for user
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmail = emailRegex.test(query);

    let result;
    if (isEmail) {
      result = await usersService.searchByEmail(query);
    } else {
      result = await usersService.searchByUsername(query);
    }

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.user) {
      setSearchResult({ type: "user", data: result.user });
    }
  };

  const handleStartChat = async () => {
    if (!searchResult) return;

    setCreatingChat(true);

    if (searchResult.type === "user") {
      const result = await chatsService.createPrivateChat(searchResult.data);

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
    } else {
      // Create private chat with bot
      const result = await chatsService.createBotChat(searchResult.data.id);

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
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    setError(null);
    setSearchResult(null);
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

  // Get display info based on result type
  const getDisplayInfo = () => {
    if (!searchResult) return null;

    if (searchResult.type === "user") {
      return {
        name: searchResult.data.name,
        avatar: searchResult.data.avatar,
        status:
          searchResult.data.status === "online"
            ? "Đang hoạt động"
            : "Ngoại tuyến",
        statusColor:
          searchResult.data.status === "online"
            ? "text-green-500"
            : "text-muted-foreground",
        isBot: false,
      };
    } else {
      return {
        name: searchResult.data.name,
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${searchResult.data.username || searchResult.data.id}&backgroundColor=0ea5e9`,
        status: searchResult.data.isActive
          ? "Bot hoạt động"
          : "Bot không hoạt động",
        statusColor: searchResult.data.isActive
          ? "text-blue-500"
          : "text-muted-foreground",
        isBot: true,
      };
    }
  };

  const displayInfo = getDisplayInfo();

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
          <h2 className="text-lg font-semibold text-foreground">
            Tìm người dùng hoặc Bot
          </h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-accent transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Search Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Tìm theo tên người dùng, Email hoặc Bot
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setError(null);
                  setSearchResult(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Nhập username, email hoặc bot_name..."
                className={cn(
                  "w-full pl-10 pr-4 py-3 rounded-xl border bg-background",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50",
                  "placeholder:text-muted-foreground",
                  error ? "border-destructive" : "border-border",
                )}
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
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
              "flex items-center justify-center gap-2",
            )}>
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Đang tìm...
              </>
            ) : (
              <>
                <Search className="h-5 w-5" />
                Tìm kiếm
              </>
            )}
          </button>

          {/* Found Result */}
          {searchResult && displayInfo && (
            <div className="mt-4 p-4 rounded-xl bg-accent/50 border border-border">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={displayInfo.avatar}
                    alt={displayInfo.name}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                  {displayInfo.isBot && (
                    <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-1">
                      <Bot className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate flex items-center gap-2">
                    {displayInfo.name}
                    {displayInfo.isBot && (
                      <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded">
                        BOT
                      </span>
                    )}
                  </p>
                  <p className={cn("text-sm", displayInfo.statusColor)}>
                    {displayInfo.status}
                  </p>
                </div>
                <button
                  onClick={handleStartChat}
                  disabled={creatingChat}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl",
                    "bg-primary text-primary-foreground",
                    "hover:bg-primary/90 transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  )}>
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
            Tìm người dùng (vd: alice) hoặc bot (vd: test_bot)
          </p>
        </div>
      </div>
    </div>
  );
}
