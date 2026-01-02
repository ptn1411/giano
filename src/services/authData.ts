// Mock Auth Data
export interface AuthUser {
  id: string;
  email: string;
  password: string;
  name: string;
  avatar: string;
  phone?: string;
}

// Sample users for demo
export const mockAuthUsers: AuthUser[] = [
  {
    id: 'user-1',
    email: 'demo@example.com',
    password: 'demo123',
    name: 'Demo User',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Demo',
    phone: '+1 234 567 890',
  },
  {
    id: 'user-2',
    email: 'alice@example.com',
    password: 'alice123',
    name: 'Alice Johnson',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
    phone: '+1 987 654 321',
  },
  {
    id: 'user-3',
    email: 'test@test.com',
    password: 'test123',
    name: 'Test User',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Test',
  },
];

// Simulated delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Auth storage key
const AUTH_STORAGE_KEY = 'telegram_chat_auth';

export interface AuthSession {
  user: Omit<AuthUser, 'password'>;
  token: string;
  expiresAt: number;
}

// Mock Auth API
export const authApi = {
  async login(email: string, password: string): Promise<{ session: AuthSession | null; error: string | null }> {
    await delay(800);
    
    const user = mockAuthUsers.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    
    if (!user) {
      return { session: null, error: 'Invalid email or password' };
    }
    
    const { password: _, ...userWithoutPassword } = user;
    const session: AuthSession = {
      user: userWithoutPassword,
      token: `mock-token-${Date.now()}`,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    };
    
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    return { session, error: null };
  },
  
  async signup(email: string, password: string, name: string): Promise<{ session: AuthSession | null; error: string | null }> {
    await delay(1000);
    
    // Check if email already exists
    const existingUser = mockAuthUsers.find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
    
    if (existingUser) {
      return { session: null, error: 'An account with this email already exists' };
    }
    
    // Validate password
    if (password.length < 6) {
      return { session: null, error: 'Password must be at least 6 characters' };
    }
    
    // Create new user
    const newUser: AuthUser = {
      id: `user-${Date.now()}`,
      email,
      password,
      name,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
    };
    
    // Add to mock users (in memory only)
    mockAuthUsers.push(newUser);
    
    const { password: _, ...userWithoutPassword } = newUser;
    const session: AuthSession = {
      user: userWithoutPassword,
      token: `mock-token-${Date.now()}`,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };
    
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    return { session, error: null };
  },
  
  async logout(): Promise<void> {
    await delay(300);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  },
  
  async getSession(): Promise<AuthSession | null> {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    
    try {
      const session: AuthSession = JSON.parse(stored);
      if (session.expiresAt < Date.now()) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },
  
  async updateProfile(updates: Partial<Omit<AuthUser, 'id' | 'password'>>): Promise<AuthSession | null> {
    await delay(500);
    const session = await this.getSession();
    if (!session) return null;
    
    const updatedUser = { ...session.user, ...updates };
    const updatedSession: AuthSession = { ...session, user: updatedUser };
    
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedSession));
    return updatedSession;
  },
};
