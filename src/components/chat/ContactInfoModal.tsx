import { X, Phone, Video, Mail, Bell, BellOff, UserPlus, Users, Image, FileText, Play } from "lucide-react";
import { Chat, User, Attachment } from "@/services/api/types";
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
import { useAuthStore } from "@/stores/authStore";

interface ContactInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chat: Chat;
  participants: User[];
  sharedMedia?: Attachment[];
}

export function ContactInfoModal({
  open,
  onOpenChange,
  chat,
  participants,
  sharedMedia = [],
}: ContactInfoModalProps) {
  const currentUserId = useAuthStore((state) => state.session?.user?.id);
  const isGroup = chat.type === 'group';
  const contact = !isGroup ? participants.find(p => p.id !== currentUserId) : null;

  // Filter media by type
  const images = sharedMedia.filter(m => m.type === 'image');
  const files = sharedMedia.filter(m => m.type === 'file');
  const voices = sharedMedia.filter(m => m.type === 'voice');

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
                {contact.bio && (
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-foreground">{contact.bio}</p>
                      <p className="text-xs text-muted-foreground">Bio</p>
                    </div>
                  </div>
                )}
                {contact.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-foreground">{contact.email}</p>
                      <p className="text-xs text-muted-foreground">Email</p>
                    </div>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-foreground">{contact.phone}</p>
                      <p className="text-xs text-muted-foreground">Phone</p>
                    </div>
                  </div>
                )}
                {!contact.email && !contact.phone && !contact.bio && (
                  <p className="text-sm text-muted-foreground italic">No information available</p>
                )}
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
                        {member.id === currentUserId ? 'You' : member.name}
                      </p>
                      <p className={cn(
                        "text-xs truncate",
                        member.status === 'online' ? "text-primary" : "text-muted-foreground"
                      )}>
                        {getStatusText(member)}
                      </p>
                    </div>
                    {member.id === currentUserId && (
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

          {/* Shared Media Section */}
          <div className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Image className="h-4 w-4" />
              Shared Media ({sharedMedia.length})
            </h3>
            
            {sharedMedia.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-4">
                No shared media yet
              </p>
            ) : (
              <div className="space-y-4">
                {/* Images */}
                {images.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Images ({images.length})</p>
                    <div className="grid grid-cols-3 gap-2">
                      {images.slice(0, 6).map((img) => (
                        <a
                          key={img.id}
                          href={img.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-80 transition-opacity"
                        >
                          <img
                            src={img.url}
                            alt={img.name}
                            className="w-full h-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                    {images.length > 6 && (
                      <p className="text-xs text-primary mt-2 cursor-pointer hover:underline">
                        View all {images.length} images
                      </p>
                    )}
                  </div>
                )}

                {/* Files */}
                {files.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Files ({files.length})</p>
                    <div className="space-y-2">
                      {files.slice(0, 3).map((file) => (
                        <a
                          key={file.id}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <FileText className="h-8 w-8 text-primary" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                    {files.length > 3 && (
                      <p className="text-xs text-primary mt-2 cursor-pointer hover:underline">
                        View all {files.length} files
                      </p>
                    )}
                  </div>
                )}

                {/* Voice messages */}
                {voices.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Voice messages ({voices.length})</p>
                    <div className="space-y-2">
                      {voices.slice(0, 3).map((voice) => (
                        <div
                          key={voice.id}
                          className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                        >
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Play className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-foreground">Voice message</p>
                            <p className="text-xs text-muted-foreground">
                              {voice.duration ? `${Math.floor(voice.duration / 60)}:${(voice.duration % 60).toString().padStart(2, '0')}` : '--:--'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
