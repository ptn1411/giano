import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Attachment, Message } from '@/services/mockData';

export interface QueuedMessage {
  id: string;
  chatId: string;
  text: string;
  attachments?: Attachment[];
  replyTo?: Message['replyTo'];
  timestamp: Date;
  retryCount: number;
}

interface MessageQueueState {
  queue: QueuedMessage[];
  isOnline: boolean;
  isProcessing: boolean;
  
  // Actions
  addToQueue: (message: Omit<QueuedMessage, 'id' | 'timestamp' | 'retryCount'>) => string;
  removeFromQueue: (id: string) => void;
  incrementRetry: (id: string) => void;
  setOnline: (online: boolean) => void;
  setProcessing: (processing: boolean) => void;
  getQueuedMessages: (chatId: string) => QueuedMessage[];
  clearQueue: () => void;
}

export const useMessageQueueStore = create<MessageQueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isProcessing: false,

      addToQueue: (message) => {
        const id = `queued-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const queuedMessage: QueuedMessage = {
          ...message,
          id,
          timestamp: new Date(),
          retryCount: 0,
        };
        
        set((state) => ({
          queue: [...state.queue, queuedMessage],
        }));
        
        return id;
      },

      removeFromQueue: (id) => {
        set((state) => ({
          queue: state.queue.filter((m) => m.id !== id),
        }));
      },

      incrementRetry: (id) => {
        set((state) => ({
          queue: state.queue.map((m) =>
            m.id === id ? { ...m, retryCount: m.retryCount + 1 } : m
          ),
        }));
      },

      setOnline: (online) => {
        set({ isOnline: online });
      },

      setProcessing: (processing) => {
        set({ isProcessing: processing });
      },

      getQueuedMessages: (chatId) => {
        return get().queue.filter((m) => m.chatId === chatId);
      },

      clearQueue: () => {
        set({ queue: [] });
      },
    }),
    {
      name: 'message-queue',
      partialize: (state) => ({ queue: state.queue }),
    }
  )
);
