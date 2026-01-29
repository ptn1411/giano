import { cn } from "@/lib/utils";
import { BotPublic, botsService } from "@/services/api/bots";
import { chatsService } from "@/services/api/chats";
import { User } from "@/services/api/types";
import { Bot, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AvatarWithStatus } from "./AvatarWithStatus";

interface NewGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onGroupCreated: (chatId: string) => void;
}

export function NewGroupModal({
  isOpen,
  onClose,
  users,
  onGroupCreated,
}: NewGroupModalProps) {
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedBots, setSelectedBots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [bots, setBots] = useState<BotPublic[]>([]);
  const [botsLoading, setBotsLoading] = useState(false);

  const availableUsers = users.filter((u) => u.id !== "user-1");

  // Fetch available bots when modal opens
  useEffect(() => {
    if (isOpen) {
      const fetchBots = async () => {
        setBotsLoading(true);
        try {
          const result = await botsService.getAvailableBots(50);
          if (!result.error) {
            setBots(result.bots);
          }
        } finally {
          setBotsLoading(false);
        }
      };
      fetchBots();
    }
  }, [isOpen]);

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const toggleBot = (botId: string) => {
    setSelectedBots((prev) =>
      prev.includes(botId)
        ? prev.filter((id) => id !== botId)
        : [...prev, botId],
    );
  };

  const handleCreate = async () => {
    if (
      !groupName.trim() ||
      (selectedUsers.length === 0 && selectedBots.length === 0)
    )
      return;

    setLoading(true);
    try {
      // Combine user IDs and bot IDs for participants
      const allParticipants = [...selectedUsers, ...selectedBots];
      const result = await chatsService.createGroup(
        groupName.trim(),
        allParticipants,
      );
      if (result.chat) {
        onGroupCreated(result.chat.id);
        setGroupName("");
        setSelectedUsers([]);
        setSelectedBots([]);
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setGroupName("");
    setSelectedUsers([]);
    setSelectedBots([]);
    onClose();
  };

  const totalSelected = selectedUsers.length + selectedBots.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative w-full max-w-md rounded-2xl bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">Nhóm mới</h2>
          </div>
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent">
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
              "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
            )}
          />

          <div>
            <p className="text-sm font-medium text-foreground mb-2">
              Chọn thành viên ({totalSelected} đã chọn)
            </p>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {/* Users Section */}
              {availableUsers.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground px-3 py-1 font-medium">
                    Người dùng
                  </p>
                  {availableUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => toggleUser(user.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                        selectedUsers.includes(user.id)
                          ? "bg-primary/10"
                          : "hover:bg-accent/50",
                      )}>
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
                            : "border-border",
                        )}>
                        {selectedUsers.includes(user.id) && (
                          <svg
                            className="h-full w-full text-primary-foreground"
                            viewBox="0 0 20 20"
                            fill="currentColor">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </>
              )}

              {/* Bots Section */}
              {botsLoading ? (
                <p className="text-xs text-muted-foreground px-3 py-2">
                  Đang tải bots...
                </p>
              ) : (
                bots.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground px-3 py-1 font-medium mt-2">
                      Bots
                    </p>
                    {bots.map((bot) => (
                      <button
                        key={bot.id}
                        onClick={() => toggleBot(bot.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                          selectedBots.includes(bot.id)
                            ? "bg-primary/10"
                            : "hover:bg-accent/50",
                        )}>
                        <div className="relative h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 text-left">
                          <span className="font-medium text-foreground block">
                            {bot.name}
                          </span>
                          {bot.username && (
                            <span className="text-xs text-muted-foreground">
                              @{bot.username}
                            </span>
                          )}
                        </div>
                        <div
                          className={cn(
                            "h-5 w-5 rounded-full border-2 transition-colors",
                            selectedBots.includes(bot.id)
                              ? "bg-primary border-primary"
                              : "border-border",
                          )}>
                          {selectedBots.includes(bot.id) && (
                            <svg
                              className="h-full w-full text-primary-foreground"
                              viewBox="0 0 20 20"
                              fill="currentColor">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </div>
                      </button>
                    ))}
                  </>
                )
              )}

              {availableUsers.length === 0 &&
                bots.length === 0 &&
                !botsLoading && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Không có người dùng hoặc bot nào để thêm
                  </p>
                )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-3">
          <button
            onClick={handleCreate}
            disabled={!groupName.trim() || totalSelected === 0 || loading}
            className={cn(
              "w-full rounded-lg py-2.5 font-medium transition-colors",
              groupName.trim() && totalSelected > 0
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}>
            {loading ? "Đang tạo..." : "Tạo nhóm"}
          </button>
        </div>
      </div>
    </div>
  );
}
