import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReplyPreviewProps {
  senderName: string;
  text: string;
  onCancel: () => void;
  isInBubble?: boolean;
  isOwn?: boolean;
}

export function ReplyPreview({ senderName, text, onCancel, isInBubble, isOwn }: ReplyPreviewProps) {
  if (isInBubble) {
    return (
      <div className={cn(
        "flex items-start gap-2 rounded-lg px-2.5 py-1.5 mb-1.5 border-l-2",
        isOwn 
          ? "bg-primary-foreground/10 border-primary-foreground/50" 
          : "bg-accent/50 border-primary"
      )}>
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-xs font-semibold truncate",
            isOwn ? "text-primary-foreground/90" : "text-primary"
          )}>
            {senderName}
          </p>
          <p className={cn(
            "text-xs truncate",
            isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
          )}>
            {text || "Photo"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-accent/50 border-l-4 border-primary animate-in slide-in-from-bottom-2 duration-200">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-primary truncate">
          Reply to {senderName}
        </p>
        <p className="text-sm text-muted-foreground truncate">
          {text || "Photo"}
        </p>
      </div>
      <button
        onClick={onCancel}
        className="flex-shrink-0 p-1 rounded-full hover:bg-accent transition-colors"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}
