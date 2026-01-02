import { X, Phone, Video, Mail, Bell, BellOff, UserPlus, Users } from "lucide-react";
import { Chat, User } from "@/services/mockData";
import { AvatarWithStatus } from "./AvatarWithStatus";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ContactInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chat: Chat;
  participants: User[];
}

export function ContactInfoModal({
  open,
  onOpenChange,
  chat,
  participants,
}: ContactInfoModalProps) {
  const isGroup = chat.type === 'group';
  const contact = !isGroup ? participants.find(p => p.id !== 'user-1') : null;

  const getStatusText = (user: User) => {
    if (user.status === 'online') return 'Online';
    if (user.status === 'away') return 'Away';
    if (user.lastSeen) {
      return `Last seen ${format(user.lastSeen, 'MMM d, h:mm a')}`;
    }
    return 'Offline';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 bg-card border-border">
        <DialogHeader className="p-0">
          {/* Header with avatar */}
          <div className="relative bg-gradient-to-b from-primary/20 to-transparent pt-8 pb-4 px-6 flex flex-col items-center">
            <AvatarWithStatus
              src={chat.avatar}
              alt={chat.name}
              status={contact?.status}
              size="xl"
            />
            <DialogTitle className="mt-4 text-xl font-semibold text-foreground">
              {chat.name}
            </DialogTitle>
            {!isGroup && contact && (
              <p className={cn(
                "text-sm mt-1",
                contact.status === 'online' ? "text-primary" : "text-muted-foreground"
              )}>
                {getStatusText(contact)}
              </p>
            )}
            {isGroup && (
              <p className="text-sm text-muted-foreground mt-1">
                {participants.length} members
              </p>
            )}
          </div>
        </DialogHeader>

        {/* Action buttons */}
        <div className="flex justify-center gap-6 py-4 border-b border-border">
          <button className="flex flex-col items-center gap-1 text-primary hover:opacity-80 transition-opacity">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Phone className="h-5 w-5" />
            </div>
            <span className="text-xs">Call</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-primary hover:opacity-80 transition-opacity">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Video className="h-5 w-5" />
            </div>
            <span className="text-xs">Video</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-primary hover:opacity-80 transition-opacity">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <BellOff className="h-5 w-5" />
            </div>
            <span className="text-xs">Mute</span>
          </button>
        </div>

        <ScrollArea className="max-h-[300px]">
          {/* Contact Info Section */}
          {!isGroup && contact && (
            <div className="p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Info</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-foreground">{contact.name.toLowerCase().replace(' ', '.')}@email.com</p>
                    <p className="text-xs text-muted-foreground">Email</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-foreground">+1 (555) {Math.floor(Math.random() * 900 + 100)}-{Math.floor(Math.random() * 9000 + 1000)}</p>
                    <p className="text-xs text-muted-foreground">Phone</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Group Members Section */}
          {isGroup && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {participants.length} Members
                </h3>
                <Button variant="ghost" size="sm" className="text-primary h-8">
                  <UserPlus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {participants.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <AvatarWithStatus
                      src={member.avatar}
                      alt={member.name}
                      status={member.status}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {member.id === 'user-1' ? 'You' : member.name}
                      </p>
                      <p className={cn(
                        "text-xs truncate",
                        member.status === 'online' ? "text-primary" : "text-muted-foreground"
                      )}>
                        {getStatusText(member)}
                      </p>
                    </div>
                    {member.id === 'user-1' && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        You
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Shared Media Section (placeholder) */}
          <div className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Shared Media</h3>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="aspect-square rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs"
                >
                  No media
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
