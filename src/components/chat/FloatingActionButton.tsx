import { Plus, Users, MessageCircle, Search } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { SearchUserModal } from "./SearchUserModal";
import { SelectContactModal } from "./SelectContactModal";

interface FloatingActionButtonProps {
  onNewGroup: () => void;
  onSelectChat?: (chatId: string) => void;
  hidden?: boolean;
}

export function FloatingActionButton({ onNewGroup, onSelectChat, hidden }: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(!hidden);
  const [shouldRender, setShouldRender] = useState(!hidden);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showSelectContactModal, setShowSelectContactModal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle animation states
  useEffect(() => {
    if (hidden) {
      setIsVisible(false);
      // Wait for animation to complete before unmounting
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    } else {
      setShouldRender(true);
      // Small delay to trigger enter animation
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    }
  }, [hidden]);

  // Close menu when hiding
  useEffect(() => {
    if (hidden) {
      setIsOpen(false);
    }
  }, [hidden]);

  const handleChatCreated = (chatId: string) => {
    if (onSelectChat) {
      onSelectChat(chatId);
    }
  };

  if (!shouldRender) return null;

  return (
    <>
      <div 
        ref={containerRef} 
        className={cn(
          "fixed bottom-6 right-6 z-30 transition-all duration-300 ease-out",
          isVisible 
            ? "opacity-100 scale-100 translate-y-0" 
            : "opacity-0 scale-75 translate-y-4 pointer-events-none"
        )}
      >
        {/* Options */}
        <div className={cn(
          "absolute bottom-16 right-0 flex flex-col items-end gap-2 transition-all duration-300 ease-out",
          isOpen ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95 pointer-events-none"
        )}>
          <button
            onClick={() => {
              onNewGroup();
              setIsOpen(false);
            }}
            className={cn(
              "flex items-center gap-2 rounded-full bg-card px-4 py-2 shadow-lg transition-all duration-200",
              "hover:bg-accent hover:scale-105 hover:shadow-xl"
            )}
          >
            <span className="text-sm font-medium text-foreground">Nhóm mới</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
          </button>

          <button
            onClick={() => {
              setShowSearchModal(true);
              setIsOpen(false);
            }}
            className={cn(
              "flex items-center gap-2 rounded-full bg-card px-4 py-2 shadow-lg transition-all duration-200",
              "hover:bg-accent hover:scale-105 hover:shadow-xl"
            )}
          >
            <span className="text-sm font-medium text-foreground">Tìm người dùng</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
              <Search className="h-5 w-5 text-green-500" />
            </div>
          </button>

          <button
            onClick={() => {
              setShowSelectContactModal(true);
              setIsOpen(false);
            }}
            className={cn(
              "flex items-center gap-2 rounded-full bg-card px-4 py-2 shadow-lg transition-all duration-200",
              "hover:bg-accent hover:scale-105 hover:shadow-xl"
            )}
          >
            <span className="text-sm font-medium text-foreground">Chat mới</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
          </button>
        </div>

        {/* Main FAB */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg transition-all duration-300 ease-out",
            "hover:bg-primary/90 hover:shadow-xl hover:scale-110",
            "active:scale-95",
            isOpen && "rotate-45"
          )}
        >
          <Plus className="h-7 w-7 text-primary-foreground transition-transform duration-300" />
        </button>
      </div>

      {/* Search User Modal */}
      <SearchUserModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onChatCreated={handleChatCreated}
      />

      {/* Select Contact Modal */}
      <SelectContactModal
        isOpen={showSelectContactModal}
        onClose={() => setShowSelectContactModal(false)}
        onChatCreated={handleChatCreated}
      />
    </>
  );
}
