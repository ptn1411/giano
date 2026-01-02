import { useState, useEffect } from 'react';
import { User, chatApi } from '@/services/mockData';

// Re-export useChats from chatsStore for backward compatibility
export { useChats } from '@/stores/chatsStore';

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
