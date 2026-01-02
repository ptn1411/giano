import { useEffect, useCallback, useRef } from "react";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { FloatingActionButton } from "@/components/chat/FloatingActionButton";
import { NewGroupModal } from "@/components/chat/NewGroupModal";
import { ForwardModal } from "@/components/chat/ForwardModal";
import { DeleteConfirmModal } from "@/components/chat/DeleteConfirmModal";
import { useChats } from "@/hooks/useChat";
import { useUsers, useUsersStore } from "@/stores/usersStore";
import { useMessages } from "@/stores/messagesStore";
import { useAuthStore } from "@/stores/authStore";
import { useChatStore } from "@/stores/chatStore";
import { chatApi, Attachment, Message, InlineButton, User } from "@/services/mockData";
import { toast } from "@/hooks/use-toast";
import { generateBotResponse, generateCallbackResponse } from "@/services/botResponses";

const Index = () => {
  // Use Zustand store for UI state
  const {
    sidebarOpen,
    setSidebarOpen,
    toggleSidebar,
    activeChatId,
    setActiveChatId,
    activeChat,
    setActiveChat,
    showNewGroupModal,
    setShowNewGroupModal,
    replyingTo,
    setReplyingTo,
    forwardingMessage,
    setForwardingMessage,
    editingMessage,
    setEditingMessage,
    deletingMessage,
    setDeletingMessage,
  } = useChatStore();
  
  const { chats, loading: chatsLoading, refetch: refetchChats, searchChats } = useChats();
  const { messages, loading: messagesLoading, sendMessage, addReaction, deleteMessage, editMessage, pinMessage, unpinMessage, addMessage } = useMessages(activeChatId);
  const { users } = useUsers();
  const { session } = useAuthStore();
  const botResponseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch chats and users on mount
  const fetchUsers = useUsersStore((state) => state.fetchUsers);
  useEffect(() => {
    refetchChats();
    fetchUsers();
  }, [refetchChats, fetchUsers]);

  // Convert auth session to User format for sidebar
  const currentUser: User | null = session ? {
    id: session.user.id,
    name: session.user.name,
    avatar: session.user.avatar,
    status: 'online' as const,
  } : null;

  // Fetch active chat details
  useEffect(() => {
    const fetchChat = async () => {
      if (activeChatId) {
        const chat = await chatApi.getChat(activeChatId);
        setActiveChat(chat || null);
      } else {
        setActiveChat(null);
      }
    };
    fetchChat();
  }, [activeChatId, setActiveChat]);

  // Close sidebar on mobile when chat is selected
  const handleSelectChat = useCallback((chatId: string) => {
    setActiveChatId(chatId);
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [setActiveChatId, setSidebarOpen]);

  const handleBack = useCallback(() => {
    setActiveChatId(null);
    setSidebarOpen(true);
  }, [setActiveChatId, setSidebarOpen]);

  const handleSendMessage = useCallback(async (text: string, attachments?: Attachment[], replyTo?: Message['replyTo']) => {
    await sendMessage(text, attachments, replyTo);
    setReplyingTo(null);
    refetchChats();

    // Auto-respond if it's a bot chat
    if (activeChat?.isBot && activeChatId) {
      const botId = activeChat.participants.find(p => p.startsWith('bot-'));
      if (botId) {
        // Clear any existing timeout
        if (botResponseTimeoutRef.current) {
          clearTimeout(botResponseTimeoutRef.current);
        }
        // Simulate typing delay
        botResponseTimeoutRef.current = setTimeout(() => {
          const botMessage = generateBotResponse(botId, text, activeChatId);
          addMessage(botMessage);
          refetchChats();
        }, 800 + Math.random() * 700); // 800-1500ms delay
      }
    }
  }, [sendMessage, refetchChats, activeChat, activeChatId, addMessage, setReplyingTo]);

  const handleInlineButtonClick = useCallback((button: InlineButton, messageId: string) => {
    if (!activeChat?.isBot || !activeChatId) return;
    
    const botId = activeChat.participants.find(p => p.startsWith('bot-'));
    if (!botId) return;

    // Show toast for button click
    toast({
      title: `${button.text}`,
      description: button.callbackData ? `Processing...` : undefined,
    });

    // Generate bot response for callback
    if (button.callbackData) {
      if (botResponseTimeoutRef.current) {
        clearTimeout(botResponseTimeoutRef.current);
      }
      botResponseTimeoutRef.current = setTimeout(() => {
        const botMessage = generateCallbackResponse(botId, button.callbackData!, activeChatId);
        if (botMessage) {
          addMessage(botMessage);
          refetchChats();
        }
      }, 500 + Math.random() * 500);
    }

    // Open URL if present
    if (button.url) {
      window.open(button.url, '_blank');
    }
  }, [activeChat, activeChatId, addMessage, refetchChats]);

  const handleForwardMessage = useCallback(async (chatId: string, message: Message) => {
    const forwardedText = message.text ? `[Forwarded]\n${message.text}` : '[Forwarded message]';
    await chatApi.sendMessage(chatId, forwardedText, message.attachments);
    refetchChats();
    toast({
      title: "Message forwarded",
      description: "Your message has been forwarded successfully",
    });
  }, [refetchChats]);

  const handleDeleteMessage = useCallback(async () => {
    if (deletingMessage) {
      await deleteMessage(deletingMessage.id);
      setDeletingMessage(null);
      refetchChats();
      toast({
        title: "Message deleted",
        description: "Your message has been deleted",
      });
    }
  }, [deletingMessage, deleteMessage, refetchChats, setDeletingMessage]);

  const handleEditMessage = useCallback(async (messageId: string, newText: string) => {
    await editMessage(messageId, newText);
    setEditingMessage(null);
    toast({
      title: "Message edited",
      description: "Your message has been updated",
    });
  }, [editMessage, setEditingMessage]);

  const handleNewChat = useCallback(() => {
    toast({
      title: "Coming soon",
      description: "New private chat feature is under development",
    });
  }, []);

  const handleGroupCreated = useCallback((chatId: string) => {
    refetchChats();
    setActiveChatId(chatId);
    setShowNewGroupModal(false);
    toast({
      title: "Group created",
      description: "Your new group has been created successfully",
    });
  }, [refetchChats, setActiveChatId, setShowNewGroupModal]);

  // Get participants for active chat
  const participants = activeChat
    ? users.filter((u) => activeChat.participants.includes(u.id))
    : [];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <ChatSidebar
        chats={chats}
        currentUser={currentUser}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onSearch={searchChats}
        onNewChat={handleNewChat}
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        loading={chatsLoading}
      />

      <main className="flex flex-1 flex-col min-w-0">
        <ChatArea
          chat={activeChat}
          messages={messages}
          participants={participants}
          onSendMessage={handleSendMessage}
          onReaction={addReaction}
          onReply={setReplyingTo}
          onForward={setForwardingMessage}
          onEdit={setEditingMessage}
          onDelete={setDeletingMessage}
          onPin={(msg) => pinMessage(msg.id)}
          onUnpin={unpinMessage}
          onInlineButtonClick={handleInlineButtonClick}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          editingMessage={editingMessage}
          onCancelEdit={() => setEditingMessage(null)}
          onEditSubmit={handleEditMessage}
          onMenuClick={toggleSidebar}
          onBack={handleBack}
          loading={messagesLoading}
        />
      </main>

      <FloatingActionButton
        onNewChat={handleNewChat}
        onNewGroup={() => setShowNewGroupModal(true)}
        hidden={!!activeChatId}
      />

      <NewGroupModal
        isOpen={showNewGroupModal}
        onClose={() => setShowNewGroupModal(false)}
        users={users}
        onGroupCreated={handleGroupCreated}
      />

      <ForwardModal
        isOpen={!!forwardingMessage}
        onClose={() => setForwardingMessage(null)}
        message={forwardingMessage}
        chats={chats.filter((c) => c.id !== activeChatId)}
        onForward={handleForwardMessage}
      />

      <DeleteConfirmModal
        isOpen={!!deletingMessage}
        onClose={() => setDeletingMessage(null)}
        onConfirm={handleDeleteMessage}
        messagePreview={deletingMessage?.text || (deletingMessage?.attachments?.length ? `${deletingMessage.attachments.length} attachment(s)` : "")}
      />
    </div>
  );
};

export default Index;
