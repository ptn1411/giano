import { useState } from "react";
import { X, Users } from "lucide-react";
import { User } from "@/services/api/types";
import { chatsService } from "@/services/api/chats";
import { AvatarWithStatus } from "./AvatarWithStatus";
import { cn } from "@/lib/utils";

interface NewGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onGroupCreated: (chatId: string) => void;
}

export function NewGroupModal({ isOpen, onClose, users, onGroupCreated }: NewGroupModalProps) {
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const availableUsers = users.filter((u) => u.id !== 'user-1');

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    
    setLoading(true);
    try {
      const result = await chatsService.createGroup(groupName.trim(), selectedUsers);
      if (result.chat) {
        onGroupCreated(result.chat.id);
        setGroupName("");
        setSelectedUsers([]);
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md rounded-2xl bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">Nhóm mới</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Tên nhóm"
            className={cn(
              "w-full rounded-lg border border-border bg-background px-4 py-2.5",
              "text-sm placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            )}
          />

          <div>
            <p className="text-sm font-medium text-foreground mb-2">
              Chọn thành viên ({selectedUsers.length} đã chọn)
            </p>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {availableUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => toggleUser(user.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                    selectedUsers.includes(user.id)
                      ? "bg-primary/10"
                      : "hover:bg-accent/50"
                  )}
                >
                  <AvatarWithStatus
                    src={user.avatar}
                    alt={user.name}
                    status={user.status}
                    size="sm"
                  />
                  <span className="flex-1 text-left font-medium text-foreground">
                    {user.name}
                  </span>
                  <div
                    className={cn(
                      "h-5 w-5 rounded-full border-2 transition-colors",
                      selectedUsers.includes(user.id)
                        ? "bg-primary border-primary"
                        : "border-border"
                    )}
                  >
                    {selectedUsers.includes(user.id) && (
                      <svg className="h-full w-full text-primary-foreground" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-3">
          <button
            onClick={handleCreate}
            disabled={!groupName.trim() || selectedUsers.length === 0 || loading}
            className={cn(
              "w-full rounded-lg py-2.5 font-medium transition-colors",
              groupName.trim() && selectedUsers.length > 0
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {loading ? "Đang tạo..." : "Tạo nhóm"}
          </button>
        </div>
      </div>
    </div>
  );
}
