import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, Smile, Paperclip, Image as ImageIcon, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { AttachmentPreview, FilePreview } from "./AttachmentPreview";
import { ReplyPreview } from "./ReplyPreview";
import { MentionSuggestions } from "./MentionSuggestions";
import { Attachment, Message, User } from "@/services/mockData";

interface MessageInputProps {
  onSend: (text: string, attachments?: Attachment[], replyTo?: Message['replyTo']) => void;
  onEditSubmit?: (messageId: string, newText: string) => void;
  disabled?: boolean;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  editingMessage?: Message | null;
  onCancelEdit?: () => void;
  users?: User[];
}

export function MessageInput({ onSend, onEditSubmit, disabled, replyingTo, onCancelReply, editingMessage, onCancelEdit, users = [] }: MessageInputProps) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  // Simulate upload progress
  const simulateUpload = useCallback((fileId: string) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20 + 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, progress: Math.min(100, Math.round(progress)) } : f))
      );
    }, 150);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const selectedFiles = Array.from(e.target.files || []);
    
    const newFiles: FilePreview[] = selectedFiles.map((file) => {
      const filePreview: FilePreview = {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        type: file.type.startsWith('image/') ? 'image' : 'file',
        progress: 0,
      };

      // Create preview for images
      if (file.type.startsWith('image/')) {
        filePreview.preview = URL.createObjectURL(file);
      }

      return filePreview;
    });

    setFiles((prev) => [...prev, ...newFiles]);
    newFiles.forEach((f) => simulateUpload(f.id));
    
    // Reset input
    e.target.value = '';
    setShowAttachMenu(false);
  }, [simulateUpload]);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Handle edit mode
    if (editingMessage) {
      if (text.trim() && onEditSubmit) {
        onEditSubmit(editingMessage.id, text.trim());
      }
      setText("");
      onCancelEdit?.();
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      return;
    }
    
    const allUploaded = files.every((f) => f.progress === 100);
    if ((!text.trim() && files.length === 0) || disabled || !allUploaded) return;

    // Convert FilePreview to Attachment
    const attachments: Attachment[] = files.map((f) => ({
      id: f.id,
      type: f.type,
      name: f.file.name,
      size: f.file.size,
      url: f.preview || URL.createObjectURL(f.file),
      mimeType: f.file.type,
    }));

    onSend(text.trim(), attachments.length > 0 ? attachments : undefined, replyingTo ? {
      id: replyingTo.id,
      text: replyingTo.text,
      senderId: replyingTo.senderId,
      senderName: replyingTo.senderId === 'user-1' ? 'You' : 'User',
    } : undefined);
    setText("");
    setFiles([]);
    onCancelReply?.();
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // Populate text when editing
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.text);
      textareaRef.current?.focus();
    }
  }, [editingMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Don't submit if mention suggestions are open
    if (showMentions && (e.key === "Enter" || e.key === "Tab" || e.key === "ArrowUp" || e.key === "ArrowDown")) {
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = newText.slice(0, cursorPos);
    
    // Find the last @ before cursor
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Check if there's no space after @ (still typing username)
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
  };

  const handleMentionSelect = (user: User) => {
    const beforeMention = text.slice(0, mentionStartIndex);
    const afterCursor = text.slice(mentionStartIndex + mentionQuery.length + 1);
    const newText = `${beforeMention}@${user.name} ${afterCursor}`;
    setText(newText);
    setShowMentions(false);
    setMentionQuery("");
    setMentionStartIndex(-1);
    textareaRef.current?.focus();
  };

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 150);
      textarea.style.height = `${newHeight}px`;
      // Show scrollbar only when at max height
      textarea.style.overflowY = textarea.scrollHeight > 150 ? 'auto' : 'hidden';
    }
  }, []);

  useEffect(() => {
    handleInput();
  }, [text]);

  // Close attach menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const canSend = editingMessage ? text.trim().length > 0 : (text.trim() || files.length > 0) && files.every((f) => f.progress === 100);

  return (
    <div className="border-t border-border bg-card">
      {/* Edit Preview */}
      {editingMessage && (
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border-l-4 border-primary animate-in slide-in-from-bottom-2 duration-200">
          <Pencil className="h-4 w-4 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary">Editing message</p>
            <p className="text-sm text-muted-foreground truncate">{editingMessage.text}</p>
          </div>
          <button
            onClick={onCancelEdit}
            className="flex-shrink-0 p-1 rounded-full hover:bg-accent transition-colors"
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
      <AttachmentPreview files={files} onRemove={removeFile} />

      <form onSubmit={handleSubmit} className="flex items-end gap-2 px-4 py-3">
        {/* Attach button with menu */}
        <div className="relative" ref={attachMenuRef}>
          <button
            type="button"
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className={cn(
              "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-all duration-200",
              showAttachMenu 
                ? "bg-primary text-primary-foreground rotate-45" 
                : "hover:bg-accent text-muted-foreground"
            )}
          >
            <Paperclip className="h-5 w-5" />
          </button>

          {/* Attach menu */}
          {showAttachMenu && (
            <div className="absolute bottom-12 left-0 flex flex-col gap-1 rounded-xl bg-card p-1.5 shadow-lg border border-border animate-in fade-in slide-in-from-bottom-2 duration-200">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-accent transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <ImageIcon className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">Photo</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-accent transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/50">
                  <Paperclip className="h-4 w-4 text-secondary-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground">File</span>
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

        <div className="relative flex-1">
          <MentionSuggestions
            users={users}
            query={mentionQuery}
            onSelect={handleMentionSelect}
            onClose={() => setShowMentions(false)}
            isOpen={showMentions}
          />
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Write a message..."
            rows={1}
            disabled={disabled}
            className={cn(
              "w-full resize-none rounded-2xl border border-border bg-background px-4 py-2.5 pr-10",
              "text-sm placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
              "transition-all duration-200",
              "overflow-hidden"
            )}
            style={{ maxHeight: '150px' }}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Smile className="h-5 w-5" />
          </button>
        </div>

        <button
          type="submit"
          disabled={!canSend || disabled}
          className={cn(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-all duration-200",
            canSend
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
