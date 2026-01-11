import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, Smile, Paperclip, Image as ImageIcon, X, Pencil, Mic, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AttachmentPreview, FilePreview } from "./AttachmentPreview";
import { ReplyPreview } from "./ReplyPreview";
import { MentionSuggestions } from "./MentionSuggestions";
import { VoiceRecorder } from "./VoiceRecorder";
import { EmojiPicker } from "./EmojiPicker";
import { SlashCommandMenu, getCommandsForBot } from "./SlashCommandMenu";
import { Attachment, Message, User } from "@/services/api/types";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { uploadService } from "@/services/api/upload";
import { isBotFatherChat } from "@/lib/botfather";

interface MessageInputProps {
  onSend: (text: string, attachments?: Attachment[], replyTo?: Message['replyTo']) => void;
  onEditSubmit?: (messageId: string, newText: string) => void;
  disabled?: boolean;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  editingMessage?: Message | null;
  onCancelEdit?: () => void;
  users?: User[];
  botId?: string | null;
  chatId?: string | null;
}

export function MessageInput({ 
  onSend, 
  onEditSubmit, 
  disabled, 
  replyingTo, 
  onCancelReply, 
  editingMessage, 
  onCancelEdit, 
  users = [], 
  botId, 
  chatId 
}: MessageInputProps) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [showSlashCommands, setShowSlashCommands] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { onType, stopTyping } = useTypingIndicator(chatId ?? null);

  // Check if it's a bot chat (memoized)
  const isBotChat = useMemo(() => 
    botId || (chatId && isBotFatherChat(chatId)), 
    [botId, chatId]
  );

  // Memoized validation
  const { canSend, allUploaded, hasErrors } = useMemo(() => {
    const allUploaded = files.every((f) => f.progress === 100 && !f.error);
    const hasErrors = files.some((f) => f.error);
    const canSend = editingMessage 
      ? text.trim().length > 0 
      : (text.trim() || files.length > 0) && allUploaded && !hasErrors;
    
    return { canSend, allUploaded, hasErrors };
  }, [text, files, editingMessage]);

  // Optimized file upload
  const uploadFile = useCallback(async (filePreview: FilePreview) => {
    const uploadType = uploadService.getUploadType(filePreview.file);
    const validation = uploadService.validateFile(filePreview.file);
    
    if (!validation.valid) {
      setFiles((prev) =>
        prev.map((f) => 
          f.id === filePreview.id 
            ? { ...f, error: validation.error, progress: 0 } 
            : f
        )
      );
      return;
    }

    const result = await uploadService.uploadFile(
      filePreview.file,
      uploadType,
      (progress) => {
        setFiles((prev) =>
          prev.map((f) => 
            f.id === filePreview.id 
              ? { ...f, progress: progress.percentage } 
              : f
          )
        );
      }
    );

    if (result.success && result.attachment) {
      setFiles((prev) =>
        prev.map((f) => 
          f.id === filePreview.id 
            ? { 
                ...f, 
                progress: 100, 
                uploadedAttachment: {
                  id: result.attachment!.id,
                  url: result.attachment!.url,
                  name: result.attachment!.name,
                  size: result.attachment!.size,
                  mimeType: result.attachment!.mimeType,
                }
              } 
            : f
        )
      );
    } else {
      setFiles((prev) =>
        prev.map((f) => 
          f.id === filePreview.id 
            ? { ...f, error: result.error || 'Upload failed', progress: 0 } 
            : f
        )
      );
    }
  }, []);

  const retryUpload = useCallback((fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (file) {
      setFiles((prev) =>
        prev.map((f) => 
          f.id === fileId 
            ? { ...f, error: undefined, progress: 0 } 
            : f
        )
      );
      uploadFile(file);
    }
  }, [files, uploadFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const selectedFiles = Array.from(e.target.files || []);
    
    const newFiles: FilePreview[] = selectedFiles.map((file) => {
      const filePreview: FilePreview = {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        type: file.type.startsWith('image/') ? 'image' : 'file',
        progress: 0,
      };

      if (file.type.startsWith('image/')) {
        filePreview.preview = URL.createObjectURL(file);
      }

      return filePreview;
    });

    setFiles((prev) => [...prev, ...newFiles]);
    newFiles.forEach((f) => uploadFile(f));
    
    e.target.value = '';
    setShowAttachMenu(false);
  }, [uploadFile]);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSending || !canSend || disabled) return;
    
    setIsSending(true);
    stopTyping();
    
    try {
      if (editingMessage) {
        if (text.trim() && onEditSubmit) {
          await onEditSubmit(editingMessage.id, text.trim());
        }
        setText("");
        onCancelEdit?.();
      } else {
        const attachments: Attachment[] = files.map((f) => {
          if (f.uploadedAttachment) {
            return {
              id: f.uploadedAttachment.id,
              type: f.type,
              name: f.uploadedAttachment.name,
              size: f.uploadedAttachment.size,
              url: f.uploadedAttachment.url,
              mimeType: f.uploadedAttachment.mimeType,
            };
          }
          return {
            id: f.id,
            type: f.type,
            name: f.file.name,
            size: f.file.size,
            url: f.preview || URL.createObjectURL(f.file),
            mimeType: f.file.type,
          };
        });

        await onSend(
          text.trim(), 
          attachments.length > 0 ? attachments : undefined, 
          replyingTo ? {
            id: replyingTo.id,
            text: replyingTo.text,
            senderId: replyingTo.senderId,
            senderName: replyingTo.senderId === 'user-1' ? 'You' : 'User',
          } : undefined
        );
        
        setText("");
        setFiles([]);
        onCancelReply?.();
      }
      
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } finally {
      setIsSending(false);
    }
  }, [text, files, editingMessage, replyingTo, canSend, disabled, isSending, onSend, onEditSubmit, onCancelEdit, onCancelReply, stopTyping]);

  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.text);
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
  }, [editingMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((showMentions || showSlashCommands) && 
        (e.key === "Enter" || e.key === "Tab" || e.key === "ArrowUp" || e.key === "ArrowDown")) {
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    if (e.key === 'Escape' && showSlashCommands) {
      setShowSlashCommands(false);
    }
  }, [showMentions, showSlashCommands, handleSubmit]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);

    // Debounced typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (newText.length > 0) {
      onType();
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 3000);
    }

    // Slash commands
    if (isBotChat && newText.startsWith("/")) {
      setShowSlashCommands(true);
    } else {
      setShowSlashCommands(false);
    }

    // Mentions
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newText.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      if (!textAfterAt.includes(" ")) {
        setMentionQuery(textAfterAt);
        setMentionStartIndex(lastAtIndex);
        setShowMentions(true);
        return;
      }
    }
    
    setShowMentions(false);
    setMentionQuery("");
    setMentionStartIndex(-1);
  }, [isBotChat, onType, stopTyping]);

  const handleSlashCommandSelect = useCallback((command: string) => {
    setText(command + " ");
    setShowSlashCommands(false);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, []);

  const handleMentionSelect = useCallback((user: User) => {
    const beforeMention = text.slice(0, mentionStartIndex);
    const afterCursor = text.slice(mentionStartIndex + mentionQuery.length + 1);
    const newText = `${beforeMention}@${user.name} ${afterCursor}`;
    setText(newText);
    setShowMentions(false);
    setMentionQuery("");
    setMentionStartIndex(-1);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [text, mentionStartIndex, mentionQuery]);

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 150);
      textarea.style.height = `${newHeight}px`;
      textarea.style.overflowY = textarea.scrollHeight > 150 ? 'auto' : 'hidden';
    }
  }, []);

  useEffect(() => {
    handleInput();
  }, [text, handleInput]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleVoiceSend = useCallback((text: string, attachments?: Attachment[]) => {
    onSend(text, attachments, replyingTo ? {
      id: replyingTo.id,
      text: replyingTo.text,
      senderId: replyingTo.senderId,
      senderName: replyingTo.senderId === 'user-1' ? 'You' : 'User',
    } : undefined);
    setIsRecordingVoice(false);
    onCancelReply?.();
  }, [onSend, replyingTo, onCancelReply]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    setText((prev) => prev + emoji);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      files.forEach(f => {
        if (f.preview) {
          URL.revokeObjectURL(f.preview);
        }
      });
    };
  }, [files]);

  if (isRecordingVoice) {
    return (
      <VoiceRecorder
        onSend={handleVoiceSend}
        onCancel={() => setIsRecordingVoice(false)}
      />
    );
  }

  return (
    <div className="border-t border-border bg-card backdrop-blur-sm">
      {/* Edit Preview */}
      {editingMessage && (
        <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary/5 to-primary/10 border-l-4 border-primary animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <Pencil className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary mb-0.5">Đang chỉnh sửa tin nhắn</p>
            <p className="text-sm text-muted-foreground truncate">{editingMessage.text}</p>
          </div>
          <button
            onClick={onCancelEdit}
            className="flex-shrink-0 p-2 rounded-full hover:bg-accent/80 transition-all duration-200 hover:scale-105 active:scale-95"
            aria-label="Hủy chỉnh sửa"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Reply Preview */}
      {replyingTo && !editingMessage && (
        <ReplyPreview
          senderName={replyingTo.senderId === 'user-1' ? 'You' : 'User'}
          text={replyingTo.text}
          onCancel={onCancelReply || (() => {})}
        />
      )}

      {/* Attachment Preview */}
      {files.length > 0 && (
        <AttachmentPreview files={files} onRemove={removeFile} onRetry={retryUpload} />
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-3 px-4 py-3">
        {/* Attach button */}
        <div className="relative" ref={attachMenuRef}>
          <button
            type="button"
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            disabled={disabled || isSending}
            className={cn(
              "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition-all duration-300",
              "hover:scale-105 active:scale-95",
              showAttachMenu 
                ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rotate-45 shadow-lg shadow-primary/20" 
                : "hover:bg-accent text-muted-foreground hover:text-foreground",
              (disabled || isSending) && "opacity-50 cursor-not-allowed"
            )}
            aria-label="Attach files"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          {/* Attach menu */}
          {showAttachMenu && (
            <div className="absolute bottom-14 left-0 flex flex-col gap-1 rounded-2xl bg-card/95 backdrop-blur-xl p-2 shadow-2xl border border-border/50 animate-in fade-in slide-in-from-bottom-4 duration-300 min-w-[160px]">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-accent transition-all duration-200 group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-primary/5 group-hover:from-primary/20 group-hover:to-primary/10 transition-all duration-200">
                  <ImageIcon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">Ảnh</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-accent transition-all duration-200 group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-secondary/30 to-secondary/10 group-hover:from-secondary/40 group-hover:to-secondary/20 transition-all duration-200">
                  <Paperclip className="h-5 w-5 text-secondary-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground">Tệp</span>
              </button>
            </div>
          )}
        </div>

        {/* Hidden file inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e, 'image')}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e, 'file')}
        />

        {/* Input container */}
        <div className="relative flex-1">
          {/* Slash Command Menu */}
          {isBotChat && showSlashCommands && (
            <SlashCommandMenu
              commands={getCommandsForBot(botId, chatId)}
              onSelect={handleSlashCommandSelect}
              filterQuery={text}
            />
          )}
          
          {/* Mention Suggestions */}
          <MentionSuggestions
            users={users}
            query={mentionQuery}
            onSelect={handleMentionSelect}
            onClose={() => setShowMentions(false)}
            isOpen={showMentions}
          />
          
          {/* Textarea */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder={isBotChat ? "Gõ / để xem lệnh..." : "Nhập tin nhắn..."}
              rows={1}
              disabled={disabled || isSending}
              className={cn(
                "w-full resize-none rounded-2xl border-2 border-border bg-background px-4 py-3 pr-12",
                "text-sm placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                "transition-all duration-200",
                "overflow-hidden",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              style={{ maxHeight: '150px' }}
            />
            
            {/* Emoji picker */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <EmojiPicker onSelect={handleEmojiSelect}>
                <button
                  type="button"
                  disabled={disabled || isSending}
                  className="text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Add emoji"
                >
                  <Smile className="h-5 w-5" />
                </button>
              </EmojiPicker>
            </div>
          </div>
        </div>

        {/* Send/Voice button */}
        {canSend ? (
          <button
            type="submit"
            disabled={disabled || isSending}
            className={cn(
              "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full",
              "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground",
              "hover:from-primary hover:to-primary/90",
              "transition-all duration-300 hover:scale-105 active:scale-95",
              "shadow-lg shadow-primary/20",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            )}
            aria-label="Gửi tin nhắn"
          >
            {isSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsRecordingVoice(true)}
            disabled={disabled || isSending}
            className={cn(
              "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full",
              "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground",
              "hover:from-primary hover:to-primary/90",
              "transition-all duration-300 hover:scale-105 active:scale-95",
              "shadow-lg shadow-primary/20",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            )}
            aria-label="Ghi âm tin nhắn thoại"
          >
            <Mic className="h-5 w-5" />
          </button>
        )}
      </form>
    </div>
  );
}