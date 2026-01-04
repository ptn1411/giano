/**
 * Incoming Call Notification Component
 * Global notification for incoming calls with accept/decline buttons
 * Requirements: 2.1, 2.2, 2.5
 */

import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { 
  useCallStore, 
  selectCallState, 
  selectCurrentCall,
  selectIsRinging,
} from "@/stores/callStore";

// Ringtone audio (using a simple beep pattern)
const RINGTONE_FREQUENCY = 440; // Hz
const RINGTONE_DURATION = 200; // ms
const RINGTONE_INTERVAL = 1000; // ms

interface IncomingCallNotificationProps {
  className?: string;
}

export function IncomingCallNotification({ className }: IncomingCallNotificationProps) {
  // Store state
  const callState = useCallStore(selectCallState);
  const currentCall = useCallStore(selectCurrentCall);
  const isRinging = useCallStore(selectIsRinging);

  // Store actions
  const acceptCall = useCallStore((state) => state.acceptCall);
  const declineCall = useCallStore((state) => state.declineCall);

  // Countdown timer for auto-decline (30 seconds)
  const [countdown, setCountdown] = useState(30);
  
  // Audio context for ringtone
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringtoneIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Only show for incoming calls in ringing state
  const shouldShow = isRinging && currentCall?.isIncoming;

  /**
   * Play ringtone sound
   * Requirement 2.1: Play ringtone for incoming calls
   */
  const playRingtone = () => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }

    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = RINGTONE_FREQUENCY;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + RINGTONE_DURATION / 1000);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + RINGTONE_DURATION / 1000);
  };

  /**
   * Stop ringtone
   */
  const stopRingtone = () => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  // Start/stop ringtone based on ringing state
  useEffect(() => {
    if (shouldShow) {
      // Start ringtone
      playRingtone();
      ringtoneIntervalRef.current = setInterval(playRingtone, RINGTONE_INTERVAL);

      // Reset countdown
      setCountdown(30);
    } else {
      // Stop ringtone
      stopRingtone();
    }

    return () => {
      stopRingtone();
    };
  }, [shouldShow]);

  // Countdown timer
  // Requirement 2.5: Auto-decline after 30 seconds (handled by callStore, but we show countdown)
  useEffect(() => {
    if (!shouldShow) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [shouldShow]);

  /**
   * Handle accept call
   * Requirement 2.2: Accept button functionality
   */
  const handleAccept = async () => {
    stopRingtone();
    await acceptCall();
  };

  /**
   * Handle decline call
   * Requirement 2.2: Decline button functionality
   */
  const handleDecline = () => {
    stopRingtone();
    declineCall();
  };

  if (!shouldShow || !currentCall) {
    return null;
  }

  const isVideoCall = currentCall.type === 'video';

  return (
    <div 
      className={cn(
        "fixed top-4 left-1/2 -translate-x-1/2 z-[100]",
        "w-full max-w-sm mx-auto px-4",
        "animate-in slide-in-from-top-4 fade-in duration-300",
        className
      )}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 animate-pulse" />
        
        <div className="relative p-4">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            {/* Avatar with pulse animation */}
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-25" style={{ animationDuration: '1.5s' }} />
              <Avatar className="h-14 w-14 border-2 border-primary">
                <AvatarImage src={currentCall.remoteUserAvatar} alt={currentCall.remoteUserName} />
                <AvatarFallback className="text-lg">{currentCall.remoteUserName.charAt(0)}</AvatarFallback>
              </Avatar>
            </div>

            {/* Caller info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {currentCall.remoteUserName}
              </h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                {isVideoCall ? (
                  <>
                    <Video className="h-3 w-3" />
                    <span>Incoming video call</span>
                  </>
                ) : (
                  <>
                    <Phone className="h-3 w-3" />
                    <span>Incoming voice call</span>
                  </>
                )}
              </p>
            </div>

            {/* Countdown */}
            <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
              {countdown}s
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-4">
            {/* Decline button */}
            <button
              onClick={handleDecline}
              className={cn(
                "flex items-center justify-center gap-2 px-6 py-3 rounded-full",
                "bg-destructive text-destructive-foreground",
                "hover:bg-destructive/90 transition-all",
                "shadow-lg hover:shadow-xl"
              )}
            >
              <PhoneOff className="h-5 w-5" />
              <span className="font-medium">Decline</span>
            </button>

            {/* Accept button */}
            <button
              onClick={handleAccept}
              className={cn(
                "flex items-center justify-center gap-2 px-6 py-3 rounded-full",
                "bg-green-500 text-white",
                "hover:bg-green-600 transition-all",
                "shadow-lg hover:shadow-xl",
                "animate-pulse"
              )}
              style={{ animationDuration: '2s' }}
            >
              {isVideoCall ? (
                <Video className="h-5 w-5" />
              ) : (
                <Phone className="h-5 w-5" />
              )}
              <span className="font-medium">Accept</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IncomingCallNotification;
