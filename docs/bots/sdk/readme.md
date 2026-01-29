# Bot SDK (TypeScript)

TypeScript SDK for building bots on the Messages API platform.

## Features

- 🔌 **Dual-mode support**: WebSocket (realtime) and Webhook (serverless-friendly)
- 🔒 **Type-safe API**: Full TypeScript definitions with IntelliSense
- 🔧 **Middleware architecture**: Extensible with logging, auth, rate limiting
- 🔄 **Auto-reconnect**: Resilient WebSocket with exponential backoff
- ♻️ **Retry logic**: Automatic retry for API requests
- 👨‍💻 **Developer-friendly**: Fluent API similar to Telegraf.js

## Installation

```bash
npm install @messages-api/bot-sdk
```

## Quick Start

```typescript
import { Bot } from '@messages-api/bot-sdk';

const bot = new Bot('YOUR_BOT_TOKEN');

bot.command('start', async (ctx) => {
  await ctx.reply('Hello! I am your bot.');
});

bot.on('text', async (ctx) => {
  await ctx.reply(`You said: ${ctx.text}`);
});

await bot.start();
```

## WebSocket Mode Example

WebSocket mode is ideal for real-time applications and development. The bot maintains a persistent connection to receive updates instantly.

```typescript
import { Bot } from '@messages-api/bot-sdk';

const bot = new Bot('YOUR_BOT_TOKEN', {
  mode: 'websocket',
  wsUrl: 'ws://localhost:3000',
  apiBaseUrl: 'http://localhost:3000',
  logLevel: 'info',
});

// Handle the /start command
bot.command('start', async (ctx) => {
  await ctx.reply('Welcome! Use /help to see available commands.');
});

// Handle the /help command
bot.command('help', async (ctx) => {
  const helpText = `
Available commands:
/start - Start the bot
/help - Show this help message
/echo <text> - Echo your message
  `.trim();
  
  await ctx.reply(helpText);
});

// Handle the /echo command with arguments
bot.command('echo', async (ctx) => {
  if (ctx.args && ctx.args.length > 0) {
    await ctx.reply(ctx.args.join(' '));
  } else {
    await ctx.reply('Usage: /echo <text>');
  }
});

// Handle all text messages
bot.on('text', async (ctx) => {
  console.log(`Received message: ${ctx.text}`);
});

// Handle errors
bot.on('error', (error) => {
  console.error('Bot error:', error);
});

// Start the bot
await bot.start();
console.log('Bot is running in WebSocket mode...');
```

## Webhook Mode Example

Webhook mode is perfect for serverless deployments (AWS Lambda, Vercel, etc.) where you can't maintain persistent connections.

```typescript
import { Bot } from '@messages-api/bot-sdk';

const bot = new Bot('YOUR_BOT_TOKEN', {
  mode: 'webhook',
  apiBaseUrl: 'http://localhost:3000',
  logLevel: 'info',
});

// Register handlers
bot.command('start', async (ctx) => {
  await ctx.reply('Hello from webhook mode!');
});

bot.on('text', async (ctx) => {
  await ctx.reply(`Echo: ${ctx.text}`);
});

// Start webhook server
const PORT = process.env.PORT || 8080;
const WEBHOOK_PATH = '/webhook';

await bot.startWebhook(PORT, WEBHOOK_PATH);
console.log(`Webhook server listening on port ${PORT}`);
console.log(`Webhook URL: http://localhost:${PORT}${WEBHOOK_PATH}`);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await bot.stop();
  process.exit(0);
});
```

## Command Handler Examples

### Basic Command

```typescript
bot.command('start', async (ctx) => {
  await ctx.reply('Welcome to the bot!');
});
```

### Command with Arguments

```typescript
bot.command('greet', async (ctx) => {
  const name = ctx.args?.[0] || 'stranger';
  await ctx.reply(`Hello, ${name}!`);
});
```

### Multiple Commands

```typescript
// Case-insensitive matching
bot.command('hello', async (ctx) => {
  await ctx.reply('Hi there!');
});

bot.command('hi', async (ctx) => {
  await ctx.reply('Hello!');
});

// General command handler (called for all commands)
bot.on('command', async (ctx) => {
  console.log(`Command received: /${ctx.command}`);
});
```

### Sending Messages with Inline Buttons

```typescript
bot.command('menu', async (ctx) => {
  await ctx.replyWithButtons(
    'Choose an option:',
    [
      [
        { text: 'Option 1', callbackData: 'opt1' },
        { text: 'Option 2', callbackData: 'opt2' },
      ],
      [
        { text: 'Visit Website', url: 'https://example.com' },
      ],
    ]
  );
});
```

## Middleware Examples

Middleware functions run before handlers and can modify the context, perform logging, authentication, or stop processing.

### Logging Middleware

```typescript
bot.use(async (ctx, next) => {
  const start = Date.now();
  console.log(`Incoming message from ${ctx.userId}: ${ctx.text}`);
  
  await next(); // Continue to next middleware or handler
  
  const duration = Date.now() - start;
  console.log(`Processing took ${duration}ms`);
});
```

### Authentication Middleware

```typescript
const ADMIN_IDS = ['user123', 'user456'];

