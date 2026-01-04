/**
 * Users Store
 * Manages user data with caching support
 * Requirements: 3.1-3.4
 */

import { create } from 'zustand';
import { usersService, User, UserStatus } from '@/services/api';

// ============================================
// Constants
// ============================================

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes in milliseconds

// ============================================
// Types
// ============================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface UsersState {
  users: User[];
  userCache: Map<string, CacheEntry<User>>;
  loading: boolean;
  error: string | null;
  lastFetchTimestamp: number | null;

  // Actions
  fetchUsers: (forceRefresh?: boolean) => Promise<void>;
  getUser: (userId: string) => User | undefined;
  fetchUser: (userId: string, forceRefresh?: boolean) => Promise<User | null>;
  updateUser: (userId: string, updates: Partial<User>) => void;
  updateUserStatus: (userId: string, status: UserStatus, lastSeen?: string) => void;
  clearCache: () => void;
}

// ============================================
// Cache Helpers
// ============================================

/**
 * Check if a cache entry is still valid
 */
const isCacheValid = (timestamp: number | null): boolean => {
  if (!timestamp) return false;
  return Date.now() - timestamp < CACHE_TTL_MS;
};

// ============================================
// Store Implementation
// ============================================

export const useUsersStore = create<UsersState>()((set, get) => ({
  users: [],
  userCache: new Map(),
  loading: false,
  error: null,
  lastFetchTimestamp: null,

  /**
   * Fetch all users from API
   * Requirement 3.1: Fetch users from GET /users
   * Requirement 3.4: Cache user data to minimize API calls
   */
  fetchUsers: async (forceRefresh = false) => {
    const state = get();

    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && isCacheValid(state.lastFetchTimestamp) && state.users.length > 0) {
      return;
    }

    set({ loading: true, error: null });

    try {
      const result = await usersService.getUsers();

      if (result.error) {
        set({ error: result.error, loading: false });
        return;
      }

      // Update users and cache timestamp
      set({
        users: result.users,
        loading: false,
        lastFetchTimestamp: Date.now(),
      });

      // Also update individual user cache entries
      const userCache = new Map(get().userCache);
      const now = Date.now();
      result.users.forEach((user) => {
        userCache.set(user.id, { data: user, timestamp: now });
      });
      set({ userCache });
    } catch (error) {
      set({
        error: 'Failed to fetch users',
        loading: false,
      });
    }
  },

  /**
   * Get user from local state (synchronous)
   */
  getUser: (userId: string) => {
    return get().users.find((user) => user.id === userId);
  },

  /**
   * Fetch a single user from API
   * Requirement 3.2: Fetch user details from GET /users/:userId
   * Requirement 3.4: Cache user data to minimize API calls
   */
  fetchUser: async (userId: string, forceRefresh = false) => {
    const state = get();

    // Check cache first
    if (!forceRefresh) {
      const cached = state.userCache.get(userId);
      if (cached && isCacheValid(cached.timestamp)) {
        return cached.data;
      }
    }

    try {
      const result = await usersService.getUser(userId);

      if (result.error || !result.user) {
        return null;
      }

      // Update cache
      const userCache = new Map(get().userCache);
      userCache.set(userId, { data: result.user, timestamp: Date.now() });

      // Also update users array if user exists there
      set((state) => ({
        userCache,
        users: state.users.map((u) =>
          u.id === userId ? result.user! : u
        ),
      }));

      return result.user;
    } catch (error) {
      return null;
    }
  },

  /**
   * Update user in local state
   */
  updateUser: (userId: string, updates: Partial<User>) => {
    set((state) => {
      const updatedUsers = state.users.map((user) =>
        user.id === userId ? { ...user, ...updates } : user
      );

      // Also update cache
      const userCache = new Map(state.userCache);
      const cached = userCache.get(userId);
      if (cached) {
        userCache.set(userId, {
          data: { ...cached.data, ...updates },
          timestamp: cached.timestamp,
        });
      }

      return { users: updatedUsers, userCache };
    });
  },

  /**
   * Update user online/offline status from WebSocket events
   * Requirement 3.3: Update user online/offline status from WebSocket events
   */
  updateUserStatus: (userId: string, status: UserStatus, lastSeen?: string) => {
    const updates: Partial<User> = { status };
    if (lastSeen) {
      updates.lastSeen = lastSeen;
    }
    get().updateUser(userId, updates);
  },

  /**
   * Clear all cached data
   */
  clearCache: () => {
    set({
      userCache: new Map(),
      lastFetchTimestamp: null,
    });
  },
}));

// ============================================
// Selectors
// ============================================

const selectUsers = (state: UsersState) => state.users;
const selectLoading = (state: UsersState) => state.loading;
const selectError = (state: UsersState) => state.error;

// ============================================
// Selector Hooks
// ============================================

/**
 * Hook for backward compatibility
 */
export function useUsers() {
  const users = useUsersStore(selectUsers);
  const loading = useUsersStore(selectLoading);
  const error = useUsersStore(selectError);

  return { users, loading, error };
}

/**
 * Get current user (user-1 for now, will be updated with auth integration)
 */
export function useCurrentUser() {
  const users = useUsersStore(selectUsers);
  return users.find((user) => user.id === 'user-1') || null;
}
