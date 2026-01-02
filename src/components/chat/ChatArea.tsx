import { Chat, User } from "@/services/mockData";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { MessageSquare } from "lucide-react";

interface ChatAreaProps {
  chat: Chat | null;
  messages: { id: string; chatId: string; senderId: string; text: string; timestamp: Date; isRead: boolean; reactions: { emoji: string; userId: string }[] }[];
  participants: User[];
  onSendMessage: (text: string) => void;
  onReaction: (messageId: string, emoji: string) => void;
  onMenuClick: () => void;
  onBack: () => void;
  loading?: boolean;
}

export function ChatArea({
  chat,
  messages,
  participants,
  onSendMessage,
  onReaction,
  onMenuClick,
  onBack,
  loading,
}: ChatAreaProps) {
  if (!chat) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-background p-8 text-center">
        <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <MessageSquare className="h-12 w-12 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          Welcome to Telegram Chat
        </h2>
        <p className="text-muted-foreground max-w-md">
          Select a chat from the sidebar to start messaging, or create a new chat to connect with others.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-background">
      <ChatHeader
        chat={chat}
        participants={participants}
        onMenuClick={onMenuClick}
        onBack={onBack}
        showBackButton
      />
      <MessageList
        messages={messages}
        onReaction={onReaction}
        loading={loading}
      />
      <MessageInput onSend={onSendMessage} />
    </div>
  );
}