bot.use(async (ctx, next) => {
  if (ctx.command === 'admin') {
    if (!ADMIN_IDS.includes(ctx.userId)) {
      await ctx.reply('You are not authorized to use this command.');
      return; // Stop processing (don't call next())
    }
  }
  
  await next(); // Continue to handlers
});

bot.command('admin', async (ctx) => {
  await ctx.reply('Admin panel access granted.');
});
```

### Rate Limiting Middleware

```typescript
const userLastMessage = new Map<string, number>();
const RATE_LIMIT_MS = 1000; // 1 second

bot.use(async (ctx, next) => {
  const userId = ctx.userId;
  const now = Date.now();
  const lastMessageTime = userLastMessage.get(userId) || 0;
  
  if (now - lastMessageTime < RATE_LIMIT_MS) {
    await ctx.reply('Please slow down! Wait a moment before sending another message.');
    return; // Stop processing
  }
  
  userLastMessage.set(userId, now);
  await next();
});
```

### Error Handling in Middleware

```typescript
bot.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error('Error in handler:', error);
    await ctx.reply('Sorry, something went wrong processing your message.');
  }
});
```

## Error Handling Examples

### Global Error Handler

```typescript
bot.on('error', (error, ctx) => {
  console.error('Bot error:', error);
  
  if (ctx) {
    console.error(`Error occurred while processing message from ${ctx.userId}`);
  }
});
```

### Try-Catch in Handlers

```typescript
bot.command('fetch', async (ctx) => {
  try {
    const response = await fetch('https://api.example.com/data');
    const data = await response.json();
    await ctx.reply(`Data: ${JSON.stringify(data)}`);
  } catch (error) {
    console.error('Fetch error:', error);
    await ctx.reply('Failed to fetch data. Please try again later.');
  }
});
```

### Handling API Errors

```typescript
bot.command('send', async (ctx) => {
  try {
    await bot.sendMessage('some-chat-id', 'Hello!');
    await ctx.reply('Message sent successfully!');
  } catch (error) {
    if (error instanceof BotError) {
      await ctx.reply(`API Error: ${error.description}`);
    } else {
      await ctx.reply('Failed to send message.');
    }
  }
});
```

## Configuration Options

```typescript
import { Bot, ConsoleLogger } from '@messages-api/bot-sdk';

const bot = new Bot('YOUR_BOT_TOKEN', {
  // Connection mode: 'websocket' or 'webhook'
  mode: 'websocket',
  
  // API base URL
  apiBaseUrl: 'http://localhost:3000',
  
  // WebSocket URL (for websocket mode)
  wsUrl: 'ws://localhost:3000',
  
  // Log level: 'debug', 'info', 'error', or 'none'
  logLevel: 'info',
  
  // Custom logger (optional)
  logger: new ConsoleLogger('debug'),
  
  // Retry configuration for API requests
  retryAttempts: 3,
  retryDelay: 1000, // milliseconds
});
```

## Context API

The `Context` object is passed to all handlers and provides convenient methods for responding to messages.

### Properties

- `ctx.message` - The full message object
- `ctx.updateId` - The update ID
- `ctx.chatId` - Convenience getter for chat ID
- `ctx.userId` - Convenience getter for user ID
- `ctx.text` - Convenience getter for message text
- `ctx.command` - Command name (for command handlers)
- `ctx.args` - Command arguments array (for command handlers)

### Methods

- `ctx.reply(text, options?)` - Reply to the message
- `ctx.replyWithButtons(text, buttons)` - Reply with inline keyboard buttons
- `ctx.send(text, options?)` - Send a message to the same chat (without reply)

## Advanced Examples

### State Management

```typescript
interface UserState {
  step: string;
  data: Record<string, any>;
}

const userStates = new Map<string, UserState>();

bot.command('register', async (ctx) => {
  userStates.set(ctx.userId, { step: 'name', data: {} });
  await ctx.reply('What is your name?');
});

bot.on('text', async (ctx) => {
  const state = userStates.get(ctx.userId);
  
  if (!state) return;
  
  if (state.step === 'name') {
    state.data.name = ctx.text;
    state.step = 'email';
    await ctx.reply('What is your email?');
  } else if (state.step === 'email') {
    state.data.email = ctx.text;
    await ctx.reply(`Registration complete!\nName: ${state.data.name}\nEmail: ${state.data.email}`);
    userStates.delete(ctx.userId);
  }
});
```

### Custom Logger

```typescript
import { Logger } from '@messages-api/bot-sdk';

class CustomLogger implements Logger {
  debug(message: string, ...args: any[]): void {
    // Send to your logging service
    console.debug(`[DEBUG] ${message}`, ...args);
  }
  
  info(message: string, ...args: any[]): void {
    console.info(`[INFO] ${message}`, ...args);
  }
  
  error(message: string, ...args: any[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  }
}

const bot = new Bot('YOUR_BOT_TOKEN', {
  logger: new CustomLogger(),
});
```

## API Reference

For detailed API documentation, see the [TypeScript definitions](./src/index.ts) or use IntelliSense in your IDE.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Watch mode for development
npm run build:watch
```

## Testing

The SDK includes comprehensive unit tests and property-based tests using Jest and fast-check.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## License

MIT
