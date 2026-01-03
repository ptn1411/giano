import { useRef, useEffect } from "react";
import { Message, User, InlineButton } from "@/services/mockData";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { MessageSkeleton } from "./MessageSkeleton";
import { cn } from "@/lib/utils";

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
  onInlineButtonClick?: (button: InlineButton, messageId: string) => void;
  loading?: boolean;
  searchQuery?: string;
  typingUsers?: User[];
}

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
  onInlineButtonClick,
  loading, 
  searchQuery, 
  typingUsers = [] 
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading) {
    return <MessageSkeleton />;
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center px-4 animate-fade-in">
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

  return (
    <div className={cn(
      "flex-1 overflow-y-auto px-4 py-4 min-h-0",
      "scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
    )}>
      <div className="flex flex-col gap-3 min-w-0">
        {messages.map((message, index) => (
          <div
            key={message.id}
            id={`message-${message.id}`}
            ref={(el) => {
              if (el) messageRefs.current.set(message.id, el);
            }}
            className="animate-fade-in transition-all duration-200 min-w-0"
            style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
          >
            <MessageBubble
              message={message}
              isOwn={message.senderId === 'user-1'}
              onReaction={(emoji) => onReaction(message.id, emoji)}
              onReply={onReply}
              onForward={onForward}
              onEdit={onEdit}
              onDelete={onDelete}
              onPin={onPin}
              onUnpin={onUnpin}
              searchQuery={searchQuery}
              onInlineButtonClick={onInlineButtonClick}
              users={users}
            />
          </div>
        ))}
        {typingUsers.length > 0 && (
          <TypingIndicator users={typingUsers} />
        )}
      </div>
      <div ref={bottomRef} className="h-4" />
    </div>
  );
}
