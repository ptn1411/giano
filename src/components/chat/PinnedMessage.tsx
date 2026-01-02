import { useState } from "react";
import { Pin, X, ChevronDown, ChevronUp } from "lucide-react";
import { Message } from "@/services/mockData";
import { cn } from "@/lib/utils";

interface PinnedMessageItemProps {
  message: Message;
  onUnpin: (messageId: string) => void;
  onScrollTo?: (messageId: string) => void;
  showUnpin?: boolean;
}

function PinnedMessageItem({ message, onUnpin, onScrollTo, showUnpin = true }: PinnedMessageItemProps) {
  return (
    <div 
      className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-accent/70 transition-colors"
      onClick={() => onScrollTo?.(message.id)}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground truncate">
          {message.text || (message.attachments?.length ? `${message.attachments.length} attachment(s)` : "Message")}
        </p>
      </div>
      {showUnpin && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUnpin(message.id);
          }}
          className="flex-shrink-0 p-1 rounded-full hover:bg-background transition-colors"
          title="Unpin message"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

interface PinnedMessagesBarProps {
  messages: Message[];
  onUnpin: (messageId: string) => void;
  onScrollTo?: (messageId: string) => void;
}

export function PinnedMessagesBar({ messages, onUnpin, onScrollTo }: PinnedMessagesBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const pinnedMessages = messages.filter((m) => m.isPinned);

  if (pinnedMessages.length === 0) return null;

  const latestPinned = pinnedMessages[pinnedMessages.length - 1];
  const hasMultiple = pinnedMessages.length > 1;

  return (
    <div className="border-b border-border bg-accent/50 animate-fade-in">
      {/* Main pinned message bar */}
      <div 
        className={cn(
          "flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-accent/70 transition-colors",
          isExpanded && hasMultiple && "border-b border-border/50"
        )}
        onClick={() => {
          if (hasMultiple) {
            setIsExpanded(!isExpanded);
          } else {
            onScrollTo?.(latestPinned.id);
          }
        }}
      >
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Pin className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-primary">
              {hasMultiple ? `${pinnedMessages.length} Pinned Messages` : "Pinned Message"}
            </p>
            {hasMultiple && (
              isExpanded ? (
                <ChevronUp className="h-3.5 w-3.5 text-primary" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-primary" />
              )
            )}
          </div>
          {!isExpanded && (
            <p className="text-sm text-foreground truncate">
              {latestPinned.text || (latestPinned.attachments?.length ? `${latestPinned.attachments.length} attachment(s)` : "Message")}
            </p>
          )}
        </div>
        {!hasMultiple && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnpin(latestPinned.id);
            }}
            className="flex-shrink-0 p-1.5 rounded-full hover:bg-background transition-colors"
            title="Unpin message"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Expanded list of all pinned messages */}
      {isExpanded && hasMultiple && (
        <div className="max-h-48 overflow-y-auto animate-in slide-in-from-top-2 duration-200">
          {pinnedMessages.map((message, index) => (
            <div
              key={message.id}
              className={cn(
                index < pinnedMessages.length - 1 && "border-b border-border/30"
              )}
            >
              <PinnedMessageItem
                message={message}
                onUnpin={onUnpin}
                onScrollTo={(id) => {
                  onScrollTo?.(id);
                  setIsExpanded(false);
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Keep for backwards compatibility
export function PinnedMessage({ message, onUnpin, onScrollTo }: { message: Message; onUnpin: (messageId: string) => void; onScrollTo?: (messageId: string) => void }) {
  return (
    <PinnedMessagesBar 
      messages={[message]} 
      onUnpin={onUnpin} 
      onScrollTo={onScrollTo} 
    />
  );
}
