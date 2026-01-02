import { useState, useRef, useEffect } from "react";
import { Send, Smile, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };

  useEffect(() => {
    handleInput();
  }, [text]);

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 border-t border-border bg-card px-4 py-3"
    >
      <button
        type="button"
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full hover:bg-accent text-muted-foreground transition-colors"
      >
        <Paperclip className="h-5 w-5" />
      </button>

      <div className="relative flex-1">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a message..."
          rows={1}
          disabled={disabled}
          className={cn(
            "w-full resize-none rounded-2xl border border-border bg-background px-4 py-2.5 pr-10",
            "text-sm placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
            "transition-all duration-200",
            "max-h-[120px] overflow-y-auto",
            "scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none]"
          )}
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
        disabled={!text.trim() || disabled}
        className={cn(
          "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-all duration-200",
          text.trim()
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        )}
      >
        <Send className="h-5 w-5" />
      </button>
    </form>
  );
}
