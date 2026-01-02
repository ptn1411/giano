import { Pin, X } from "lucide-react";
import { Message } from "@/services/mockData";
import { cn } from "@/lib/utils";

interface PinnedMessageProps {
  message: Message;
  onUnpin: (messageId: string) => void;
  onScrollTo?: (messageId: string) => void;
}

export function PinnedMessage({ message, onUnpin, onScrollTo }: PinnedMessageProps) {
  return (
    <div 
      className="flex items-center gap-3 px-4 py-2 bg-accent/50 border-b border-border cursor-pointer hover:bg-accent/70 transition-colors animate-fade-in"
      onClick={() => onScrollTo?.(message.id)}
    >
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
        <Pin className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-primary">Pinned Message</p>
        <p className="text-sm text-foreground truncate">
          {message.text || (message.attachments?.length ? `${message.attachments.length} attachment(s)` : "Message")}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onUnpin(message.id);
        }}
        className="flex-shrink-0 p-1.5 rounded-full hover:bg-background transition-colors"
        title="Unpin message"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}

interface PinnedMessagesBarProps {
  messages: Message[];
  onUnpin: (messageId: string) => void;
  onScrollTo?: (messageId: string) => void;
}

export function PinnedMessagesBar({ messages, onUnpin, onScrollTo }: PinnedMessagesBarProps) {
  const pinnedMessages = messages.filter((m) => m.isPinned);

  if (pinnedMessages.length === 0) return null;

  return (
    <div className="border-b border-border">
      {pinnedMessages.map((message) => (
        <PinnedMessage
          key={message.id}
          message={message}
          onUnpin={onUnpin}
          onScrollTo={onScrollTo}
        />
      ))}
    </div>
  );
}
