import { useState, useRef, forwardRef } from "react";
import { format } from "date-fns";
import { Check, CheckCheck, Smile, Reply, Forward, Pencil, Trash2, Pin, PinOff } from "lucide-react";
import { Message, InlineButton } from "@/services/mockData";
import { MessageAttachments } from "./MessageAttachments";
import { ReplyPreview } from "./ReplyPreview";
import { VoicePlayer } from "./VoicePlayer";
import { highlightText } from "./MessageSearch";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  onReaction: (emoji: string) => void;
  onReply: (message: Message) => void;
  onForward: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
  onPin: (message: Message) => void;
  onUnpin: (messageId: string) => void;
  searchQuery?: string;
  onInlineButtonClick?: (button: InlineButton, messageId: string) => void;
}

const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

// Highlight @mentions in text
function formatTextWithMentions(text: string, isOwn: boolean, searchQuery?: string): React.ReactNode {
  // First apply search highlighting if needed
  if (searchQuery) {
    return highlightText(text, searchQuery);
  }

  // Split by @mentions pattern
  const mentionRegex = /(@\w+(?:\s\w+)?)/g;
  const parts = text.split(mentionRegex);

  return parts.map((part, index) => {
    if (part.startsWith("@")) {
      return (
        <span
          key={index}
          className={cn(
            "font-semibold cursor-pointer hover:underline",
            isOwn ? "text-primary-foreground/90" : "text-primary"
          )}
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

export const MessageBubble = forwardRef<HTMLDivElement, MessageBubbleProps>(
  function MessageBubble({ 
    message, 
    isOwn, 
    onReaction, 
    onReply, 
    onForward, 
    onEdit, 
    onDelete, 
    onPin, 
    onUnpin, 
    searchQuery,
    onInlineButtonClick 
  }, ref) {
    const [showReactions, setShowReactions] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout>();

    const handleMouseEnter = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setShowReactions(true);
    };

    const handleMouseLeave = () => {
      timeoutRef.current = setTimeout(() => setShowReactions(false), 300);
    };

    const hasAttachments = message.attachments && message.attachments.length > 0;
    const hasText = message.text && message.text.trim().length > 0;
    const hasInlineKeyboard = message.inlineKeyboard && message.inlineKeyboard.length > 0;
    
    // Check if this is a voice message
    const isVoiceMessage = hasAttachments && 
      message.attachments!.length === 1 && 
      message.attachments![0].name === 'Voice message';
    
    return (
      <div
        ref={ref}
        className={cn(
          "group flex w-full gap-2 min-w-0",
          isOwn ? "justify-end" : "justify-start"
        )}
      >
        <div
          className={cn(
            "relative max-w-[75%] rounded-2xl min-w-0 break-words",
            hasText ? "px-4 py-2" : hasAttachments ? "p-1.5" : "px-4 py-2",
            isOwn
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-card text-card-foreground rounded-bl-md shadow-sm"
          )}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Reply preview */}
          {message.replyTo && (
            <ReplyPreview
              senderName={message.replyTo.senderName}
              text={message.replyTo.text}
              onCancel={() => {}}
              isInBubble
              isOwn={isOwn}
            />
          )}

          {/* Voice message */}
          {isVoiceMessage && (
            <div className="py-1">
              <VoicePlayer
                audioUrl={message.attachments![0].url}
                duration={message.attachments![0].duration}
                isOwn={isOwn}
              />
            </div>
          )}

          {/* Regular Attachments */}
          {hasAttachments && !isVoiceMessage && (
            <MessageAttachments attachments={message.attachments!} isOwn={isOwn} />
          )}

          {/* Text content */}
          {hasText && (
            <p className={cn(
              "text-sm whitespace-pre-wrap break-words",
              hasAttachments && "mt-2 px-2"
            )}>
              {formatTextWithMentions(message.text, isOwn, searchQuery)}
            </p>
          )}

          {/* Inline Keyboard (Bot buttons) */}
          {hasInlineKeyboard && (
            <div className="mt-3 space-y-2">
              {message.inlineKeyboard!.map((row, rowIndex) => (
                <div key={rowIndex} className="flex gap-2">
                  {row.map((button, btnIndex) => (
                    <button
                      key={btnIndex}
                      onClick={() => onInlineButtonClick?.(button, message.id)}
                      className={cn(
                        "flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all",
                        "bg-background/80 hover:bg-background text-foreground",
                        "border border-border hover:border-primary",
                        "active:scale-95"
                      )}
                    >
                      {button.text}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
          
          <div className={cn(
            "mt-1 flex items-center justify-end gap-1",
            isOwn ? "text-primary-foreground/70" : "text-muted-foreground",
            hasAttachments && !hasText && "px-2 pb-1"
          )}>
            <span className="text-[10px]">
              {format(new Date(message.timestamp), 'HH:mm')}
            </span>
            {message.isEdited && (
              <span className="text-[10px] italic">edited</span>
            )}
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
              <button
                onClick={() => onReply(message)}
                className="p-1 rounded-full hover:bg-accent transition-colors"
                title="Reply"
              >
                <Reply className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                onClick={() => onForward(message)}
                className="p-1 rounded-full hover:bg-accent transition-colors"
                title="Forward"
              >
                <Forward className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                onClick={() => message.isPinned ? onUnpin(message.id) : onPin(message)}
                className="p-1 rounded-full hover:bg-accent transition-colors"
                title={message.isPinned ? "Unpin" : "Pin"}
              >
                {message.isPinned ? (
                  <PinOff className="h-4 w-4 text-primary" />
                ) : (
                  <Pin className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              {isOwn && (
                <>
                  <button
                    onClick={() => onEdit(message)}
                    className="p-1 rounded-full hover:bg-accent transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => onDelete(message)}
                    className="p-1 rounded-full hover:bg-destructive/10 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </>
              )}
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
);
