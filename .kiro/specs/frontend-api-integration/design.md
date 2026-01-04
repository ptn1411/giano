# Design Document: Frontend API Integration

## Overview

Tài liệu này mô tả thiết kế chi tiết cho việc tích hợp Backend API (Rust/Axum) vào Frontend React của ứng dụng Chat. Thiết kế tập trung vào việc thay thế mock data bằng real API calls trong khi giữ nguyên cấu trúc Zustand stores hiện có.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    React Components                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  Auth    │ │  Chat    │ │ Message  │ │ Settings │           │
│  │  Pages   │ │  Area    │ │  List    │ │  Page    │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
└───────┼────────────┼────────────┼────────────┼──────────────────┘
        │            │            │            │
┌───────┼────────────┼────────────┼────────────┼──────────────────┐
│       ▼            ▼            ▼            ▼                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  Auth    │ │  Chats   │ │ Messages │ │ Settings │           │
│  │  Store   │ │  Store   │ │  Store   │ │  Store   │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
│       │            │            │            │    Zustand       │
└───────┼────────────┼────────────┼────────────┼──────────────────┘
        │            │            │            │
┌───────┼────────────┼────────────┼────────────┼──────────────────┐
│       ▼            ▼            ▼            ▼                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    API Services Layer                    │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │   │
│  │  │  auth    │ │  chats   │ │ messages │ │ settings │    │   │
│  │  │ Service  │ │ Service  │ │ Service  │ │ Service  │    │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌───────────────────────────┼───────────────────────────────┐ │
│  │                    API Client                              │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                   │ │
│  │  │  Axios   │ │ Intercep │ │  Error   │                   │ │
│  │  │ Instance │ │  -tors   │ │ Handler  │                   │ │
│  │  └──────────┘ └──────────┘ └──────────┘                   │ │
│  └───────────────────────────┼───────────────────────────────┘ │
│                              │                   Services      │
└──────────────────────────────┼──────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────┐
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  WebSocket Client                        │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                 │   │
│  │  │ Connect  │ │  Event   │ │ Reconnect│                 │   │
│  │  │ Manager  │ │ Handlers │ │  Logic   │                 │   │
│  │  └──────────┘ └──────────┘ └──────────┘                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                   Real-time    │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend API (Rust/Axum)                       │
│                    wss://api/ws | https://api/v1                 │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. API Client (`src/services/api/client.ts`)

Centralized HTTP client sử dụng Axios với authentication và error handling.

```typescript
interface ApiClientConfig {
  baseURL: string;
  timeout: number;
}

interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

interface ApiResponse<T> {
  data: T;
  error?: ApiError;
}

// Axios instance với interceptors
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add JWT token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth and redirect to login
      localStorage.removeItem('auth_token');
      window.location.href = '/auth';
    }
    return Promise.reject(error);
  }
);
```

### 2. Auth Service (`src/services/api/auth.ts`)

```typescript
interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

interface AuthResponse {
  session: {
    user: User;
    token: string;
    expiresAt: number;
  };
}

const authService = {
  login: (data: LoginRequest) => 
    apiClient.post<AuthResponse>('/auth/login', data),
  
  register: (data: RegisterRequest) => 
    apiClient.post<AuthResponse>('/auth/register', data),
  
  logout: () => 
    apiClient.post('/auth/logout'),
  
  getSession: () => 
    apiClient.get<AuthResponse>('/auth/session'),
};
```

### 3. Chat Service (`src/services/api/chats.ts`)

```typescript
interface ChatsResponse {
  chats: Chat[];
}

interface ChatResponse {
  chat: Chat;
}

interface CreateGroupRequest {
  name: string;
  participantIds: string[];
}

const chatService = {
  getChats: (search?: string) => 
    apiClient.get<ChatsResponse>('/chats', { params: { search } }),
  
  getChat: (chatId: string) => 
    apiClient.get<ChatResponse>(`/chats/${chatId}`),
  
  createGroup: (data: CreateGroupRequest) => 
    apiClient.post<ChatResponse>('/chats/group', data),
  
  markAsRead: (chatId: string) => 
    apiClient.post(`/chats/${chatId}/read`),
};
```

### 4. Message Service (`src/services/api/messages.ts`)

