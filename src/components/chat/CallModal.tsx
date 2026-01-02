import { useState, useEffect } from "react";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, VolumeX, X, Monitor, Maximize2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type CallState = 'ringing' | 'connecting' | 'connected' | 'ended';
type CallType = 'voice' | 'video';

interface CallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callType: CallType;
  contactName: string;
  contactAvatar: string;
  isIncoming?: boolean;
}

export function CallModal({
  open,
  onOpenChange,
  callType,
  contactName,
  contactAvatar,
  isIncoming = false,
}: CallModalProps) {
  const [callState, setCallState] = useState<CallState>('ringing');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  useEffect(() => {
    if (!open) {
      setCallState('ringing');
      setDuration(0);
      setIsMuted(false);
      setIsVideoOff(false);
      return;
    }

    // Simulate call connection
    if (callState === 'ringing') {
      const timer = setTimeout(() => {
        setCallState('connecting');
      }, 2000);
      return () => clearTimeout(timer);
    }

    if (callState === 'connecting') {
      const timer = setTimeout(() => {
        setCallState('connected');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [open, callState]);

  // Duration timer
  useEffect(() => {
    if (callState !== 'connected') return;
    
    const interval = setInterval(() => {
      setDuration(d => d + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [callState]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    switch (callState) {
      case 'ringing': return isIncoming ? 'Incoming call...' : 'Calling...';
      case 'connecting': return 'Connecting...';
      case 'connected': return formatDuration(duration);
      case 'ended': return 'Call ended';
    }
  };

  const handleEndCall = () => {
    setCallState('ended');
    setTimeout(() => onOpenChange(false), 500);
  };

  const handleAcceptCall = () => {
    setCallState('connecting');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden bg-gradient-to-b from-card to-background border-none">
        {/* Video Background (for video calls) */}
        {callType === 'video' && callState === 'connected' && !isVideoOff && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/20">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-muted-foreground text-sm">Video stream placeholder</div>
            </div>
            {/* Self video preview */}
            <div className="absolute bottom-24 right-4 w-32 h-24 rounded-lg bg-muted border-2 border-background shadow-lg flex items-center justify-center">
              <span className="text-xs text-muted-foreground">You</span>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className={cn(
          "relative flex flex-col items-center justify-center py-12 px-6 min-h-[400px]",
          callType === 'video' && callState === 'connected' && !isVideoOff && "bg-transparent"
        )}>
          {/* Close button */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-accent/50 text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Avatar with pulse animation */}
          <div className="relative mb-6">
            <div className={cn(
              "absolute inset-0 rounded-full animate-ping opacity-25",
              callState === 'ringing' && "bg-primary",
              callState === 'connecting' && "bg-yellow-500",
              callState === 'connected' && "bg-green-500 animate-none opacity-0"
            )} style={{ animationDuration: '1.5s' }} />
            <Avatar className={cn(
              "h-28 w-28 border-4 transition-all duration-300",
              callState === 'connected' ? "border-green-500" : "border-primary"
            )}>
              <AvatarImage src={contactAvatar} alt={contactName} />
              <AvatarFallback className="text-3xl">{contactName.charAt(0)}</AvatarFallback>
            </Avatar>
            {callState === 'connected' && (
              <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-green-500 flex items-center justify-center">
                {callType === 'video' ? (
                  <Video className="h-4 w-4 text-white" />
                ) : (
                  <Phone className="h-4 w-4 text-white" />
                )}
              </div>
            )}
          </div>

          {/* Contact Info */}
          <h2 className="text-2xl font-bold text-foreground mb-1">{contactName}</h2>
          <p className={cn(
            "text-sm mb-8",
            callState === 'connected' ? "text-green-500" : "text-muted-foreground"
          )}>
            {getStatusText()}
          </p>

          {/* Call Type Badge */}
          <div className="flex items-center gap-2 mb-8 px-4 py-2 rounded-full bg-primary/10">
            {callType === 'video' ? (
              <Video className="h-4 w-4 text-primary" />
            ) : (
              <Phone className="h-4 w-4 text-primary" />
            )}
            <span className="text-sm text-primary font-medium">
              {callType === 'video' ? 'Video Call' : 'Voice Call'}
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            {/* Mute */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={cn(
                "h-14 w-14 rounded-full flex items-center justify-center transition-all",
                isMuted ? "bg-destructive text-destructive-foreground" : "bg-accent hover:bg-accent/80 text-foreground"
              )}
            >
              {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </button>

            {/* Video toggle (for video calls) */}
            {callType === 'video' && (
              <button
                onClick={() => setIsVideoOff(!isVideoOff)}
                className={cn(
                  "h-14 w-14 rounded-full flex items-center justify-center transition-all",
                  isVideoOff ? "bg-destructive text-destructive-foreground" : "bg-accent hover:bg-accent/80 text-foreground"
                )}
              >
                {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
              </button>
            )}

            {/* End call / Accept call */}
            {isIncoming && callState === 'ringing' ? (
              <>
                <button
                  onClick={handleEndCall}
                  className="h-16 w-16 rounded-full bg-destructive flex items-center justify-center shadow-lg hover:bg-destructive/90 transition-all"
                >
                  <PhoneOff className="h-7 w-7 text-destructive-foreground" />
                </button>
                <button
                  onClick={handleAcceptCall}
                  className="h-16 w-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg hover:bg-green-600 transition-all"
                >
                  <Phone className="h-7 w-7 text-white" />
                </button>
              </>
            ) : (
              <button
                onClick={handleEndCall}
                className="h-16 w-16 rounded-full bg-destructive flex items-center justify-center shadow-lg hover:bg-destructive/90 transition-all"
              >
                <PhoneOff className="h-7 w-7 text-destructive-foreground" />
              </button>
            )}

            {/* Speaker */}
            <button
              onClick={() => setIsSpeakerOn(!isSpeakerOn)}
              className={cn(
                "h-14 w-14 rounded-full flex items-center justify-center transition-all",
                !isSpeakerOn ? "bg-destructive text-destructive-foreground" : "bg-accent hover:bg-accent/80 text-foreground"
              )}
            >
              {isSpeakerOn ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
