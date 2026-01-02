import { useState, useEffect, useCallback } from 'react';
import { Chat, Message, User, Attachment, chatApi } from '@/services/mockData';

export function useChats() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await chatApi.getChats();
      setChats(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchChats = useCallback(async (query: string) => {
    if (!query.trim()) {
      fetchChats();
      return;
    }
    setLoading(true);
    try {
      const data = await chatApi.searchChats(query);
      setChats(data);
    } finally {
      setLoading(false);
    }
  }, [fetchChats]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  return { chats, loading, refetch: fetchChats, searchChats };
}

export function useMessages(chatId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);
    try {
      const data = await chatApi.getMessages(chatId);
      setMessages(data);
      await chatApi.markAsRead(chatId);
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  const sendMessage = useCallback(async (text: string, attachments?: Attachment[], replyTo?: Message['replyTo']) => {
    if (!chatId || (!text.trim() && (!attachments || attachments.length === 0))) return;
    const newMessage = await chatApi.sendMessage(chatId, text, attachments, replyTo);
    setMessages((prev) => [...prev, newMessage]);
    return newMessage;
  }, [chatId]);

  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!chatId) return;
    await chatApi.addReaction(messageId, chatId, emoji);
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId) {
          const existingReaction = msg.reactions.find(
            (r) => r.userId === 'user-1' && r.emoji === emoji
          );
          if (existingReaction) {
            return {
              ...msg,
              reactions: msg.reactions.filter(
                (r) => !(r.userId === 'user-1' && r.emoji === emoji)
              ),
            };
          } else {
            return {
              ...msg,
              reactions: [...msg.reactions, { emoji, userId: 'user-1' }],
            };
          }
        }
        return msg;
      })
    );
  }, [chatId]);

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!chatId) return;
    await chatApi.deleteMessage(chatId, messageId);
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
  }, [chatId]);

  const editMessage = useCallback(async (messageId: string, newText: string) => {
    if (!chatId) return;
    const updated = await chatApi.editMessage(chatId, messageId, newText);
    if (updated) {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, text: newText, isEdited: true } : msg))
      );
    }
  }, [chatId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  return { messages, loading, sendMessage, addReaction, deleteMessage, editMessage, refetch: fetchMessages };
}

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await chatApi.getUsers();
        setUsers(data);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return { users, loading };
}

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const data = await chatApi.getUser('user-1');
      setUser(data || null);
    };
    fetch();
  }, []);

  return user;
}
