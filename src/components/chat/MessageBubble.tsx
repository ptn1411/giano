import { useState, useRef } from "react";
import { format } from "date-fns";
import { Check, CheckCheck, Smile } from "lucide-react";
import { Message } from "@/services/mockData";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  onReaction: (emoji: string) => void;
}

const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export function MessageBubble({ message, isOwn, onReaction }: MessageBubbleProps) {
  const [showReactions, setShowReactions] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowReactions(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setShowReactions(false), 300);
  };

  return (
    <div
      className={cn(
        "group flex w-full gap-2",
        isOwn ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "relative max-w-[75%] rounded-2xl px-4 py-2",
          isOwn
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-card text-card-foreground rounded-bl-md shadow-sm"
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
        
        <div className={cn(
          "mt-1 flex items-center justify-end gap-1",
          isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          <span className="text-[10px]">
            {format(new Date(message.timestamp), 'HH:mm')}
          </span>
          {isOwn && (
            message.isRead ? (
              <CheckCheck className="h-3.5 w-3.5" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )
          )}
        </div>

        {/* Reactions display */}
        {message.reactions.length > 0 && (
          <div className={cn(
            "absolute -bottom-3 flex gap-0.5 rounded-full bg-card px-1.5 py-0.5 shadow-md",
            isOwn ? "left-2" : "right-2"
          )}>
            {message.reactions.map((reaction, index) => (
              <span key={index} className="text-xs">{reaction.emoji}</span>
            ))}
          </div>
        )}

        {/* Reaction picker */}
        {showReactions && (
          <div
            className={cn(
              "absolute -top-10 flex items-center gap-1 rounded-full bg-card px-2 py-1.5 shadow-lg z-10",
              isOwn ? "right-0" : "left-0"
            )}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {quickReactions.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onReaction(emoji)}
                className="text-base hover:scale-125 transition-transform"
              >
                {emoji}
              </button>
            ))}
            <button className="ml-1 rounded-full p-1 hover:bg-accent">
              <Smile className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
