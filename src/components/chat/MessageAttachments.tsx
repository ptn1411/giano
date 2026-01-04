import { FileText, Download, Image as ImageIcon } from "lucide-react";
import { Attachment } from "@/services/api/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface MessageAttachmentsProps {
  attachments: Attachment[];
  isOwn: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function MessageAttachments({ attachments, isOwn }: MessageAttachmentsProps) {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const images = attachments.filter((a) => a.type === 'image');
  const files = attachments.filter((a) => a.type === 'file');

  return (
    <>
      {/* Images grid */}
      {images.length > 0 && (
        <div className={cn(
          "grid gap-1 mt-1",
          images.length === 1 ? "grid-cols-1" : 
          images.length === 2 ? "grid-cols-2" : 
          "grid-cols-2"
        )}>
          {images.map((image, index) => (
            <button
              key={image.id}
              onClick={() => setLightboxImage(image.url)}
              className={cn(
                "relative overflow-hidden rounded-lg",
                images.length === 1 ? "max-w-[280px]" : "aspect-square",
                images.length === 3 && index === 0 && "col-span-2 aspect-video"
              )}
            >
              <img
                src={image.url}
                alt={image.name}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
              />
            </button>
          ))}
        </div>
      )}

      {/* Files list */}
      {files.length > 0 && (
        <div className="flex flex-col gap-1 mt-1">
          {files.map((file) => (
            <a
              key={file.id}
              href={file.url}
              download={file.name}
              className={cn(
                "flex items-center gap-2 rounded-lg p-2 transition-colors",
                isOwn 
                  ? "bg-primary-foreground/10 hover:bg-primary-foreground/20" 
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                isOwn ? "bg-primary-foreground/20" : "bg-background"
              )}>
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className={cn(
                  "text-xs",
                  isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>
                  {formatFileSize(file.size)}
                </p>
              </div>
              <Download className="h-4 w-4 flex-shrink-0 opacity-60" />
            </a>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 backdrop-blur-sm p-4"
          onClick={() => setLightboxImage(null)}
        >
          <img
            src={lightboxImage}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
