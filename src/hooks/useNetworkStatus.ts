import { useEffect, useCallback } from 'react';
import { useMessageQueueStore } from '@/stores/messageQueueStore';
import { useMessagesStore } from '@/stores/messagesStore';
import { toast } from 'sonner';

export const useNetworkStatus = () => {
  const { isOnline, setOnline, queue, removeFromQueue, setProcessing, isProcessing } = useMessageQueueStore();
  const { sendMessage, updateMessageStatus } = useMessagesStore();

  const processQueue = useCallback(async () => {
    if (isProcessing || queue.length === 0) return;
    
    setProcessing(true);
    
    for (const queuedMessage of queue) {
      try {
        const result = await sendMessage(
          queuedMessage.chatId,
          queuedMessage.text,
          queuedMessage.attachments,
          queuedMessage.replyTo
        );
        
        if (result) {
          removeFromQueue(queuedMessage.id);
        }
      } catch (error) {
        console.error('Failed to send queued message:', error);
      }
    }
    
    setProcessing(false);
    
    if (queue.length > 0) {
      toast.success(`Sent ${queue.length} queued message(s)`);
    }
  }, [isProcessing, queue, sendMessage, removeFromQueue, setProcessing]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      toast.success('Back online');
      // Process queued messages when back online
      processQueue();
    };

    const handleOffline = () => {
      setOnline(false);
      toast.error('You are offline. Messages will be queued.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    setOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline, processQueue]);

  // Process queue when coming back online
  useEffect(() => {
    if (isOnline && queue.length > 0 && !isProcessing) {
      processQueue();
    }
  }, [isOnline, queue.length, isProcessing, processQueue]);

  return { isOnline, queueLength: queue.length, isProcessing };
};
