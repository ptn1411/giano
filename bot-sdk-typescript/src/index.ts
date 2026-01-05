/**
 * Bot SDK for TypeScript
 * 
 * A TypeScript library for building bots with support for both WebSocket (realtime)
 * and Webhook (serverless-friendly) modes.
 * 
 * @packageDocumentation
 */

// Export main Bot class
export { Bot } from './bot';

// Export Context class
export { Context } from './context';

// Export all types and interfaces
export type {
  Update,
  Message,
  Chat,
  User,
  InlineButton,
  SendMessageOptions,
  BotError as BotErrorType,
  Logger,
  BotOptions,
} from './types';

// Export ConsoleLogger class
export { ConsoleLogger } from './types';

// Export error classes
export {
  BotError,
  InitializationError,
  ConnectionError,
  ValidationError,
} from './errors';

// Export handler types from update-router
export type {
  Middleware,
  MessageHandler,
  TextHandler,
  CommandHandler,
  ErrorHandler,
} from './update-router';
