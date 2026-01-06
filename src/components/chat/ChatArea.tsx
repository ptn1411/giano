import { useState, useCallback, useMemo } from "react";
import { Chat, User, Attachment, Message, InlineButton } from "@/services/api/types";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { PinnedMessagesBar } from "./PinnedMessage";
import { MessageSearch } from "./MessageSearch";
import { BotReplyKeyboard } from "./BotReplyKeyboard";
import { NetworkStatusIndicator } from "./NetworkStatusIndicator";
import { MessageSquare, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

interface ChatAreaProps {
  chat: Chat | null;
  messages: Message[];
  participants: User[];
  onSendMessage: (text: string, attachments?: Attachment[], replyTo?: Message['replyTo']) => void;
  onReaction: (messageId: string, emoji: string) => void;
  onReply: (message: Message) => void;
  onForward: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
  onPin: (message: Message) => void;
  onUnpin: (messageId: string) => void;
  onRetry?: (messageId: string) => void;
  onInlineButtonClick?: (button: InlineButton, messageId: string) => void;
  onCommandClick?: (command: string) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  editingMessage?: Message | null;
  onCancelEdit?: () => void;
  onEditSubmit?: (messageId: string, newText: string) => void;
  onMenuClick: () => void;
  onBack: () => void;
  onClearChat?: () => void;
  onDeleteChat?: () => void;
  loading?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
}

export function ChatArea({
  chat,
  messages,
  participants,
  onSendMessage,
  onReaction,
  onReply,
  onForward,
  onEdit,
  onDelete,
  onPin,
  onUnpin,
  onRetry,
  onInlineButtonClick,
  onCommandClick,
  onLoadMore,
  hasMore,
  isLoadingMore,
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  onEditSubmit,
  onMenuClick,
  onBack,
  onClearChat,
  onDeleteChat,
  loading,
}: ChatAreaProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Initialize network status monitoring
  useNetworkStatus();

  const scrollToMessage = useCallback((messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
      setTimeout(() => element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 2000);
    }
  }, []);

  const handleInlineButtonClick = useCallback((button: InlineButton, messageId: string) => {
    if (onInlineButtonClick) {
      onInlineButtonClick(button, messageId);
    }
  }, [onInlineButtonClick]);

  const handleReplyKeyboardClick = useCallback((text: string) => {
    onSendMessage(text);
  }, [onSendMessage]);

  // Get bot ID from participants
  const botId = chat?.isBot 
    ? chat.participants.find(p => p.startsWith('bot-')) 
    : null;

  // Extract shared media from messages
  const sharedMedia = useMemo(() => {
    return messages
      .filter(m => m.attachments && m.attachments.length > 0)
      .flatMap(m => m.attachments || []);
  }, [messages]);

  if (!chat) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-background p-8 text-center relative">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="absolute top-4 left-4 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <MessageSquare className="h-12 w-12 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          Chào mừng đến với GIANO
        </h2>
        <p className="text-muted-foreground max-w-md">
          Chọn một cuộc trò chuyện từ danh sách bên trái để bắt đầu nhắn tin, hoặc tạo cuộc trò chuyện mới.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-background min-h-0 overflow-hidden">
      <ChatHeader
        chat={chat}
        participants={participants}
        sharedMedia={sharedMedia}
        onMenuClick={onMenuClick}
        onBack={onBack}
        onSearchClick={() => setIsSearchOpen(true)}
        onClearChat={onClearChat}
        onDeleteChat={onDeleteChat}
        showBackButton
      />
      <NetworkStatusIndicator />
      <MessageSearch
        messages={messages}
        isOpen={isSearchOpen}
        onClose={() => {
          setIsSearchOpen(false);
          setSearchQuery("");
        }}
        onNavigate={scrollToMessage}
        onQueryChange={setSearchQuery}
      />
      <PinnedMessagesBar
        messages={messages}
        onUnpin={onUnpin}
        onScrollTo={scrollToMessage}
      />
      <MessageList
        messages={messages}
        users={participants}
        onReaction={onReaction}
        onReply={onReply}
        onForward={onForward}
        onEdit={onEdit}
        onDelete={onDelete}
        onPin={onPin}
        typingUsers={chat.isTyping ? participants.filter(p => p.id !== 'user-1').slice(0, 1) : []}
        onUnpin={onUnpin}
        onRetry={onRetry}
        onInlineButtonClick={handleInlineButtonClick}
        onCommandClick={onCommandClick || ((cmd) => onSendMessage(cmd))}
        onLoadMore={onLoadMore}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        loading={loading}
        searchQuery={isSearchOpen ? searchQuery : undefined}
      />
      {/* Bot Reply Keyboard */}
      {chat.isBot && botId && (
        <BotReplyKeyboard 
          botId={botId} 
          onButtonClick={handleReplyKeyboardClick} 
        />
      )}
      <MessageInput 
        onSend={onSendMessage} 
        onEditSubmit={onEditSubmit}
        replyingTo={replyingTo}
        onCancelReply={onCancelReply}
        editingMessage={editingMessage}
        onCancelEdit={onCancelEdit}
        users={participants}
        botId={botId}
        chatId={chat.id}
      />
    </div>
  );
}
