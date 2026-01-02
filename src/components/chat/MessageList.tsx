import { useRef, useEffect } from "react";
import { Message } from "@/services/mockData";
import { MessageBubble } from "./MessageBubble";
import { cn } from "@/lib/utils";

interface MessageListProps {
  messages: Message[];
  onReaction: (messageId: string, emoji: string) => void;
  onReply: (message: Message) => void;
  loading?: boolean;
}

export function MessageList({ messages, onReaction, onReply, loading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
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

  return (
    <div className={cn(
      "flex-1 overflow-y-auto px-4 py-4",
      "scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
    )}>
      <div className="flex flex-col gap-3">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={message.senderId === 'user-1'}
            onReaction={(emoji) => onReaction(message.id, emoji)}
            onReply={onReply}
          />
        ))}
      </div>
      <div ref={bottomRef} className="h-4" />
    </div>
  );
}
