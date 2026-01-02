import { Chat, User, Attachment, Message } from "@/services/mockData";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { MessageSquare } from "lucide-react";

interface ChatAreaProps {
  chat: Chat | null;
  messages: Message[];
  participants: User[];
  onSendMessage: (text: string, attachments?: Attachment[], replyTo?: Message['replyTo']) => void;
  onReaction: (messageId: string, emoji: string) => void;
  onReply: (message: Message) => void;
  onForward: (message: Message) => void;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
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
  onReply,
  onForward,
  replyingTo,
  onCancelReply,
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
        onReply={onReply}
        onForward={onForward}
        loading={loading}
      />
      <MessageInput 
        onSend={onSendMessage} 
        replyingTo={replyingTo}
        onCancelReply={onCancelReply}
      />
    </div>
  );
}
