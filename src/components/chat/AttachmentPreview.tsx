import { X, FileText, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilePreview {
  id: string;
  file: File;
  type: 'image' | 'file';
  preview?: string;
  progress: number;
}

interface AttachmentPreviewProps {
  files: FilePreview[];
  onRemove: (id: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function AttachmentPreview({ files, onRemove }: AttachmentPreviewProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto p-2 border-t border-border bg-card/50">
      {files.map((file) => (
        <div
          key={file.id}
          className="relative flex-shrink-0 group"
        >
          {file.type === 'image' && file.preview ? (
            <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted">
              <img
                src={file.preview}
                alt={file.file.name}
                className="w-full h-full object-cover"
              />
              {/* Progress overlay */}
              {file.progress < 100 && (
                <div className="absolute inset-0 bg-foreground/50 flex items-center justify-center">
                  <div className="w-12 h-12 relative">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        strokeWidth="3"
                        className="stroke-primary/30"
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        strokeWidth="3"
                        strokeDasharray={`${file.progress * 0.88} 88`}
                        className="stroke-primary transition-all duration-200"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-primary-foreground">
                      {file.progress}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="relative w-32 h-20 rounded-lg bg-muted flex flex-col items-center justify-center p-2">
              <FileText className="h-6 w-6 text-muted-foreground mb-1" />
              <p className="text-xs text-foreground truncate w-full text-center font-medium">
                {file.file.name}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {formatFileSize(file.file.size)}
              </p>
              {/* Progress bar */}
              {file.progress < 100 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-border rounded-b-lg overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${file.progress}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Remove button */}
          <button
            onClick={() => onRemove(file.id)}
            className={cn(
              "absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground",
              "flex items-center justify-center shadow-md",
              "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
              "hover:bg-destructive/90"
            )}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