```typescript
interface MessagesResponse {
  messages: Message[];
  hasMore: boolean;
}

interface MessageResponse {
  message: Message;
}

interface SendMessageRequest {
  text: string;
  attachments?: Attachment[];
  replyTo?: ReplyTo;
}

const messageService = {
  getMessages: (chatId: string, before?: string, limit?: number) =>
    apiClient.get<MessagesResponse>(`/chats/${chatId}/messages`, {
      params: { before, limit },
    }),
  
  sendMessage: (chatId: string, data: SendMessageRequest) =>
    apiClient.post<MessageResponse>(`/chats/${chatId}/messages`, data),
  
  editMessage: (chatId: string, messageId: string, text: string) =>
    apiClient.put<MessageResponse>(`/chats/${chatId}/messages/${messageId}`, { text }),
  
  deleteMessage: (chatId: string, messageId: string) =>
    apiClient.delete(`/chats/${chatId}/messages/${messageId}`),
  
  addReaction: (chatId: string, messageId: string, emoji: string) =>
    apiClient.post<MessageResponse>(`/chats/${chatId}/messages/${messageId}/reactions`, { emoji }),
  
  pinMessage: (chatId: string, messageId: string) =>
    apiClient.post<MessageResponse>(`/chats/${chatId}/messages/${messageId}/pin`),
  
  unpinMessage: (chatId: string, messageId: string) =>
    apiClient.delete(`/chats/${chatId}/messages/${messageId}/pin`),
};
```

### 5. WebSocket Client (`src/services/websocket.ts`)

```typescript
type WebSocketEvent = 
  | { event: 'new_message'; data: { message: Message } }
  | { event: 'typing'; data: { chatId: string; userId: string; userName: string; isTyping: boolean } }
  | { event: 'user_status'; data: { userId: string; status: string; lastSeen?: string } }
  | { event: 'message_status'; data: { chatId: string; messageId: string; status: DeliveryStatus } }
  | { event: 'message_read'; data: { chatId: string; messageId: string; readBy: ReadReceipt } };

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private handlers: Map<string, Set<(data: unknown) => void>> = new Map();

  connect(token: string): void {
    const wsUrl = `${import.meta.env.VITE_WS_URL || 'ws://localhost:8080'}/ws?token=${token}`;
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
    };
    
    this.ws.onmessage = (event) => {
      const { event: eventType, data } = JSON.parse(event.data);
      this.emit(eventType, data);
    };
    
    this.ws.onclose = () => {
      this.attemptReconnect(token);
    };
  }

  private attemptReconnect(token: string): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.reconnectDelay *= 2; // Exponential backoff
        this.connect(token);
      }, this.reconnectDelay);
    }
  }

  on(event: string, handler: (data: unknown) => void): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }

  private emit(event: string, data: unknown): void {
    this.handlers.get(event)?.forEach(handler => handler(data));
  }

  send(event: string, data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data }));
    }
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}

export const wsClient = new WebSocketClient();
```

### 6. Upload Service (`src/services/api/upload.ts`)

```typescript
interface UploadResponse {
  attachment: Attachment;
}

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

const uploadService = {
  uploadFile: (
    file: File, 
    type: 'image' | 'file',
    onProgress?: (progress: UploadProgress) => void
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    return apiClient.post<UploadResponse>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          onProgress({
            loaded: progressEvent.loaded,
            total: progressEvent.total,
            percentage: Math.round((progressEvent.loaded * 100) / progressEvent.total),
          });
        }
      },
    });
  },
};
```

## Data Models

### Updated TypeScript Interfaces

