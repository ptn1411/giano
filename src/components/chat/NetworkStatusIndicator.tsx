import { WifiOff, Loader2 } from 'lucide-react';
import { useMessageQueueStore } from '@/stores/messageQueueStore';

export const NetworkStatusIndicator = () => {
  const { isOnline, queue, isProcessing } = useMessageQueueStore();

  if (isOnline && queue.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-muted/80 backdrop-blur-sm border-b border-border">
      {!isOnline ? (
        <>
          <WifiOff className="h-3.5 w-3.5 text-destructive" />
          <span className="text-destructive">Offline</span>
          {queue.length > 0 && (
            <span className="text-muted-foreground">
              • {queue.length} message{queue.length > 1 ? 's' : ''} queued
            </span>
          )}
        </>
      ) : isProcessing ? (
        <>
          <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
          <span className="text-primary">Sending queued messages...</span>
        </>
      ) : queue.length > 0 ? (
        <>
          <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
          <span className="text-muted-foreground">
            {queue.length} message{queue.length > 1 ? 's' : ''} pending
          </span>
        </>
      ) : null}
    </div>
  );
};
