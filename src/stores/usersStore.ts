import { create } from 'zustand';
import { User, chatApi } from '@/services/mockData';

interface UsersState {
  users: User[];
  loading: boolean;
  
  // Actions
  fetchUsers: () => Promise<void>;
  getUser: (userId: string) => User | undefined;
  updateUser: (userId: string, updates: Partial<User>) => void;
}

export const useUsersStore = create<UsersState>()((set, get) => ({
  users: [],
  loading: true,
  
  fetchUsers: async () => {
    set({ loading: true });
    try {
      const data = await chatApi.getUsers();
      set({ users: data });
    } finally {
      set({ loading: false });
    }
  },
  
  getUser: (userId: string) => {
    return get().users.find((user) => user.id === userId);
  },
  
  updateUser: (userId: string, updates: Partial<User>) => {
    set((state) => ({
      users: state.users.map((user) =>
        user.id === userId ? { ...user, ...updates } : user
      ),
    }));
  },
}));

// Selector hook for backward compatibility
export function useUsers() {
  const users = useUsersStore((state) => state.users);
  const loading = useUsersStore((state) => state.loading);
  
  return { users, loading };
}

export function useCurrentUser() {
  const users = useUsersStore((state) => state.users);
  return users.find((user) => user.id === 'user-1') || null;
}