```typescript
// User (matches backend response)
interface User {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline' | 'away';
  lastSeen?: string; // ISO date string from API
  isBot: boolean;
}

// Chat (matches backend response)
interface Chat {
  id: string;
  type: 'private' | 'group' | 'bot';
  name: string;
  avatar: string;
  participants: string[];
  lastMessage?: Message;
  unreadCount: number;
  isTyping?: boolean;
  typingUser?: string;
  isBot?: boolean;
}

// Message (matches backend response)
interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  timestamp: string; // ISO date string from API
  isRead: boolean;
  isEdited?: boolean;
  isPinned?: boolean;
  reactions: Reaction[];
  attachments?: Attachment[];
  replyTo?: ReplyTo;
  inlineKeyboard?: InlineButton[][];
  readBy?: ReadReceipt[];
  deliveryStatus: DeliveryStatus;
}

// Attachment
interface Attachment {
  id: string;
  type: 'image' | 'file' | 'voice';
  name: string;
  size: number;
  url: string;
  mimeType: string;
  duration?: number;
}

// Session
interface AuthSession {
  user: {
    id: string;
    email: string;
    name: string;
    avatar: string;
    phone?: string;
  };
  token: string;
  expiresAt: number;
}
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system.*

### Property 1: JWT Token Inclusion
*For any* authenticated API request made by the API_Client, the request headers SHALL contain an Authorization header with the format "Bearer {token}" where token is the stored JWT token.
**Validates: Requirements 1.1**

### Property 2: WebSocket Event Store Updates
*For any* WebSocket event received (new_message, typing, user_status, message_status), the corresponding Zustand store SHALL be updated with the event data within the same event loop cycle.
**Validates: Requirements 3.3, 4.6, 5.8, 6.2, 6.3, 6.4, 6.5**

### Property 3: User Data Caching
*For any* user data request, if the user data exists in the store cache and is less than 5 minutes old, the store SHALL return cached data without making an API call.
**Validates: Requirements 3.4**

### Property 4: Message Pagination Consistency
*For any* sequence of paginated message requests with "before" parameter, the returned messages SHALL be ordered by timestamp descending and SHALL NOT contain duplicates across pages.
**Validates: Requirements 5.7**

### Property 5: WebSocket Reconnection Backoff
*For any* WebSocket disconnection, the reconnection attempts SHALL follow exponential backoff pattern where delay(n) = initialDelay * 2^(n-1) for attempt n, up to maxAttempts.
**Validates: Requirements 6.8**

### Property 6: Optimistic Update Consistency
*For any* optimistic update operation (send message, add reaction), if the API call fails, the store state SHALL be rolled back to the state before the optimistic update was applied.
**Validates: Requirements 9.4, 9.5**

---

## Error Handling

### API Error Handling

```typescript
// Error types from backend
interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Error handler utility
const handleApiError = (error: AxiosError<{ error: ApiError }>) => {
  const apiError = error.response?.data?.error;
  
  switch (error.response?.status) {
    case 400:
      return { type: 'validation', message: apiError?.message || 'Invalid request' };
    case 401:
      // Handled by interceptor - redirect to login
      return { type: 'auth', message: 'Session expired' };
    case 403:
      return { type: 'forbidden', message: 'Access denied' };
    case 404:
      return { type: 'not_found', message: 'Resource not found' };
    case 429:
      return { type: 'rate_limit', message: 'Too many requests' };
    default:
      return { type: 'server', message: 'Server error' };
  }
};
```

### WebSocket Error Handling

```typescript
// Connection states
type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

// Reconnection with exponential backoff
const reconnect = (attempt: number) => {
  const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30s
  setTimeout(() => connect(), delay);
};
```

---

## Testing Strategy

### Unit Tests
- Test API service methods with mocked axios
- Test store actions and state updates
- Test WebSocket event handlers
- Test error handling logic

### Integration Tests
- Test full authentication flow (register → login → logout)
- Test chat operations (fetch → send message → receive via WebSocket)
- Test file upload flow

### Property-Based Tests
- Test JWT token inclusion across random API calls
- Test WebSocket event handling with random event sequences
- Test pagination consistency with random message sets
- Test optimistic update rollback with random failure scenarios

### Testing Framework
- Vitest for unit and integration tests
- fast-check for property-based testing
- MSW (Mock Service Worker) for API mocking
- Testing Library for component tests

---

## Migration Strategy

### Phase 1: API Client Setup
1. Create API client with interceptors
2. Add environment variables for API URL
3. Keep mock data as fallback

### Phase 2: Auth Integration
1. Update authStore to use real API
2. Implement session persistence
3. Add WebSocket connection on auth

### Phase 3: Data Integration
1. Update chatsStore to use real API
2. Update messagesStore to use real API
3. Update usersStore to use real API

### Phase 4: Real-time Integration
1. Implement WebSocket client
2. Connect WebSocket events to stores
3. Add typing indicators

### Phase 5: Settings Integration
1. Create settingsStore
2. Implement all settings endpoints
3. Add device management

### Phase 6: Cleanup
1. Remove mock data files
2. Update tests
3. Documentation

---

## Environment Configuration

```env
# .env.local
VITE_API_URL=http://localhost:8080/v1
VITE_WS_URL=ws://localhost:8080

# .env.production
VITE_API_URL=https://api.example.com/v1
VITE_WS_URL=wss://api.example.com
```
