/**
 * Typing Indicator Hook
 * Manages sending typing events via WebSocket
 * Requirements: 6.6, 6.7
 */

import { useRef, useCallback, useEffect } from 'react';
import { wsClient } from '@/services/websocket';

const TYPING_DEBOUNCE_MS = 2000;

/**
 * Hook to manage typing indicator for a specific chat
 * Automatically sends start_typing when user types and stop_typing after debounce
 */
export function useTypingIndicator(chatId: string | null) {
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  /**
   * Send start_typing event
   * Requirement 6.6: Send start_typing when user starts typing
   */
  const sendStartTyping = useCallback(() => {
    if (!chatId || !wsClient.isConnected()) return;
    
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      wsClient.sendTyping(chatId, true);
    }
  }, [chatId]);

  /**
   * Send stop_typing event
   * Requirement 6.7: Send stop_typing when user stops typing
   */
  const sendStopTyping = useCallback(() => {
    if (!chatId || !wsClient.isConnected()) return;
    
    if (isTypingRef.current) {
      isTypingRef.current = false;
      wsClient.sendTyping(chatId, false);
    }
  }, [chatId]);

  /**
   * Call this when user types
   * Sends start_typing immediately and schedules stop_typing after debounce
   */
  const onType = useCallback(() => {
    // Send start_typing if not already typing
    sendStartTyping();

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to send stop_typing after debounce
    typingTimeoutRef.current = setTimeout(() => {
      sendStopTyping();
      typingTimeoutRef.current = null;
    }, TYPING_DEBOUNCE_MS);
  }, [sendStartTyping, sendStopTyping]);

  /**
   * Call this when user sends message or leaves chat
   * Immediately sends stop_typing
   */
  const stopTyping = useCallback(() => {
    // Clear any pending timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    
    // Send stop_typing
    sendStopTyping();
  }, [sendStopTyping]);

  // Cleanup on unmount or chatId change
  useEffect(() => {
    return () => {
      // Clear timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      
      // Send stop_typing if we were typing
      if (isTypingRef.current && chatId) {
        wsClient.sendTyping(chatId, false);
        isTypingRef.current = false;
      }
    };
  }, [chatId]);

  return {
    onType,
    stopTyping,
    isTyping: isTypingRef.current,
  };
}
