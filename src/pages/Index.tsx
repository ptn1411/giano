import { useState, useEffect, useCallback } from "react";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { ChatArea } from "@/components/chat/ChatArea";
import { FloatingActionButton } from "@/components/chat/FloatingActionButton";
import { NewGroupModal } from "@/components/chat/NewGroupModal";
import { useChats, useMessages, useUsers, useCurrentUser } from "@/hooks/useChat";
import { chatApi, Chat } from "@/services/mockData";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  
  const { chats, loading: chatsLoading, refetch: refetchChats, searchChats } = useChats();
  const { messages, loading: messagesLoading, sendMessage, addReaction } = useMessages(activeChatId);
  const { users } = useUsers();
  const currentUser = useCurrentUser();

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
  }, [activeChatId]);

  // Close sidebar on mobile when chat is selected
  const handleSelectChat = useCallback((chatId: string) => {
    setActiveChatId(chatId);
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  const handleBack = useCallback(() => {
    setActiveChatId(null);
    setSidebarOpen(true);
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
    await sendMessage(text);
    refetchChats();
  }, [sendMessage, refetchChats]);

  const handleNewChat = useCallback(() => {
    toast({
      title: "Coming soon",
      description: "New private chat feature is under development",
    });
  }, []);

  const handleGroupCreated = useCallback((chatId: string) => {
    refetchChats();
    setActiveChatId(chatId);
    toast({
      title: "Group created",
      description: "Your new group has been created successfully",
    });
  }, [refetchChats]);

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
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        loading={chatsLoading}
      />

      <main className="flex flex-1 flex-col min-w-0">
        <ChatArea
          chat={activeChat}
          messages={messages}
          participants={participants}
          onSendMessage={handleSendMessage}
          onReaction={addReaction}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onBack={handleBack}
          loading={messagesLoading}
        />
      </main>

      <FloatingActionButton
        onNewChat={handleNewChat}
        onNewGroup={() => setShowNewGroupModal(true)}
      />

      <NewGroupModal
        isOpen={showNewGroupModal}
        onClose={() => setShowNewGroupModal(false)}
        users={users}
        onGroupCreated={handleGroupCreated}
      />
    </div>
  );
};

export default Index;
