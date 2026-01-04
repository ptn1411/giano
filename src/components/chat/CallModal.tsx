/**
 * Call Modal Component
 * Displays voice/video call UI with real mediasoup streams
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1 (retry button)
 */

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  formatCallDuration,
  getRemoteStream,
  selectCallDuration,
  selectCallState,
  selectCanRetry,
  selectCurrentCall,
  selectError,
  selectIsMuted,
  selectIsReconnecting,
  selectIsScreenSharing,
  selectIsVideoOff,
  selectLocalStream,
  selectReconnectAttempts,
  useCallStore,
} from "@/stores/callStore";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  Mic,
  MicOff,
  Monitor,
  Phone,
  PhoneOff,
  RefreshCw,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface CallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CallModal({ open, onOpenChange }: CallModalProps) {
  // Store state
  const callState = useCallStore(selectCallState);
  const currentCall = useCallStore(selectCurrentCall);
  const localStream = useCallStore(selectLocalStream);
  const isMuted = useCallStore(selectIsMuted);
  const isVideoOff = useCallStore(selectIsVideoOff);
  const isScreenSharing = useCallStore(selectIsScreenSharing);
  const callDuration = useCallStore(selectCallDuration);
  const error = useCallStore(selectError);
  const canRetry = useCallStore(selectCanRetry);
  const isReconnecting = useCallStore(selectIsReconnecting);
  const reconnectAttempts = useCallStore(selectReconnectAttempts);
  const remoteStream = useCallStore(getRemoteStream);
  const remoteParticipants = useCallStore((state) => state.remoteParticipants);

  // Store actions
  const endCall = useCallStore((state) => state.endCall);
  const acceptCall = useCallStore((state) => state.acceptCall);
  const toggleMute = useCallStore((state) => state.toggleMute);
  const toggleVideo = useCallStore((state) => state.toggleVideo);
  const toggleScreenShare = useCallStore((state) => state.toggleScreenShare);
  const retryCall = useCallStore((state) => state.retryCall);

  // Video refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoFullscreenRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoFullscreenRef = useRef<HTMLVideoElement>(null);

  // Speaker state (local UI only - not affecting actual audio output)
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  // Attach local stream to video element
  useEffect(() => {
    if (localStream) {
      console.log("[CallModal] Attaching local stream to video element");

      // Attach to both refs
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.play().catch((err) => {
          console.error(
            "[CallModal] Failed to play local video (non-fullscreen):",
            err
          );
        });
      }

      if (localVideoFullscreenRef.current) {
        localVideoFullscreenRef.current.srcObject = localStream;
        localVideoFullscreenRef.current.play().catch((err) => {
          console.error(
            "[CallModal] Failed to play local video (fullscreen):",
            err
          );
        });
      }

      // Log local video tracks state
      const videoTracks = localStream.getVideoTracks();
      const audioTracks = localStream.getAudioTracks();
      console.log("[CallModal] Local stream tracks:", {
        video: videoTracks.map((t) => ({
          id: t.id,
          label: t.label,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState,
        })),
        audio: audioTracks.map((t) => ({
          id: t.id,
          label: t.label,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState,
        })),
      });
    } else {
      console.log("[CallModal] Local stream not ready:", {
        hasLocalVideoRef: !!localVideoRef.current,
        hasLocalVideoFullscreenRef: !!localVideoFullscreenRef.current,
        hasStream: !!localStream,
      });
    }
  }, [localStream]);

  // Attach remote stream to video element
  // Requirement 7.1: Display remote video stream in main view
  useEffect(() => {
    if (remoteStream) {
      console.log("[CallModal] Attaching remote stream to video element");

      // Attach to both video refs
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch((err) => {
          console.error(
            "[CallModal] Failed to play remote video (non-fullscreen):",
            err
          );
        });
      }

      if (remoteVideoFullscreenRef.current) {
        remoteVideoFullscreenRef.current.srcObject = remoteStream;
        remoteVideoFullscreenRef.current.play().catch((err) => {
          console.error(
            "[CallModal] Failed to play remote video (fullscreen):",
            err
          );
        });
      }

      // Log video tracks state
      const videoTracks = remoteStream.getVideoTracks();
      const audioTracks = remoteStream.getAudioTracks();
      console.log("[CallModal] Remote stream tracks:", {
        video: videoTracks.map((t) => ({
          id: t.id,
          label: t.label,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState,
        })),
        audio: audioTracks.map((t) => ({
          id: t.id,
          label: t.label,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState,
        })),
      });
    }
  }, [remoteStream]);

  // Get remote participant info
  const remoteParticipant =
    remoteParticipants.size > 0
      ? Array.from(remoteParticipants.values())[0]
      : null;

  // Check if remote video is enabled
  // Requirement 7.3: Display avatar when remote video is off
  const isRemoteVideoEnabled = remoteParticipant?.videoEnabled ?? false;

  // Determine if we should show the modal based on call state
  const shouldShowModal = callState !== "idle";

  // Determine layout based on call type and state
  const isVideoCall = currentCall?.type === "video";
  const isFullscreen =
    isVideoCall && (callState === "connected" || callState === "reconnecting");

  // Debug logging
  useEffect(() => {
    console.log("[CallModal] State update:", {
      callState,
      hasCurrentCall: !!currentCall,
      isIncoming: currentCall?.isIncoming,
      hasLocalStream: !!localStream,
      hasRemoteStream: !!remoteStream,
      isVideoOff,
      isFullscreen,
      hasParticipant: !!remoteParticipant,
      videoEnabled: remoteParticipant?.videoEnabled,
      localTracks: localStream
        ? {
            audio: localStream.getAudioTracks().length,
            video: localStream.getVideoTracks().length,
          }
        : null,
      remoteTracks: remoteStream
        ? {
            audio: remoteStream.getAudioTracks().length,
            video: remoteStream.getVideoTracks().length,
          }
        : null,
    });
  }, [
    callState,
    currentCall,
    localStream,
    remoteStream,
    remoteParticipant,
    isVideoOff,
    isFullscreen,
  ]);

  // Handle modal close - end call if in progress
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && callState !== "idle") {
      endCall();
    }
    onOpenChange(newOpen);
  };

  // Get status text based on call state
  const getStatusText = () => {
    switch (callState) {
      case "calling":
        return "Calling...";
      case "ringing":
        return "Incoming call...";
      case "joining":
        return "Connecting...";
      case "producing":
        return "Setting up...";
      case "connected":
        return formatCallDuration(callDuration);
      case "reconnecting":
        return "Reconnecting...";
      default:
        return "";
    }
  };

  // Handle end call button
  const handleEndCall = () => {
    endCall();
  };

  // Don't render if no call info
  if (!currentCall) {
    return null;
  }

  return (
    <Dialog open={shouldShowModal && open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden border-none [&>button]:hidden",
          "transition-all duration-500 ease-out",
          isFullscreen
            ? "sm:max-w-[100vw] sm:max-h-[100vh] w-screen h-screen rounded-none bg-background"
            : "sm:max-w-md bg-gradient-to-b from-card to-background"
        )}>
        {/* Visually hidden title for accessibility */}
        <VisuallyHidden>
          <DialogTitle>
            {currentCall.type === "video" ? "Video Call" : "Voice Call"} with{" "}
            {currentCall.remoteUserName}
          </DialogTitle>
        </VisuallyHidden>

        {/* Error display with retry button - Requirement 8.1 */}
        {error && (
          <div className="absolute top-4 left-4 right-4 z-50 p-3 rounded-lg bg-destructive/90 text-destructive-foreground text-sm">
            <div className="flex items-start justify-between gap-2">
              <span>{error.message}</span>
              {canRetry && (
                <button
                  onClick={() => retryCall()}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-white/20 hover:bg-white/30 transition-colors text-xs font-medium">
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </button>
              )}
            </div>
          </div>
        )}

        {/* Fullscreen Video Layout - Requirement 7.4 */}
        {isFullscreen ? (
          <div className="relative w-full h-full flex flex-col animate-fade-in">
            {/* Video Area - takes most of the screen */}
            <div
              className="flex-1 relative bg-gradient-to-br from-primary/20 via-background to-accent/20 animate-scale-in"
              style={{ animationDelay: "100ms" }}>
              {/* Remote Video - Requirement 7.1 */}
              {remoteStream ? (
                <video
                  ref={remoteVideoFullscreenRef}
                  autoPlay
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                /* Avatar when no remote stream - Requirement 7.3 */
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80">
                  <Avatar className="h-32 w-32 border-4 border-green-500 mb-4">
                    <AvatarImage
                      src={currentCall.remoteUserAvatar}
                      alt={currentCall.remoteUserName}
                    />
                    <AvatarFallback className="text-4xl">
                      {currentCall.remoteUserName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <h2 className="text-2xl font-bold text-foreground">
                    {currentCall.remoteUserName}
                  </h2>
                  <p className="text-green-500 text-sm mt-1">
                    {getStatusText()}
                  </p>
                </div>
              )}

              {/* Local video preview - Requirement 7.2, 7.5 */}
              {!isVideoOff && localStream && (
                <div className="absolute bottom-4 right-4 w-40 h-28 rounded-xl bg-muted border-2 border-background shadow-xl overflow-hidden">
                  <video
                    ref={localVideoFullscreenRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror"
                    style={{ transform: "scaleX(-1)" }}
                  />
                </div>
              )}

              {/* Top bar with info */}
              <div
                className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-background/80 to-transparent animate-fade-in"
                style={{ animationDelay: "200ms" }}>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border-2 border-green-500">
                    <AvatarImage
                      src={currentCall.remoteUserAvatar}
                      alt={currentCall.remoteUserName}
                    />
                    <AvatarFallback>
                      {currentCall.remoteUserName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {currentCall.remoteUserName}
                    </h3>
                    <p className="text-xs text-green-500">{getStatusText()}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleOpenChange(false)}
                  className="p-2 rounded-full hover:bg-accent/50 text-muted-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Screen sharing indicator */}
              {isScreenSharing && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-primary/90 text-primary-foreground text-sm flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  <span>Đang chia sẻ màn hình</span>
                </div>
              )}

              {/* Reconnecting indicator - Requirement 8.2 */}
              {(callState === "reconnecting" || isReconnecting) && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-yellow-500/90 text-white text-sm flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>
                    Reconnecting
                    {reconnectAttempts > 0 ? ` (${reconnectAttempts}/3)` : ""}
                    ...
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Controls */}
            <div
              className="p-6 bg-gradient-to-t from-background via-background to-transparent animate-fade-in"
              style={{ animationDelay: "300ms" }}>
              <div className="flex items-center justify-center gap-4">
                {/* Mute */}
                <button
                  onClick={() => toggleMute()}
                  className={cn(
                    "h-14 w-14 rounded-full flex items-center justify-center transition-all",
                    isMuted
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-accent hover:bg-accent/80 text-foreground"
                  )}>
                  {isMuted ? (
                    <MicOff className="h-6 w-6" />
                  ) : (
                    <Mic className="h-6 w-6" />
                  )}
                </button>

                {/* Video toggle */}
                <button
                  onClick={() => toggleVideo()}
                  className={cn(
                    "h-14 w-14 rounded-full flex items-center justify-center transition-all",
                    isVideoOff
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-accent hover:bg-accent/80 text-foreground"
                  )}>
                  {isVideoOff ? (
                    <VideoOff className="h-6 w-6" />
                  ) : (
                    <Video className="h-6 w-6" />
                  )}
                </button>

                {/* Screen Share */}
                <button
                  onClick={() => toggleScreenShare()}
                  className={cn(
                    "h-14 w-14 rounded-full flex items-center justify-center transition-all",
                    isScreenSharing
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent hover:bg-accent/80 text-foreground"
                  )}>
                  <Monitor className="h-6 w-6" />
                </button>

                {/* End call */}
                <button
                  onClick={handleEndCall}
                  className="h-16 w-16 rounded-full bg-destructive flex items-center justify-center shadow-lg hover:bg-destructive/90 transition-all">
                  <PhoneOff className="h-7 w-7 text-destructive-foreground" />
                </button>

                {/* Speaker */}
                <button
                  onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                  className={cn(
                    "h-14 w-14 rounded-full flex items-center justify-center transition-all",
                    !isSpeakerOn
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-accent hover:bg-accent/80 text-foreground"
                  )}>
                  {isSpeakerOn ? (
                    <Volume2 className="h-6 w-6" />
                  ) : (
                    <VolumeX className="h-6 w-6" />
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Non-fullscreen layout (calling/ringing/connecting states) */
          <div className="relative flex flex-col items-center justify-center py-12 px-6 min-h-[400px]">
            {/* Blur background effect when connecting */}
            {(callState === "joining" || callState === "producing") && (
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-primary/30 animate-pulse" />
                <div className="absolute inset-0 backdrop-blur-sm" />
                <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-primary/40 rounded-full blur-3xl animate-pulse" />
                <div
                  className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-accent/40 rounded-full blur-3xl animate-pulse"
                  style={{ animationDelay: "500ms" }}
                />
              </div>
            )}

            {/* Close button */}
            <button
              onClick={() => handleOpenChange(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-accent/50 text-muted-foreground z-10">
              <X className="h-5 w-5" />
            </button>

            {/* Avatar with pulse animation */}
            <div className="relative mb-6 z-10">
              <div
                className={cn(
                  "absolute inset-0 rounded-full animate-ping opacity-25",
                  (callState === "calling" || callState === "ringing") &&
                    "bg-primary",
                  (callState === "joining" || callState === "producing") &&
                    "bg-yellow-500",
                  callState === "connected" &&
                    "bg-green-500 animate-none opacity-0"
                )}
                style={{ animationDuration: "1.5s" }}
              />
              <Avatar
                className={cn(
                  "h-28 w-28 border-4 transition-all duration-300",
                  callState === "connected"
                    ? "border-green-500"
                    : "border-primary"
                )}>
                <AvatarImage
                  src={currentCall.remoteUserAvatar}
                  alt={currentCall.remoteUserName}
                />
                <AvatarFallback className="text-3xl">
                  {currentCall.remoteUserName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              {callState === "connected" && (
                <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-green-500 flex items-center justify-center">
                  {isVideoCall ? (
                    <Video className="h-4 w-4 text-white" />
                  ) : (
                    <Phone className="h-4 w-4 text-white" />
                  )}
                </div>
              )}
            </div>

            {/* Contact Info */}
            <h2 className="text-2xl font-bold text-foreground mb-1 z-10">
              {currentCall.remoteUserName}
            </h2>
            <p
              className={cn(
                "text-sm mb-8 z-10",
                callState === "connected"
                  ? "text-green-500"
                  : "text-muted-foreground"
              )}>
              {getStatusText()}
            </p>

            {/* Call Type Badge */}
            <div className="flex items-center gap-2 mb-8 px-4 py-2 rounded-full bg-primary/10 z-10">
              {isVideoCall ? (
                <Video className="h-4 w-4 text-primary" />
              ) : (
                <Phone className="h-4 w-4 text-primary" />
              )}
              <span className="text-sm text-primary font-medium">
                {isVideoCall ? "Video Call" : "Voice Call"}
              </span>
            </div>

            {/* Local video preview for non-fullscreen video calls */}
            {isVideoCall &&
              !isVideoOff &&
              localStream &&
              (callState === "calling" ||
                callState === "joining" ||
                callState === "producing") && (
                <div className="mb-8 w-48 h-36 rounded-xl bg-muted border-2 border-primary shadow-xl overflow-hidden z-10">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror"
                    style={{ transform: "scaleX(-1)" }}
                  />
                </div>
              )}

            {/* Controls */}
            {callState === "ringing" && currentCall?.isIncoming ? (
              /* Accept/Decline buttons for incoming call */
              <div className="flex items-center gap-4 z-10">
                <button
                  onClick={handleEndCall}
                  className="h-16 px-8 rounded-full bg-destructive flex items-center justify-center gap-2 shadow-lg hover:bg-destructive/90 transition-all">
                  <PhoneOff className="h-6 w-6 text-destructive-foreground" />
                  <span className="text-destructive-foreground font-medium">
                    Decline
                  </span>
                </button>
                <button
                  onClick={async () => await acceptCall()}
                  className="h-16 px-8 rounded-full bg-green-500 flex items-center justify-center gap-2 shadow-lg hover:bg-green-600 transition-all animate-pulse"
                  style={{ animationDuration: "2s" }}>
                  {isVideoCall ? (
                    <Video className="h-6 w-6 text-white" />
                  ) : (
                    <Phone className="h-6 w-6 text-white" />
                  )}
                  <span className="text-white font-medium">Accept</span>
                </button>
              </div>
            ) : (
              /* Regular call controls */
              <div className="flex items-center gap-4 z-10">
                {/* Mute */}
                <button
                  onClick={() => toggleMute()}
                  className={cn(
                    "h-14 w-14 rounded-full flex items-center justify-center transition-all",
                    isMuted
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-accent hover:bg-accent/80 text-foreground"
                  )}>
                  {isMuted ? (
                    <MicOff className="h-6 w-6" />
                  ) : (
                    <Mic className="h-6 w-6" />
                  )}
                </button>

                {/* Video toggle (for video calls) */}
                {isVideoCall && (
                  <button
                    onClick={() => toggleVideo()}
                    className={cn(
                      "h-14 w-14 rounded-full flex items-center justify-center transition-all",
                      isVideoOff
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-accent hover:bg-accent/80 text-foreground"
                    )}>
                    {isVideoOff ? (
                      <VideoOff className="h-6 w-6" />
                    ) : (
                      <Video className="h-6 w-6" />
                    )}
                  </button>
                )}

                {/* End call button */}
                <button
                  onClick={handleEndCall}
                  className="h-16 w-16 rounded-full bg-destructive flex items-center justify-center shadow-lg hover:bg-destructive/90 transition-all">
                  <PhoneOff className="h-7 w-7 text-destructive-foreground" />
                </button>

                {/* Speaker */}
                <button
                  onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                  className={cn(
                    "h-14 w-14 rounded-full flex items-center justify-center transition-all",
                    !isSpeakerOn
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-accent hover:bg-accent/80 text-foreground"
                  )}>
                  {isSpeakerOn ? (
                    <Volume2 className="h-6 w-6" />
                  ) : (
                    <VolumeX className="h-6 w-6" />
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
