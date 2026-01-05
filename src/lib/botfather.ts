/**
 * BotFather Constants and Utilities
 * BotFather is a system bot for managing bots via chat commands
 */

import { Chat, Message } from '@/services/api/types';

// BotFather's fixed UUID (matches backend)
export const BOTFATHER_ID = '00000000-0000-0000-0000-000000000001';
export const BOTFATHER_CHAT_ID = `botfather-${BOTFATHER_ID}`;

// BotFather virtual chat object
export const BOTFATHER_CHAT: Chat = {
  id: BOTFATHER_CHAT_ID,
  type: 'bot',
  name: 'BotFather',
  avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=botfather&backgroundColor=0ea5e9',
  participants: [BOTFATHER_ID],
  unreadCount: 0,
  isBot: true,
};

// Check if a chat ID is BotFather
export function isBotFatherChat(chatId: string): boolean {
  return chatId === BOTFATHER_CHAT_ID;
}

// Check if search query matches BotFather
export function matchesBotFather(query: string): boolean {
  const q = query.toLowerCase().trim();
  return (
    q.includes('botfather') ||
    q.includes('bot father') ||
    q === 'bot' ||
    q === 'bots' ||
    q.includes('create bot') ||
    q.includes('manage bot')
  );
}

// BotFather welcome message
export const BOTFATHER_WELCOME: Message = {
  id: 'botfather-welcome',
  chatId: BOTFATHER_CHAT_ID,
  senderId: BOTFATHER_ID,
  text: `🤖 Welcome to BotFather!

I can help you create and manage bots. Click any command below to use it:

📝 Bot Management:
/newbot - Create a new bot (interactive)
/mybots - List your bots  
/deletebot - Delete a bot
/botinfo - Get bot info

🔧 Configuration:
/setwebhook - Set webhook URL
/clearwebhook - Clear webhook
/token - Get/regenerate token

💬 Chat Integration:
/addbot - Add bot to a chat
/removebot - Remove bot from chat

/cancel - Cancel current operation

Type /bothelp to see this message again.`,
  timestamp: new Date().toISOString(),
  isRead: true,
  reactions: [],
  deliveryStatus: 'read',
};

// BotFather commands list for autocomplete
export const BOTFATHER_COMMANDS = [
  { command: '/newbot', description: 'Create a new bot (interactive)', usage: '/newbot' },
  { command: '/mybots', description: 'List your bots', usage: '/mybots' },
  { command: '/deletebot', description: 'Delete a bot', usage: '/deletebot <bot_id>' },
  { command: '/botinfo', description: 'Get bot information', usage: '/botinfo <bot_id>' },
  { command: '/setwebhook', description: 'Set webhook URL', usage: '/setwebhook <bot_id> <url>' },
  { command: '/clearwebhook', description: 'Clear webhook', usage: '/clearwebhook <bot_id>' },
  { command: '/token', description: 'Get or regenerate token', usage: '/token <bot_id> [regenerate]' },
  { command: '/addbot', description: 'Add bot to current chat', usage: '/addbot <bot_id>' },
  { command: '/removebot', description: 'Remove bot from chat', usage: '/removebot <bot_id>' },
  { command: '/cancel', description: 'Cancel current operation', usage: '/cancel' },
  { command: '/bothelp', description: 'Show help', usage: '/bothelp' },
];
