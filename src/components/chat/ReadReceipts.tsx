import { useMemo } from "react";
import { User, ReadReceipt } from "@/services/mockData";
import { AvatarWithStatus } from "./AvatarWithStatus";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";

interface ReadReceiptsProps {
  readBy: ReadReceipt[];
  users: User[];
  isOwn: boolean;
  maxDisplay?: number;
}

export function ReadReceipts({ readBy, users, isOwn, maxDisplay = 3 }: ReadReceiptsProps) {
  const readUsers = useMemo(() => {
    return readBy
      .map((receipt) => {
        const user = users.find((u) => u.id === receipt.userId);
        return user ? { ...user, readAt: receipt.readAt } : null;
      })
      .filter((u): u is User & { readAt: Date } => u !== null);
  }, [readBy, users]);

  if (readUsers.length === 0) return null;

  const displayUsers = readUsers.slice(0, maxDisplay);
  const remainingCount = readUsers.length - maxDisplay;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center mt-1 cursor-pointer",
            isOwn ? "justify-end" : "justify-start"
          )}
        >
          <div className="flex -space-x-1.5">
            {displayUsers.map((user) => (
              <div
                key={user.id}
                className="ring-2 ring-background rounded-full"
              >
                <AvatarWithStatus
                  src={user.avatar}
                  alt={user.name}
                  size="xs"
                />
              </div>
            ))}
          </div>
          {remainingCount > 0 && (
            <span className="ml-1 text-[10px] text-muted-foreground">
              +{remainingCount}
            </span>
          )}
          <span className="ml-1.5 text-[10px] text-muted-foreground">
            Seen
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[220px] p-2">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-foreground mb-2">
            Seen by {readUsers.length} {readUsers.length === 1 ? 'person' : 'people'}
          </p>
          {readUsers.map((user) => (
            <div key={user.id} className="flex items-center gap-2">
              <AvatarWithStatus
                src={user.avatar}
                alt={user.name}
                size="xs"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {user.name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(user.readAt), 'MMM d, HH:mm')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}