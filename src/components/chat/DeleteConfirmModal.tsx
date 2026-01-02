import { X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  messagePreview: string;
}

export function DeleteConfirmModal({ isOpen, onClose, onConfirm, messagePreview }: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-sm mx-4 bg-card rounded-2xl shadow-xl animate-scale-in">
        {/* Header */}
        <div className="flex flex-col items-center px-6 pt-6 pb-4">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Delete Message?</h2>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            This action cannot be undone.
          </p>
        </div>

        {/* Message Preview */}
        <div className="mx-6 mb-4 px-3 py-2 bg-accent/50 rounded-lg">
          <p className="text-sm text-foreground line-clamp-2">
            {messagePreview || "This message"}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-border hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
