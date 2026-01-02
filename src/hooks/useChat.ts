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

// Re-export useMessages from messagesStore for backward compatibility
export { useMessages } from '@/stores/messagesStore';

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
