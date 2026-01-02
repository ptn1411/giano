import { useState } from "react";
import { Mic, MicOff, Hand, LogOut, Users, Volume2, Settings, Crown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { User } from "@/services/mockData";

interface VoiceRoomParticipant extends User {
  isSpeaking?: boolean;
  isMuted?: boolean;
  isHost?: boolean;
  hasRaisedHand?: boolean;
}

interface VoiceRoomModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomName: string;
  participants: User[];
}

export function VoiceRoomModal({
  open,
  onOpenChange,
  roomName,
  participants,
}: VoiceRoomModalProps) {
  const [isMuted, setIsMuted] = useState(true);
  const [hasRaisedHand, setHasRaisedHand] = useState(false);

  // Mock participants with speaking states
  const mockParticipants: VoiceRoomParticipant[] = participants.map((p, i) => ({
    ...p,
    isSpeaking: i === 1 && !isMuted,
    isMuted: i !== 1,
    isHost: i === 0,
    hasRaisedHand: i === 3,
  }));

  // Add current user
  const currentUser: VoiceRoomParticipant = {
    id: 'user-1',
    name: 'You',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=You',
    status: 'online',
    isSpeaking: !isMuted,
    isMuted: isMuted,
    isHost: false,
    hasRaisedHand: hasRaisedHand,
  };

  const allParticipants = [currentUser, ...mockParticipants];
  const speakers = allParticipants.filter(p => !p.isMuted || p.isHost);
  const listeners = allParticipants.filter(p => p.isMuted && !p.isHost);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 max-h-[90vh] overflow-hidden bg-card">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">{roomName}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                <Users className="h-4 w-4" />
                {allParticipants.length} participants
              </p>
            </div>
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[400px]">
          {/* Speakers Section */}
          <div className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Speakers
            </h3>
            <div className="grid grid-cols-4 gap-4">
              {speakers.map((participant) => (
                <div key={participant.id} className="flex flex-col items-center">
                  <div className="relative">
                    <div className={cn(
                      "absolute -inset-1 rounded-full transition-all duration-300",
                      participant.isSpeaking && "bg-primary/30 animate-pulse"
                    )} />
                    <Avatar className={cn(
                      "h-16 w-16 border-2 transition-all",
                      participant.isSpeaking ? "border-primary" : "border-transparent"
                    )}>
                      <AvatarImage src={participant.avatar} alt={participant.name} />
                      <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    {participant.isHost && (
                      <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-yellow-500 flex items-center justify-center">
                        <Crown className="h-3 w-3 text-white" />
                      </div>
                    )}
                    {participant.isMuted && (
                      <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-destructive flex items-center justify-center">
                        <MicOff className="h-3 w-3 text-destructive-foreground" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-medium text-foreground mt-2 text-center truncate w-full">
                    {participant.id === 'user-1' ? 'You' : participant.name.split(' ')[0]}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Listeners Section */}
          {listeners.length > 0 && (
            <div className="p-4 pt-0">
              <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Listeners
              </h3>
              <div className="grid grid-cols-4 gap-4">
                {listeners.map((participant) => (
                  <div key={participant.id} className="flex flex-col items-center">
                    <div className="relative">
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={participant.avatar} alt={participant.name} />
                        <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      {participant.hasRaisedHand && (
                        <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-yellow-500 flex items-center justify-center animate-bounce">
                          <Hand className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center truncate w-full">
                      {participant.name.split(' ')[0]}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Controls */}
        <div className="p-4 border-t border-border bg-muted/30">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setHasRaisedHand(!hasRaisedHand)}
              className={cn(
                "h-12 w-12 rounded-full flex items-center justify-center transition-all",
                hasRaisedHand 
                  ? "bg-yellow-500 text-white" 
                  : "bg-accent hover:bg-accent/80 text-foreground"
              )}
            >
              <Hand className="h-5 w-5" />
            </button>

            <button
              onClick={() => setIsMuted(!isMuted)}
              className={cn(
                "h-14 w-14 rounded-full flex items-center justify-center transition-all",
                isMuted 
                  ? "bg-destructive text-destructive-foreground" 
                  : "bg-primary text-primary-foreground"
              )}
            >
              {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </button>

            <button
              onClick={() => onOpenChange(false)}
              className="h-12 w-12 rounded-full bg-destructive/20 text-destructive flex items-center justify-center hover:bg-destructive/30 transition-all"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
          <p className="text-xs text-center text-muted-foreground mt-3">
            {isMuted ? "You're muted. Tap to speak." : "You're speaking"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
