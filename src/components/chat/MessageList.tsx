import { useRef, useEffect, useCallback, memo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Message, User, InlineButton } from "@/services/api/types";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { MessageSkeleton } from "./MessageSkeleton";
import { useAuthStore } from "@/stores/authStore";
import { Loader2 } from "lucide-react";

interface MessageListProps {
  messages: Message[];
  users: User[];
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
  loading?: boolean;
  searchQuery?: string;
  typingUsers?: User[];
}

// Memoized message item
interface MessageItemProps {
  message: Message;
  isOwn: boolean;
  sender: User | undefined;
  users: User[];
  onReaction: (emoji: string) => void;
  onReply: (message: Message) => void;
  onForward: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
  onPin: (message: Message) => void;
  onUnpin: (messageId: string) => void;
  onRetry?: (messageId: string) => void;
  onInlineButtonClick?: (button: InlineButton, messageId: string) => void;
  onCommandClick?: (command: string) => void;
  searchQuery?: string;
}

const MessageItem = memo(function MessageItem({
  message,
  isOwn,
  sender,
  users,
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
  searchQuery,
}: MessageItemProps) {
  return (
    <div id={`message-${message.id}`} className="px-4 py-1">
      <MessageBubble
        message={message}
        isOwn={isOwn}
        sender={sender}
        onReaction={onReaction}
        onReply={onReply}
        onForward={onForward}
        onEdit={onEdit}
        onDelete={onDelete}
        onPin={onPin}
        onUnpin={onUnpin}
        onRetry={onRetry}
        searchQuery={searchQuery}
        onInlineButtonClick={onInlineButtonClick}
        onCommandClick={onCommandClick}
        users={users}
      />
    </div>
  );
});

export function MessageList({ 
  messages,
  users,
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
  loading, 
  searchQuery, 
  typingUsers = [] 
}: MessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const currentUserId = useAuthStore((state) => state.session?.user?.id);
  const prevMessagesLengthRef = useRef(messages.length);
  const shouldScrollToBottomRef = useRef(true);
  const beforeLoadOffsetRef = useRef<number | null>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });

  // Callback ref that safely measures elements after render
  const measureRef = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;
      // Use queueMicrotask to defer measurement until after React's render phase
      queueMicrotask(() => {
        virtualizer.measureElement(el);
      });
    },
    [virtualizer]
  );

  // Scroll using virtualizer.scrollToIndex
  const scrollToBottom = useCallback((smooth = false) => {
    if (messages.length > 0 && parentRef.current) {
      virtualizer.scrollToIndex(messages.length - 1, {
        align: "end",
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, [virtualizer, messages.length]);

  // Initial scroll to bottom - useEffect runs after render + paint
  useEffect(() => {
    if (messages.length > 0 && shouldScrollToBottomRef.current && parentRef.current) {
      // Delay to ensure DOM is ready
      const timer = setTimeout(() => {
        scrollToBottom(false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [messages.length, scrollToBottom]);

  // Handle new messages and preserve scroll on prepend
  useEffect(() => {
    const prev = prevMessagesLengthRef.current;
    const curr = messages.length;

    if (!parentRef.current) {
      prevMessagesLengthRef.current = curr;
      return;
    }

    // Restore scroll position after loading older messages (prepend)
    if (beforeLoadOffsetRef.current !== null) {
      virtualizer.scrollToOffset(beforeLoadOffsetRef.current);
      beforeLoadOffsetRef.current = null;
    }
    // New message appended - scroll to bottom if user was at bottom
    else if (curr > prev && shouldScrollToBottomRef.current) {
      scrollToBottom(true);
    }

    prevMessagesLengthRef.current = curr;
  }, [messages.length, scrollToBottom, virtualizer]);

  // Handle scroll for infinite loading and tracking position
  const handleScroll = useCallback(() => {
    const element = parentRef.current;
    if (!element) return;

    // Track if user is near bottom
    const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 150;
    shouldScrollToBottomRef.current = isNearBottom;

    // Load more when near top - save offset before loading
    if (element.scrollTop < 200 && onLoadMore && hasMore && !isLoadingMore) {
      beforeLoadOffsetRef.current = virtualizer.scrollOffset ?? 0;
      onLoadMore();
    }
  }, [onLoadMore, hasMore, isLoadingMore, virtualizer]);

  if (loading) {
    return <MessageSkeleton />;
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center px-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <span className="text-3xl">💬</span>
        </div>
        <h3 className="font-semibold text-lg text-foreground">No messages yet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Send a message to start the conversation
        </p>
      </div>
    );
  }

  const items = virtualizer.getVirtualItems();

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {isLoadingMore && (
        <div className="flex justify-center py-2 shrink-0">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      
      <div
        ref={parentRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {items.map((virtualRow) => {
            const message = messages[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={measureRef}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <MessageItem
                  message={message}
                  isOwn={message.senderId === currentUserId}
                  sender={users.find((u) => u.id === message.senderId)}
                  users={users}
                  onReaction={(emoji) => onReaction(message.id, emoji)}
                  onReply={onReply}
                  onForward={onForward}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onPin={onPin}
                  onUnpin={onUnpin}
                  onRetry={onRetry}
                  searchQuery={searchQuery}
                  onInlineButtonClick={onInlineButtonClick}
                  onCommandClick={onCommandClick}
                />
              </div>
            );
          })}
        </div>
      </div>

      {typingUsers.length > 0 && (
        <div className="px-4 py-2 shrink-0">
          <TypingIndicator users={typingUsers} />
        </div>
      )}
    </div>
  );
}