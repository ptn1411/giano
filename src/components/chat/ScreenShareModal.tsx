import { useState } from "react";
import { Monitor, Square, Maximize2, Minimize2, X, Mic, MicOff, MousePointer2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ScreenShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSharing: boolean;
  sharerName: string;
  sharerAvatar: string;
  onStartSharing?: () => void;
  onStopSharing?: () => void;
}

export function ScreenShareModal({
  open,
  onOpenChange,
  isSharing,
  sharerName,
  sharerAvatar,
  onStartSharing,
  onStopSharing,
}: ScreenShareModalProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<'screen' | 'window' | 'tab' | null>(null);

  const handleStartShare = () => {
    onStartSharing?.();
  };

  const handleStopShare = () => {
    onStopSharing?.();
    setSelectedSource(null);
  };

  const sources = [
    { id: 'screen' as const, name: 'Entire Screen', icon: Monitor, description: 'Share your entire screen' },
    { id: 'window' as const, name: 'Application Window', icon: Square, description: 'Share a specific app' },
    { id: 'tab' as const, name: 'Browser Tab', icon: Monitor, description: 'Share a browser tab' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "p-0 gap-0 overflow-hidden bg-card border-border transition-all duration-300",
        isFullscreen ? "sm:max-w-[95vw] sm:max-h-[95vh]" : "sm:max-w-2xl"
      )}>
        {!isSharing ? (
          // Source Selection View
          <>
            <DialogHeader className="p-6 pb-4 border-b border-border">
              <DialogTitle className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Monitor className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Share Your Screen</h2>
                  <p className="text-sm text-muted-foreground font-normal">Choose what you want to share</p>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="p-6 space-y-4">
              {sources.map((source) => (
                <button
                  key={source.id}
                  onClick={() => setSelectedSource(source.id)}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-lg border transition-all",
                    selectedSource === source.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-accent/50"
                  )}
                >
                  <div className={cn(
                    "h-12 w-12 rounded-lg flex items-center justify-center",
                    selectedSource === source.id ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    <source.icon className="h-6 w-6" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-foreground">{source.name}</p>
                    <p className="text-sm text-muted-foreground">{source.description}</p>
                  </div>
                </button>
              ))}

              <div className="flex items-center gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={!selectedSource}
                  onClick={handleStartShare}
                >
                  <Monitor className="h-4 w-4 mr-2" />
                  Start Sharing
                </Button>
              </div>
            </div>
          </>
        ) : (
          // Active Screen Share View
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={sharerAvatar} alt={sharerName} />
                  <AvatarFallback>{sharerName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-foreground">{sharerName}'s screen</p>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-muted-foreground">Sharing</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="h-8 w-8 rounded-full hover:bg-accent flex items-center justify-center text-muted-foreground"
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => onOpenChange(false)}
                  className="h-8 w-8 rounded-full hover:bg-accent flex items-center justify-center text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Screen Content */}
            <div className={cn(
              "relative bg-gradient-to-br from-muted to-background flex items-center justify-center",
              isFullscreen ? "aspect-video" : "aspect-video max-h-[400px]"
            )}>
              {/* Placeholder Screen */}
              <div className="absolute inset-4 rounded-lg border border-border bg-background shadow-lg overflow-hidden">
                {/* Fake browser chrome */}
                <div className="h-8 bg-muted border-b border-border flex items-center px-3 gap-2">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-400" />
                    <div className="h-3 w-3 rounded-full bg-yellow-400" />
                    <div className="h-3 w-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 mx-8">
                    <div className="h-5 bg-background rounded-full" />
                  </div>
                </div>
                {/* Fake content */}
                <div className="p-4 space-y-3">
                  <div className="h-6 w-1/3 bg-muted rounded" />
                  <div className="h-4 w-full bg-muted/50 rounded" />
                  <div className="h-4 w-2/3 bg-muted/50 rounded" />
                  <div className="h-32 w-full bg-muted/30 rounded-lg mt-4" />
                </div>
              </div>

              {/* Mouse cursor indicator */}
              <div className="absolute bottom-1/3 right-1/3">
                <MousePointer2 className="h-6 w-6 text-primary drop-shadow-lg animate-pulse" />
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 py-4 border-t border-border bg-muted/30">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={cn(
                  "h-12 w-12 rounded-full flex items-center justify-center transition-all",
                  isMuted 
                    ? "bg-destructive text-destructive-foreground" 
                    : "bg-accent hover:bg-accent/80 text-foreground"
                )}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>

              <button
                onClick={handleStopShare}
                className="h-12 px-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center gap-2 hover:bg-destructive/90 transition-all"
              >
                <Square className="h-5 w-5" />
                <span className="font-medium">Stop Sharing</span>
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
