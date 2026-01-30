import { CallModal } from "@/components/chat/CallModal";
import { ChatArea } from "@/components/chat/ChatArea";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { DeleteConfirmModal } from "@/components/chat/DeleteConfirmModal";
import { FloatingActionButton } from "@/components/chat/FloatingActionButton";
import { ForwardModal } from "@/components/chat/ForwardModal";
import { NewGroupModal } from "@/components/chat/NewGroupModal";
import { SearchUserModal } from "@/components/chat/SearchUserModal";
import { ErrorAlert } from "@/components/ui/error-alert";
import { toast } from "@/hooks/use-toast";
import { BOTFATHER_CHAT, BOTFATHER_ID, isBotFatherChat } from "@/lib/botfather";
import { botsService, chatsService, messagesService } from "@/services/api";
import {
  Attachment,
  Chat,
  InlineButton,
  Message,
  User,
} from "@/services/api/types";
import { useAuthStore } from "@/stores/authStore";
import { useBotFatherStore } from "@/stores/botfatherStore";
import { selectCallState, useCallStore } from "@/stores/callStore";
import { useChats, useChatsStore } from "@/stores/chatsStore";
import { useChatStore } from "@/stores/chatStore";
import { useMessages, useMessagesStore } from "@/stores/messagesStore";
import { useUsers, useUsersStore } from "@/stores/usersStore";
import { useCallback, useEffect, useRef, useState } from "react";

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
    showSearchUserModal,
    setShowSearchUserModal,
    replyingTo,
    setReplyingTo,
    forwardingMessage,
    setForwardingMessage,
    editingMessage,
    setEditingMessage,
    deletingMessage,
    setDeletingMessage,
  } = useChatStore();

  const {
    chats,
    loading: chatsLoading,
    error: chatsError,
    searchChats,
  } = useChats();
  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    sendMessage,
    addReaction,
    deleteMessage,
    editMessage,
    pinMessage,
    unpinMessage,
    addMessage,
    retryMessage,
    clearError: clearMessagesError,
    pagination,
    loadMore,
  } = useMessages(activeChatId);
  const clearChatMessages = useMessagesStore(
    (state) => state.clearChatMessages,
  );
  const deleteChatAsync = useChatsStore((state) => state.deleteChatAsync);
  const { users } = useUsers();
  const { session } = useAuthStore();
  const botResponseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // BotFather store
  const botfatherMessages = useBotFatherStore((state) => state.messages);
  const sendBotFatherMessage = useBotFatherStore((state) => state.sendMessage);
  const loadBotFatherMessages = useBotFatherStore(
    (state) => state.loadMessages,
  );
  const botfatherLoading = useBotFatherStore((state) => state.loading);
  const botfatherLoadingHistory = useBotFatherStore(
    (state) => state.loadingHistory,
  );

  // Bots in current chat (for displaying their messages)
  const [chatBots, setChatBots] = useState<User[]>([]);

  // Check if current chat is BotFather
  const isBotFather = activeChatId ? isBotFatherChat(activeChatId) : false;

  // Call modal state
  const callState = useCallStore(selectCallState);
  const showCallModal = callState !== "idle";

  // Fetch chats and users on mount only
  useEffect(() => {
    useChatsStore.getState().fetchChats();
    useUsersStore.getState().fetchUsers();
  }, []);

  // Convert auth session to User format for sidebar
  const currentUser: User | null = session
    ? {
        id: session.user.id,
        name: session.user.name,
        avatar: session.user.avatar,
        status: "online" as const,
        isBot: false,
      }
    : null;

  // Fetch active chat details
  useEffect(() => {
    const fetchChat = async () => {
      if (activeChatId) {
        // Handle BotFather chat specially
        if (isBotFatherChat(activeChatId)) {
          setActiveChat(BOTFATHER_CHAT);
          return;
        }
        const result = await chatsService.getChat(activeChatId);
        setActiveChat(result.chat || null);
      } else {
        setActiveChat(null);
      }
    };
    fetchChat();
  }, [activeChatId, setActiveChat]);

  // Fetch messages when active chat changes (skip for BotFather)
  useEffect(() => {
    if (activeChatId && !isBotFatherChat(activeChatId)) {
      useMessagesStore.getState().fetchMessages(activeChatId);
    }
  }, [activeChatId]);

  // Fetch bots in current chat for displaying their messages
  useEffect(() => {
    const fetchChatBots = async () => {
      if (activeChatId && !isBotFatherChat(activeChatId)) {
        const result = await chatsService.getChatBots(activeChatId);
        if (!result.error) {
          setChatBots(result.bots);
        }
      } else {
        setChatBots([]);
      }
    };
    fetchChatBots();
  }, [activeChatId]);

  // Load BotFather messages when BotFather chat is selected
  useEffect(() => {
    if (isBotFather) {
      loadBotFatherMessages();
    }
  }, [isBotFather, loadBotFatherMessages]);

  // Close sidebar on mobile when chat is selected
  const handleSelectChat = useCallback(
    (chatId: string) => {
      setActiveChatId(chatId);
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    },
    [setActiveChatId, setSidebarOpen],
  );

  const handleBack = useCallback(() => {
    setActiveChatId(null);
    setSidebarOpen(true);
  }, [setActiveChatId, setSidebarOpen]);

  const handleSendMessage = useCallback(
    async (
      text: string,
      attachments?: Attachment[],
      replyTo?: Message["replyTo"],
    ) => {
      // Handle BotFather messages specially
      if (isBotFather) {
        await sendBotFatherMessage(text);
        setReplyingTo(null);
        return;
      }

      await sendMessage(text, attachments, replyTo);
      setReplyingTo(null);
      useChatsStore.getState().fetchChats();
    },
    [sendMessage, setReplyingTo, isBotFather, sendBotFatherMessage],
  );

  const handleInlineButtonClick = useCallback(
    async (button: InlineButton, messageId: string) => {
      if (!activeChat?.isBot || !activeChatId) return;

      const botId = activeChat.participants.find((p) => p.startsWith("bot-"));
      if (!botId) return;

      // Show toast for button click
      toast({
        title: `${button.text}`,
        description: button.callbackData ? `Processing...` : undefined,
      });

      // Handle callback data via real API
      if (button.callbackData) {
        try {
          const result = await botsService.handleCallback(botId, {
            chatId: activeChatId,
            messageId: messageId,
            callbackData: button.callbackData,
          });

          if (result.success && result.message) {
            // Add the bot's response message to the store
            addMessage(result.message);
            useChatsStore.getState().fetchChats();
          } else if (result.error) {
            toast({
              title: "Error",
              description: result.error.message,
              variant: "destructive",
            });
          }
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to process bot callback",
            variant: "destructive",
          });
        }
      }

      // Open URL if present
      if (button.url) {
        window.open(button.url, "_blank");
      }
    },
    [activeChat, activeChatId, addMessage],
  );

  const handleForwardMessage = useCallback(
    async (chatId: string, message: Message) => {
      const forwardedText = message.text
        ? `[Forwarded]\n${message.text}`
        : "[Forwarded message]";
      await messagesService.sendMessage(chatId, {
        text: forwardedText,
        attachments: message.attachments,
      });
      useChatsStore.getState().fetchChats();
      toast({
        title: "Message forwarded",
        description: "Your message has been forwarded successfully",
      });
    },
    [],
  );

  const handleDeleteMessage = useCallback(async () => {
    if (deletingMessage) {
      await deleteMessage(deletingMessage.id);
      setDeletingMessage(null);
      useChatsStore.getState().fetchChats();
      toast({
        title: "Message deleted",
        description: "Your message has been deleted",
      });
    }
  }, [deletingMessage, deleteMessage, setDeletingMessage]);

  const handleEditMessage = useCallback(
    async (messageId: string, newText: string) => {
      await editMessage(messageId, newText);
      setEditingMessage(null);
      toast({
        title: "Message edited",
        description: "Your message has been updated",
      });
    },
    [editMessage, setEditingMessage],
  );

  const handleNewChat = useCallback(() => {
    setShowSearchUserModal(true);
  }, [setShowSearchUserModal]);

  const handleGroupCreated = useCallback(
    (chatId: string) => {
      useChatsStore.getState().fetchChats();
      setActiveChatId(chatId);
      setShowNewGroupModal(false);
      toast({
        title: "Group created",
        description: "Your new group has been created successfully",
      });
    },
    [setActiveChatId, setShowNewGroupModal],
  );

  const handleChatCreated = useCallback(
    (chatId: string) => {
      useChatsStore.getState().fetchChats();
      setActiveChatId(chatId);
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    },
    [setActiveChatId, setSidebarOpen],
  );

  // Get participants for active chat (merge users and bots)
  const participants = activeChat
    ? isBotFather
      ? [
          {
            id: BOTFATHER_ID,
            name: "BotFather",
            avatar: BOTFATHER_CHAT.avatar,
            status: "online" as const,
            isBot: true,
          },
        ]
      : [
          ...users.filter((u) => activeChat.participants.includes(u.id)),
          ...chatBots, // Include bots from the chat
        ]
    : [];

  // Get messages - use BotFather store for BotFather chat
  const displayMessages = isBotFather ? botfatherMessages : messages;
  const displayLoading = isBotFather
    ? botfatherLoading || botfatherLoadingHistory
    : messagesLoading;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Global error alerts */}
      {(chatsError || messagesError) && (
        <div className="fixed top-4 right-4 z-50 max-w-md">
          {chatsError && (
            <ErrorAlert
              error={{ type: "server", message: chatsError }}
              onRetry={() => useChatsStore.getState().fetchChats()}
              onDismiss={() => useChatsStore.getState().clearError()}
              className="mb-2"
            />
          )}
          {messagesError && (
            <ErrorAlert
              error={{ type: "server", message: messagesError }}
              onRetry={() =>
                activeChatId &&
                useMessagesStore.getState().fetchMessages(activeChatId)
              }
              onDismiss={clearMessagesError}
            />
          )}
        </div>
      )}

      <ChatSidebar
        chats={chats}
        users={users}
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
          chat={activeChat as Chat | null}
          messages={displayMessages}
          participants={participants}
          onSendMessage={handleSendMessage}
          onReaction={addReaction}
          onReply={setReplyingTo}
          onForward={setForwardingMessage}
          onEdit={setEditingMessage}
          onDelete={setDeletingMessage}
          onPin={(msg) => pinMessage(msg.id)}
          onUnpin={unpinMessage}
          onRetry={retryMessage}
          onInlineButtonClick={handleInlineButtonClick}
          onLoadMore={!isBotFather ? loadMore : undefined}
          hasMore={!isBotFather ? pagination?.hasMore : false}
          isLoadingMore={!isBotFather ? pagination?.isLoadingMore : false}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          editingMessage={editingMessage}
          onCancelEdit={() => setEditingMessage(null)}
          onEditSubmit={handleEditMessage}
          onMenuClick={toggleSidebar}
          onBack={handleBack}
          onClearChat={
            activeChatId && !isBotFather
              ? () => clearChatMessages(activeChatId)
              : undefined
          }
          onDeleteChat={
            activeChatId && !isBotFather
              ? async () => {
                  const success = await deleteChatAsync(activeChatId);
                  if (success) {
                    setActiveChatId(null);
                    setActiveChat(null);
                  }
                }
              : undefined
          }
          loading={displayLoading}
        />
      </main>

      <FloatingActionButton
        onNewGroup={() => setShowNewGroupModal(true)}
        onSelectChat={handleSelectChat}
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
        messagePreview={
          deletingMessage?.text ||
          (deletingMessage?.attachments?.length
            ? `${deletingMessage.attachments.length} attachment(s)`
            : "")
        }
      />

      <SearchUserModal
        isOpen={showSearchUserModal}
        onClose={() => setShowSearchUserModal(false)}
        onChatCreated={handleChatCreated}
      />

      {/* Global Call Modal */}
      <CallModal open={showCallModal} onOpenChange={() => {}} />
    </div>
  );
};

export default Index;
