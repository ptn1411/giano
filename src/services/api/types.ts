/**
 * API Types and Interfaces
 * Defines all types for API requests, responses, and data models
 * Requirements: 1.1-1.5
 */

// ============================================
// Error Types
// ============================================

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  error: ApiError;
}

export type ErrorType =
  | "validation"
  | "auth"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "server"
  | "network";

export interface ParsedError {
  type: ErrorType;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

// ============================================
// Generic API Response Types
// ============================================

export interface ApiResponse<T> {
  data: T;
  error?: ApiError;
}

// ============================================
// User Types
// ============================================

export type UserStatus = "online" | "offline" | "away";

export interface User {
  id: string;
  name: string;
  avatar: string;
  status: UserStatus;
  lastSeen?: string;
  isBot: boolean;
  email?: string;
  phone?: string;
  bio?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar: string;
  phone?: string;
}

// ============================================
// Auth Types
// ============================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
  expiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
}

export interface AuthResponse {
  session: AuthSession;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// ============================================
// Chat Types
// ============================================

export type ChatType = "private" | "group" | "bot";

export interface Chat {
  id: string;
  type: ChatType;
  name: string;
  avatar: string;
  participants: string[];
  lastMessage?: Message;
  unreadCount: number;
  isTyping?: boolean;
  typingUser?: string;
  isBot?: boolean;
  isPinned: boolean;
}

export interface ChatsResponse {
  chats: Chat[];
}

export interface ChatResponse {
  chat: Chat;
}

export interface CreateGroupRequest {
  name: string;
  participantIds: string[];
}

// ============================================
// Message Types
// ============================================

export type DeliveryStatus =
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export interface Reaction {
  emoji: string;
  userId: string;
  userName: string;
}

export interface Attachment {
  id: string;
  type: "image" | "file" | "voice";
  name: string;
  size: number;
  url: string;
  mimeType: string;
  duration?: number;
}

export interface ReplyTo {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
}

export interface ReadReceipt {
  oderId: string;
  readAt: string;
}

export interface InlineButton {
  text: string;
  callbackData?: string;
  url?: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  /** Type of sender: 'user' or 'bot' */
  senderType?: "user" | "bot";
  text: string;
  timestamp: string;
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

export interface MessagesResponse {
  messages: Message[];
  hasMore: boolean;
}

export interface MessageResponse {
  message: Message;
}

export interface SendMessageRequest {
  text: string;
  attachments?: Attachment[];
  replyTo?: ReplyTo;
}

export interface EditMessageRequest {
  text: string;
}

export interface AddReactionRequest {
  emoji: string;
}

// ============================================
// Users Types
// ============================================

export interface UsersResponse {
  users: User[];
}

export interface UserResponse {
  user: User;
}

// ============================================
// Upload Types
// ============================================

export interface UploadResponse {
  attachment: Attachment;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

// ============================================
// Settings Types
// ============================================

export interface ProfileSettings {
  name: string;
  bio?: string;
  avatar?: string;
  phone?: string;
}

export interface PrivacySettings {
  lastSeen: "everyone" | "contacts" | "nobody";
  profilePhoto: "everyone" | "contacts" | "nobody";
  onlineStatus: "everyone" | "contacts" | "nobody";
  readReceipts: boolean;
}

export interface NotificationSettings {
  messages: boolean;
  groups: boolean;
  mentions: boolean;
  sound: boolean;
  preview: boolean;
}

export interface AppearanceSettings {
  theme: "light" | "dark" | "system";
  fontSize: "small" | "medium" | "large";
  chatBackground?: string;
}

export interface Device {
  id: string;
  name: string;
  type: "desktop" | "mobile" | "tablet";
  lastActive: string;
  isCurrent: boolean;
}

export interface DevicesResponse {
  devices: Device[];
}

// ============================================
// WebSocket Event Types
// ============================================

export interface NewMessageEvent {
  message: Message;
}

export interface MessageUpdatedEvent {
  message: Message;
}

export interface MessageDeletedEvent {
  chatId: string;
  messageId: string;
}

export interface MessagePinnedEvent {
  chatId: string;
  messageId: string;
  isPinned: boolean;
}

export interface ReactionUpdatedEvent {
  message: Message;
}

export interface TypingEvent {
  chatId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

export interface UserStatusEvent {
  userId: string;
  status: UserStatus;
  lastSeen?: string;
}

export interface MessageStatusEvent {
  chatId: string;
  messageId: string;
  status: DeliveryStatus;
}

export interface MessageReadEvent {
  chatId: string;
  messageId: string;
  readBy: ReadReceipt;
}

export type WebSocketEvent =
  | { event: "new_message"; data: NewMessageEvent }
  | { event: "message_updated"; data: MessageUpdatedEvent }
  | { event: "message_deleted"; data: MessageDeletedEvent }
  | { event: "message_pinned"; data: MessagePinnedEvent }
  | { event: "reaction_updated"; data: ReactionUpdatedEvent }
  | { event: "typing"; data: TypingEvent }
  | { event: "user_status"; data: UserStatusEvent }
  | { event: "message_status"; data: MessageStatusEvent }
  | { event: "message_read"; data: MessageReadEvent };

// ============================================
// Bot Types
// ============================================

export interface BotCallbackRequest {
  chatId: string;
  messageId: string;
  callbackData: string;
}

export interface BotCallbackResponse {
  message?: Message;
  notification?: string;
}
