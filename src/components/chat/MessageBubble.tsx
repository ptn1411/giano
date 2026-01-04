import { useState, useRef, forwardRef, useMemo } from "react";
import { format } from "date-fns";
import { Reply, Forward, Pencil, Trash2, Pin, PinOff, MoreHorizontal } from "lucide-react";
import { Message, InlineButton, User } from "@/services/api/types";
import { MessageAttachments } from "./MessageAttachments";
import { ReplyPreview } from "./ReplyPreview";
import { VoicePlayer } from "./VoicePlayer";
import { ReadReceipts } from "./ReadReceipts";
import { DeliveryStatusIcon } from "./DeliveryStatusIcon";
import { AvatarWithStatus } from "./AvatarWithStatus";
import { highlightText } from "./MessageSearch";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  sender?: User;
  onReaction: (emoji: string) => void;
  onReply: (message: Message) => void;
  onForward: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
  onPin: (message: Message) => void;
  onUnpin: (messageId: string) => void;
  onRetry?: (messageId: string) => void;
  searchQuery?: string;
  onInlineButtonClick?: (button: InlineButton, messageId: string) => void;
  users?: User[];
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
    sender,
    onReaction, 
    onReply, 
    onForward, 
    onEdit, 
    onDelete, 
    onPin, 
    onUnpin,
    onRetry,
    searchQuery,
    onInlineButtonClick,
    users = []
  }, ref) {
    const [showReactions, setShowReactions] = useState(false);
    const [showMoreActions, setShowMoreActions] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout>();

    const handleMouseEnter = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setShowReactions(true);
    };

    const handleMouseLeave = () => {
      timeoutRef.current = setTimeout(() => {
        setShowReactions(false);
        setShowMoreActions(false);
      }, 200);
    };

    // Group reactions by emoji with user names
    const groupedReactions = useMemo(() => {
      const groups: Record<string, { emoji: string; users: string[]; count: number }> = {};
      
      message.reactions.forEach((reaction) => {
        if (!groups[reaction.emoji]) {
          groups[reaction.emoji] = { emoji: reaction.emoji, users: [], count: 0 };
        }
        const user = users.find((u) => u.id === reaction.userId);
        const userName = user?.name || (reaction.userId === 'user-1' ? 'You' : 'Someone');
        groups[reaction.emoji].users.push(userName);
        groups[reaction.emoji].count++;
      });
      
      return Object.values(groups);
    }, [message.reactions, users]);

    const hasAttachments = message.attachments && message.attachments.length > 0;
    const hasText = message.text && message.text.trim().length > 0;
    const hasInlineKeyboard = message.inlineKeyboard && message.inlineKeyboard.length > 0;
    
    // Check if this is a voice message
    const isVoiceMessage = hasAttachments && 
      message.attachments!.length === 1 && 
      message.attachments![0].name === 'Voice message';
    
    const isSending = message.deliveryStatus === 'sending';
    const isFailed = message.deliveryStatus === 'failed';
    
    return (
      <div
        ref={ref}
        className={cn(
          "group flex w-full gap-2 min-w-0 relative transition-all duration-200",
          isOwn ? "justify-end" : "justify-start",
          showReactions && "z-40"
        )}
      >
        {/* Avatar for other users (left side) */}
        {!isOwn && sender && (
          <div className="flex-shrink-0 self-end mb-1 transition-transform duration-200 group-hover:scale-105">
            <AvatarWithStatus
              src={sender.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sender.id}`}
              alt={sender.name}
              size="sm"
              status={sender.status}
            />
          </div>
        )}
        
        <div
          className={cn(
            "relative max-w-[75%] rounded-2xl min-w-0 break-words",
            "transition-all duration-200 ease-out",
            hasText ? "px-4 py-2" : hasAttachments ? "p-1.5" : "px-4 py-2",
            isOwn
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-card text-card-foreground rounded-bl-md shadow-sm",
            isSending && "opacity-70 scale-[0.98]",
            isFailed && "opacity-90",
            "hover:shadow-md"
          )}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Sender name for other users */}
          {!isOwn && sender && (
            <p className="text-xs font-medium text-primary mb-1">
              {sender.name}
            </p>
          )}
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
              <DeliveryStatusIcon 
                status={message.deliveryStatus || (message.isRead ? 'read' : 'sent')} 
                isOwn={isOwn}
                onRetry={isFailed && onRetry ? () => onRetry(message.id) : undefined}
              />
            )}
          </div>

          {/* Reactions display with tooltip */}
          {groupedReactions.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  "absolute -bottom-3 flex gap-0.5 rounded-full bg-card px-1.5 py-0.5 shadow-md cursor-pointer",
                  "transition-all duration-200 hover:shadow-lg hover:scale-105",
                  isOwn ? "left-2" : "right-2"
                )}>
                  {groupedReactions.map((group, index) => (
                    <span key={index} className="text-xs flex items-center gap-0.5">
                      {group.emoji}
                      {group.count > 1 && (
                        <span className="text-[10px] text-muted-foreground">{group.count}</span>
                      )}
                    </span>
                  ))}
                </div>
              </TooltipTrigger>
              <TooltipContent 
                side="top" 
                className="max-w-[200px] p-2"
              >
                <div className="space-y-1">
                  {groupedReactions.map((group, index) => (
                    <div key={index} className="flex items-start gap-2 text-xs">
                      <span className="text-base">{group.emoji}</span>
                      <span className="text-muted-foreground">
                        {group.users.join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Reaction picker - smooth animation */}
          <div
            className={cn(
              "absolute -top-11 flex items-center gap-0.5 rounded-full bg-card/95 backdrop-blur-sm px-1.5 py-1 shadow-xl z-50 border border-border/50",
              "transition-all duration-200 ease-out origin-bottom",
              isOwn ? "right-0" : "left-0",
              showReactions 
                ? "opacity-100 scale-100 translate-y-0" 
                : "opacity-0 scale-95 translate-y-2 pointer-events-none"
            )}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Quick reactions */}
            {quickReactions.map((emoji, index) => (
              <button
                key={emoji}
                onClick={() => onReaction(emoji)}
                className={cn(
                  "text-lg p-1 rounded-full transition-all duration-150",
                  "hover:scale-125 hover:bg-accent active:scale-110"
                )}
                style={{ transitionDelay: `${index * 20}ms` }}
              >
                {emoji}
              </button>
            ))}
            
            <div className="w-px h-5 bg-border mx-1" />
            
            {/* Action buttons */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onReply(message)}
                  className="p-1.5 rounded-full hover:bg-accent transition-all duration-150 hover:scale-110"
                >
                  <Reply className="h-4 w-4 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Reply</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onForward(message)}
                  className="p-1.5 rounded-full hover:bg-accent transition-all duration-150 hover:scale-110"
                >
                  <Forward className="h-4 w-4 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Forward</TooltipContent>
            </Tooltip>

            {/* More actions button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowMoreActions(!showMoreActions)}
                  className={cn(
                    "p-1.5 rounded-full transition-all duration-150 hover:scale-110",
                    showMoreActions ? "bg-accent" : "hover:bg-accent"
                  )}
                >
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">More</TooltipContent>
            </Tooltip>
          </div>

          {/* More actions dropdown */}
          <div
            className={cn(
              "absolute -top-[5.5rem] flex flex-col gap-1 rounded-xl bg-card/95 backdrop-blur-sm p-1.5 shadow-xl z-50 border border-border/50",
              "transition-all duration-200 ease-out origin-bottom",
              isOwn ? "right-0" : "left-0",
              showMoreActions && showReactions
                ? "opacity-100 scale-100 translate-y-0" 
                : "opacity-0 scale-95 translate-y-2 pointer-events-none"
            )}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <button
              onClick={() => { 
                if (message.isPinned) {
                  onUnpin(message.id);
                } else {
                  onPin(message);
                }
                setShowMoreActions(false); 
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent transition-colors text-sm"
            >
              {message.isPinned ? (
                <>
                  <PinOff className="h-4 w-4 text-primary" />
                  <span>Unpin</span>
                </>
              ) : (
                <>
                  <Pin className="h-4 w-4 text-muted-foreground" />
                  <span>Pin</span>
                </>
              )}
            </button>
            {isOwn && (
              <>
                <button
                  onClick={() => { onEdit(message); setShowMoreActions(false); }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent transition-colors text-sm"
                >
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => { onDelete(message); setShowMoreActions(false); }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-sm text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Read receipts for group chats */}
        {isOwn && message.readBy && message.readBy.length > 0 && (
          <ReadReceipts 
            readBy={message.readBy} 
            users={users} 
            isOwn={isOwn} 
          />
        )}
      </div>
    );
  }
);
