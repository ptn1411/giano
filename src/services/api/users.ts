/**
 * Users API Service
 * Handles user-related API calls
 * Requirements: 3.1, 3.2
 */

import { apiClient, parseApiError } from './client';
import { User, UsersResponse, UserResponse } from './types';

// ============================================
// Users Service Interface
// ============================================

export interface UsersResult {
  users: User[];
  error: string | null;
}

export interface UserResult {
  user: User | null;
  error: string | null;
}

// ============================================
// Users API Service
// ============================================

export const usersService = {
  /**
   * Get all users
   * Requirement 3.1: Fetch users from GET /users
   */
  async getUsers(): Promise<UsersResult> {
    try {
      const response = await apiClient.get<UsersResponse>('/users');
      return { users: response.data.users, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { users: [], error: parsedError.message };
    }
  },

  /**
   * Get a single user by ID
   * Requirement 3.2: Fetch user details from GET /users/:userId
   */
  async getUser(userId: string): Promise<UserResult> {
    try {
      const response = await apiClient.get<UserResponse>(`/users/${userId}`);
      return { user: response.data.user, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { user: null, error: parsedError.message };
    }
  },

  /**
   * Search user by email
   * Returns user if found, null otherwise
   */
  async searchByEmail(email: string): Promise<UserResult> {
    try {
      const response = await apiClient.get<UserResponse>('/users/search', {
        params: { email },
      });
      return { user: response.data.user, error: null };
    } catch (error) {
      const parsedError = parseApiError(error);
      return { user: null, error: parsedError.message };
    }
  },
};

export default usersService;
