import { useState, useCallback, useMemo } from "react";
import { Chat, User, Attachment, Message } from "@/services/mockData";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { PinnedMessagesBar } from "./PinnedMessage";
import { MessageSearch } from "./MessageSearch";
import { TypingIndicator } from "./TypingIndicator";
import { MessageSquare } from "lucide-react";
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
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  editingMessage?: Message | null;
  onCancelEdit?: () => void;
  onEditSubmit?: (messageId: string, newText: string) => void;
  onMenuClick: () => void;
  onBack: () => void;
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
  replyingTo,
  onCancelReply,
  editingMessage,
  onCancelEdit,
  onEditSubmit,
  onMenuClick,
  onBack,
  loading,
}: ChatAreaProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const scrollToMessage = useCallback((messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
      setTimeout(() => element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 2000);
    }
  }, []);

  if (!chat) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-background p-8 text-center">
        <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <MessageSquare className="h-12 w-12 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          Welcome to Telegram Chat
        </h2>
        <p className="text-muted-foreground max-w-md">
          Select a chat from the sidebar to start messaging, or create a new chat to connect with others.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-background">
      <ChatHeader
        chat={chat}
        participants={participants}
        onMenuClick={onMenuClick}
        onBack={onBack}
        onSearchClick={() => setIsSearchOpen(true)}
        showBackButton
      />
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
        onReaction={onReaction}
        onReply={onReply}
        onForward={onForward}
        onEdit={onEdit}
        onDelete={onDelete}
        onPin={onPin}
        typingUsers={chat.isTyping ? participants.filter(p => p.id !== 'user-1').slice(0, 1) : []}
        onUnpin={onUnpin}
        loading={loading}
        searchQuery={isSearchOpen ? searchQuery : undefined}
      />
      <MessageInput 
        onSend={onSendMessage} 
        onEditSubmit={onEditSubmit}
        replyingTo={replyingTo}
        onCancelReply={onCancelReply}
        editingMessage={editingMessage}
        onCancelEdit={onCancelEdit}
        users={participants}
      />
    </div>
  );
}
