import { Plus, Users, MessageCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps {
  onNewChat: () => void;
  onNewGroup: () => void;
  hidden?: boolean;
}

export function FloatingActionButton({ onNewChat, onNewGroup, hidden }: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  if (hidden) return null;

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-30">
      {/* Options */}
      <div className={cn(
        "absolute bottom-16 right-0 flex flex-col items-end gap-2 transition-all duration-200",
        isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      )}>
        <button
          onClick={() => {
            onNewGroup();
            setIsOpen(false);
          }}
          className="flex items-center gap-2 rounded-full bg-card px-4 py-2 shadow-lg hover:bg-accent transition-colors"
        >
          <span className="text-sm font-medium text-foreground">New Group</span>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
        </button>

        <button
          onClick={() => {
            onNewChat();
            setIsOpen(false);
          }}
          className="flex items-center gap-2 rounded-full bg-card px-4 py-2 shadow-lg hover:bg-accent transition-colors"
        >
          <span className="text-sm font-medium text-foreground">New Chat</span>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <MessageCircle className="h-5 w-5 text-primary" />
          </div>
        </button>
      </div>

      {/* Main FAB */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg transition-all duration-200",
          "hover:bg-primary/90 hover:shadow-xl",
          isOpen && "rotate-45"
        )}
      >
        <Plus className="h-7 w-7 text-primary-foreground" />
      </button>
    </div>
  );
}
