/**
 * Call Store
 * Manages voice/video call state using Zustand with mediasoup integration
 * Requirements: 1.1, 1.2, 2.3, 2.4, 5.1, 1.4, 8.1, 8.2, 8.4
 */

import {
  CallType,
  getMediaHandler,
  resetMediaHandler,
} from "@/services/mediaHandler";
import {
  getMediasoupService,
  MediasoupEventHandlers,
  resetMediasoupService,
} from "@/services/mediasoup";
import { useAuthStore } from "@/stores/authStore";
import { types } from "mediasoup-client";
import { create } from "zustand";

// ============================================
// WebSocket Send Functions (injected to avoid circular dependency)
// ============================================

interface WebSocketSendFunctions {
  sendInitiateCall: (
    targetUserId: string,
    chatId: string,
    callType: CallType
  ) => boolean;
  sendAcceptCall: (callId: string) => boolean;
  sendDeclineCall: (callId: string) => boolean;
  sendEndCall: (callId: string) => boolean;
}

let wsSendFunctions: WebSocketSendFunctions | null = null;

/**
 * Inject WebSocket send functions to avoid circular dependency
 * Called from websocket.ts after wsClient is created
 */
export function injectWebSocketFunctions(
  functions: WebSocketSendFunctions
): void {
  wsSendFunctions = functions;
}

// ============================================
// Types
// ============================================

export type CallState =
  | "idle"
  | "calling"
  | "ringing"
  | "joining"
  | "producing"
  | "connected"
  | "reconnecting";

/**
 * Error types for call failures
 * Requirement 1.4, 8.1, 8.2, 8.4
 */
export type CallErrorType =
  | "permission_denied" // Media permission denied (Req 1.4)
  | "connection_failed" // WebRTC/mediasoup connection failed (Req 8.1)
  | "network_error" // Network connection lost (Req 8.2)
  | "server_unreachable" // STUN/TURN/mediasoup server unreachable (Req 8.4)
  | "timeout" // Call or reconnection timeout
  | "user_busy" // Remote user is busy
  | "user_offline" // Remote user is offline
  | "call_declined" // Call was declined
  | "not_chat_participant" // User is not a participant of the chat (Req 6.5)
  | "unknown"; // Unknown error

export interface CallError {
  type: CallErrorType;
  message: string;
  canRetry: boolean;
}

export interface CallInfo {
  id: string;
  roomId: string;
  type: CallType;
  remoteUserId: string;
  remoteUserName: string;
  remoteUserAvatar: string;
  chatId: string;
  isIncoming: boolean;
  currentUserId?: string;
  startTime?: Date;
}

export interface RemoteParticipant {
  oderId: string;
  name: string;
  avatar: string;
  audioConsumer?: types.Consumer;
  videoConsumer?: types.Consumer;
  audioEnabled: boolean;
  videoEnabled: boolean;
  stream?: MediaStream;
}

// Incoming call event from WebSocket
export interface IncomingCallEvent {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  chatId: string;
  callType: "voice" | "video";
}

// Call initiated event from WebSocket (sent to caller with real call ID)
export interface CallInitiatedEvent {
  callId: string;
}

// Call accepted event from WebSocket
export interface CallAcceptedEvent {
  callId: string;
  roomId: string;
  mediasoupUrl: string;
}

// Call declined event from WebSocket
export interface CallDeclinedEvent {
  callId: string;
}

// Call ended event from WebSocket
export interface CallEndedEvent {
  callId: string;
  reason: "ended" | "timeout" | "error";
}

// User busy event from WebSocket
export interface UserBusyEvent {
  callId: string;
}

interface CallStoreState {
  // State
  callState: CallState;
  currentCall: CallInfo | null;
  localStream: MediaStream | null;
  remoteParticipants: Map<string, RemoteParticipant>;

  // Media state
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;

  // Error state (enhanced for Req 1.4, 8.1, 8.2, 8.4)
  error: CallError | null;

  // Call duration
  callDuration: number;

  // Reconnection state (Req 8.2)
  reconnectAttempts: number;
  isReconnecting: boolean;

  // Actions
  initiateCall: (
    userId: string,
    userName: string,
    userAvatar: string,
    chatId: string,
    type: CallType,
    currentUserId: string
  ) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;

  // Retry action (Req 8.1)
  retryCall: () => Promise<void>;

  // Media controls
  toggleMute: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;

  // Event handlers (called by WebSocket service)
  handleCallInitiated: (event: CallInitiatedEvent) => void;
  handleIncomingCall: (event: IncomingCallEvent) => void;
  handleCallAccepted: (event: CallAcceptedEvent) => void;
  handleCallDeclined: (event: CallDeclinedEvent) => void;
  handleCallEnded: (event: CallEndedEvent) => void;
  handleUserBusy: (event: UserBusyEvent) => void;

  // Internal actions
  _setCallState: (state: CallState) => void;
  _setError: (error: CallError | null) => void;
  _setErrorFromType: (type: CallErrorType, customMessage?: string) => void;
  _cleanup: () => void;
  _startDurationTimer: () => void;
  _stopDurationTimer: () => void;
  _startReconnection: () => void;
  _stopReconnection: () => void;
}

// Duration timer reference
let durationInterval: ReturnType<typeof setInterval> | null = null;

// Incoming call timeout (30 seconds)
let incomingCallTimeout: ReturnType<typeof setTimeout> | null = null;
const INCOMING_CALL_TIMEOUT_MS = 30000;

// Reconnection timeout (10 seconds as per Requirement 8.2)
let reconnectionTimeout: ReturnType<typeof setTimeout> | null = null;
const RECONNECTION_TIMEOUT_MS = 10000;
const MAX_RECONNECT_ATTEMPTS = 3;

// Track recently ended calls to prevent race conditions
// Stores call IDs that have ended in the last 5 seconds
const recentlyEndedCalls = new Set<string>();
const RECENTLY_ENDED_TIMEOUT_MS = 5000;

function markCallAsEnded(callId: string) {
  recentlyEndedCalls.add(callId);
  setTimeout(() => {
    recentlyEndedCalls.delete(callId);
  }, RECENTLY_ENDED_TIMEOUT_MS);
}

// ============================================
// Error Message Mapping
// ============================================

/**
 * Get user-friendly error message and retry capability based on error type
 * Requirements: 1.4, 8.1, 8.2, 8.4
 */
function getCallError(type: CallErrorType, customMessage?: string): CallError {
  const errorMap: Record<
    CallErrorType,
    { message: string; canRetry: boolean }
  > = {
    permission_denied: {
      message:
        customMessage ||
        "Camera or microphone permission denied. Please allow access in your browser settings.",
      canRetry: false,
    },
    connection_failed: {
      message:
        customMessage ||
        "Connection failed. Please check your internet connection and try again.",
      canRetry: true,
    },
    network_error: {
      message:
        customMessage || "Network connection lost. Attempting to reconnect...",
      canRetry: true,
    },
    server_unreachable: {
      message:
        customMessage ||
        "Unable to connect to the call server. Please try again later.",
      canRetry: true,
    },
    timeout: {
      message: customMessage || "Connection timed out. Please try again.",
      canRetry: true,
    },
    user_busy: {
      message: customMessage || "User is busy on another call.",
      canRetry: false,
    },
    user_offline: {
      message: customMessage || "User is currently offline.",
      canRetry: false,
    },
    call_declined: {
      message: customMessage || "Call was declined.",
      canRetry: false,
    },
    not_chat_participant: {
      message: customMessage || "You can only call users you have a chat with.",
      canRetry: false,
    },
    unknown: {
      message:
        customMessage || "An unexpected error occurred. Please try again.",
      canRetry: true,
    },
  };

  const errorInfo = errorMap[type];
  return {
    type,
    message: errorInfo.message,
    canRetry: errorInfo.canRetry,
  };
}

/**
 * Determine error type from error object
 */
function determineErrorType(error: Error): CallErrorType {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  // Not chat participant error (Req 6.5)
  if (
    message.includes("not_chat_participant") ||
    message.includes("not a participant")
  ) {
    return "not_chat_participant";
  }

  // Permission denied errors (Req 1.4)
  if (
    name === "notallowederror" ||
    name === "permissiondeniederror" ||
    message.includes("permission denied") ||
    message.includes("not allowed")
  ) {
    return "permission_denied";
  }

  // Network/connection errors (Req 8.2)
  if (
    message.includes("network") ||
    message.includes("offline") ||
    message.includes("disconnected") ||
    name === "networkerror"
  ) {
    return "network_error";
  }

  // Server unreachable errors (Req 8.4)
  if (
    message.includes("unreachable") ||
    message.includes("server") ||
    message.includes("websocket") ||
    message.includes("failed to connect")
  ) {
    return "server_unreachable";
  }

  // Timeout errors
  if (message.includes("timeout") || message.includes("timed out")) {
    return "timeout";
  }

  // Connection failed (Req 8.1)
  if (message.includes("connection") || message.includes("failed")) {
    return "connection_failed";
  }

  return "unknown";
}

// ============================================
// Store Implementation
// ============================================

export const useCallStore = create<CallStoreState>((set, get) => ({
  // Initial state
  callState: "idle",
  currentCall: null,
  localStream: null,
  remoteParticipants: new Map(),
  isMuted: false,
  isVideoOff: false,
  isScreenSharing: false,
  error: null,
  callDuration: 0,
  reconnectAttempts: 0,
  isReconnecting: false,

  // ============================================
  // Internal Actions
  // ============================================

  _setCallState: (state: CallState) => {
    set({ callState: state });
  },

  _setError: (error: CallError | null) => {
    set({ error });
  },

  /**
   * Set error from error type with optional custom message
   * Requirements: 1.4, 8.1, 8.2, 8.4
   */
  _setErrorFromType: (type: CallErrorType, customMessage?: string) => {
    const error = getCallError(type, customMessage);
    set({ error });
  },

  _cleanup: () => {
    // Stop duration timer
    get()._stopDurationTimer();

    // Stop reconnection
    get()._stopReconnection();

    // Clear incoming call timeout
    if (incomingCallTimeout) {
      clearTimeout(incomingCallTimeout);
      incomingCallTimeout = null;
    }

    // Reset mediasoup service
    resetMediasoupService();

    // Reset media handler
    resetMediaHandler();

    // Reset state
    set({
      callState: "idle",
      currentCall: null,
      localStream: null,
      remoteParticipants: new Map(),
      isMuted: false,
      isVideoOff: false,
      isScreenSharing: false,
      error: null,
      callDuration: 0,
      reconnectAttempts: 0,
      isReconnecting: false,
    });
  },

  _startDurationTimer: () => {
    if (durationInterval) {
      clearInterval(durationInterval);
    }
    durationInterval = setInterval(() => {
      set((state) => ({ callDuration: state.callDuration + 1 }));
    }, 1000);
  },

  _stopDurationTimer: () => {
    if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }
  },

  /**
   * Start reconnection timer (10 seconds as per Requirement 8.2)
   */
  _startReconnection: () => {
    const { reconnectAttempts, _setErrorFromType, _cleanup } = get();

    // Check if max attempts reached
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log("[CallStore] Max reconnection attempts reached, ending call");
      _setErrorFromType(
        "connection_failed",
        "Unable to reconnect after multiple attempts. Call ended."
      );
      _cleanup();
      return;
    }

    set({
      isReconnecting: true,
      reconnectAttempts: reconnectAttempts + 1,
      callState: "reconnecting",
    });

    // Clear existing timeout
    if (reconnectionTimeout) {
      clearTimeout(reconnectionTimeout);
    }

    // Set reconnection timeout (Requirement 8.2: 10 seconds)
    reconnectionTimeout = setTimeout(() => {
      const currentState = get();
      if (currentState.isReconnecting) {
        console.log("[CallStore] Reconnection timeout - ending call");
        _setErrorFromType(
          "timeout",
          "Connection could not be restored. Call ended."
        );
        _cleanup();
      }
    }, RECONNECTION_TIMEOUT_MS);

    console.log(
      `[CallStore] Reconnection attempt ${
        reconnectAttempts + 1
      }/${MAX_RECONNECT_ATTEMPTS}`
    );
  },

  /**
   * Stop reconnection timer
   */
  _stopReconnection: () => {
    if (reconnectionTimeout) {
      clearTimeout(reconnectionTimeout);
      reconnectionTimeout = null;
    }
    set({ isReconnecting: false });
  },

  // ============================================
  // Call Actions
  // ============================================

  /**
   * Initiate an outgoing call
   * Requirement 1.1: Voice call initiation
   * Requirement 1.2: Video call initiation
   * Requirement 1.4: Handle media permission denied
   */
  initiateCall: async (
    userId: string,
    userName: string,
    userAvatar: string,
    chatId: string,
    type: CallType,
    currentUserId: string
  ) => {
    const { callState, _setCallState, _setErrorFromType, _cleanup } = get();

    // Prevent initiating call if already in a call
    if (callState !== "idle") {
      console.warn("[CallStore] Attempted to initiate call while busy");
      return;
    }

    try {
      _setCallState("calling");
      set({ error: null });

      // Generate a temporary call ID (server will provide the real one)
      const tempCallId = `temp-${Date.now()}`;

      // Set current call info
      set({
        currentCall: {
          id: tempCallId,
          roomId: "", // Will be set when call is accepted
          type,
          remoteUserId: userId,
          remoteUserName: userName,
          remoteUserAvatar: userAvatar,
          chatId,
          isIncoming: false,
          currentUserId, // Store the current user's ID
        },
      });

      // Request media permissions and get local stream
      // Requirement 1.4: Handle permission denied
      const mediaHandler = getMediaHandler({
        onPermissionDenied: (kind) => {
          console.error(`[CallStore] Permission denied for ${kind}`);
          _setErrorFromType(
            "permission_denied",
            `${
              kind === "audio" ? "Microphone" : "Camera"
            } permission denied. Please allow access to make calls.`
          );
          _cleanup();
        },
        onError: (error) => {
          console.error("[CallStore] Media error:", error);
          const errorType = determineErrorType(error);
          _setErrorFromType(errorType, error.message);
          _cleanup();
        },
      });

      const localStream = await mediaHandler.getUserMedia(type);
      set({ localStream });

      // Send initiate call signal via WebSocket
      if (!wsSendFunctions) {
        throw new Error("WebSocket not initialized. Please try again.");
      }
      const sent = wsSendFunctions.sendInitiateCall(userId, chatId, type);

      if (!sent) {
        throw new Error(
          "Failed to send call signal. Please check your connection."
        );
      }

      console.log("[CallStore] Call initiated:", { userId, chatId, type });
    } catch (error) {
      console.error("[CallStore] Failed to initiate call:", error);
      const err = error as Error;
      const errorType = determineErrorType(err);
      _setErrorFromType(errorType, err.message);
      _cleanup();
    }
  },

  /**
   * Retry a failed call
   * Requirement 8.1: Offer retry option on connection failure
   */
  retryCall: async () => {
    const { currentCall, error, _cleanup } = get();

    // Can only retry if there's an error that allows retry
    if (!error?.canRetry || !currentCall) {
      console.warn(
        "[CallStore] Cannot retry: no retryable error or no call info"
      );
      return;
    }

    const {
      remoteUserId,
      remoteUserName,
      remoteUserAvatar,
      chatId,
      type,
      currentUserId,
    } = currentCall;

    // Cleanup current state
    _cleanup();

    // Wait a moment before retrying
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Retry the call
    await get().initiateCall(
      remoteUserId,
      remoteUserName,
      remoteUserAvatar,
      chatId,
      type,
      currentUserId || ""
    );
  },

  /**
   * Accept an incoming call
   * Requirement 2.3: Accept incoming call and establish connection
   * Requirement 1.4: Handle media permission denied
   */
  acceptCall: async () => {
    const {
      callState,
      currentCall,
      _setCallState,
      _setErrorFromType,
      _cleanup,
    } = get();

    if (callState !== "ringing" || !currentCall) {
      console.warn("[CallStore] Cannot accept call: not in ringing state");
      return;
    }

    try {
      // Clear incoming call timeout
      if (incomingCallTimeout) {
        clearTimeout(incomingCallTimeout);
        incomingCallTimeout = null;
      }

      _setCallState("joining");
      set({ error: null });

      // Request media permissions and get local stream
      // Requirement 1.4: Handle permission denied
      const mediaHandler = getMediaHandler({
        onPermissionDenied: (kind) => {
          console.error(`[CallStore] Permission denied for ${kind}`);
          _setErrorFromType(
            "permission_denied",
            `${
              kind === "audio" ? "Microphone" : "Camera"
            } permission denied. Please allow access to join the call.`
          );
          _cleanup();
        },
        onError: (error) => {
          console.error("[CallStore] Media error:", error);
          const errorType = determineErrorType(error);
          _setErrorFromType(errorType, error.message);
          _cleanup();
        },
      });

      const localStream = await mediaHandler.getUserMedia(currentCall.type);
      set({ localStream });

      // Send accept call signal via WebSocket
      if (!wsSendFunctions) {
        throw new Error("WebSocket not initialized. Please try again.");
      }
      const sent = wsSendFunctions.sendAcceptCall(currentCall.id);

      if (!sent) {
        throw new Error(
          "Failed to send accept signal. Please check your connection."
        );
      }

      console.log("[CallStore] Call accepted:", currentCall.id);
    } catch (error) {
      console.error("[CallStore] Failed to accept call:", error);
      const err = error as Error;
      const errorType = determineErrorType(err);
      _setErrorFromType(errorType, err.message);
      _cleanup();
    }
  },

  /**
   * Decline an incoming call
   * Requirement 2.4: Decline incoming call and send signal
   */
  declineCall: () => {
    const { callState, currentCall, _cleanup } = get();

    if (callState !== "ringing" || !currentCall) {
      console.warn("[CallStore] Cannot decline call: not in ringing state");
      return;
    }

    // Clear incoming call timeout
    if (incomingCallTimeout) {
      clearTimeout(incomingCallTimeout);
      incomingCallTimeout = null;
    }

    // Send decline signal via WebSocket
    if (wsSendFunctions) {
      wsSendFunctions.sendDeclineCall(currentCall.id);
    }

    console.log("[CallStore] Call declined:", currentCall.id);
    _cleanup();
  },

  /**
   * End the current call
   * Requirement 5.1: End call and cleanup resources
   */
  endCall: () => {
    const { currentCall, _cleanup } = get();

    if (currentCall) {
      // Send end call signal via WebSocket
      if (wsSendFunctions) {
        wsSendFunctions.sendEndCall(currentCall.id);
      }

      console.log("[CallStore] Call ended:", currentCall.id);
    }

    _cleanup();
  },

  // ============================================
  // Media Controls
  // ============================================

  /**
   * Toggle mute state
   * Requirement 4.1: Mute/unmute audio
   */
  toggleMute: async () => {
    const { isMuted, callState } = get();

    if (callState !== "connected" && callState !== "producing") {
      console.warn("[CallStore] Cannot toggle mute: not in call");
      return;
    }

    const mediaHandler = getMediaHandler();
    const newMutedState = !isMuted;

    // Toggle local audio track
    mediaHandler.toggleAudio(!newMutedState);

    // Pause/resume mediasoup producer
    const mediasoupService = getMediasoupService();
    try {
      if (newMutedState) {
        await mediasoupService.pauseProducer("audio");
      } else {
        await mediasoupService.resumeProducer("audio");
      }
    } catch (error) {
      console.error("[CallStore] Failed to toggle audio producer:", error);
    }

    set({ isMuted: newMutedState });
    console.log("[CallStore] Mute toggled:", newMutedState);
  },

  /**
   * Toggle video state
   * Requirement 4.2: Enable/disable video
   */
  toggleVideo: async () => {
    const { isVideoOff, callState, currentCall } = get();

    if (callState !== "connected" && callState !== "producing") {
      console.warn("[CallStore] Cannot toggle video: not in call");
      return;
    }

    if (currentCall?.type !== "video") {
      console.warn("[CallStore] Cannot toggle video: not a video call");
      return;
    }

    const mediaHandler = getMediaHandler();
    const newVideoOffState = !isVideoOff;

    // Toggle local video track
    mediaHandler.toggleVideo(!newVideoOffState);

    // Pause/resume mediasoup producer
    const mediasoupService = getMediasoupService();
    try {
      if (newVideoOffState) {
        await mediasoupService.pauseProducer("video");
      } else {
        await mediasoupService.resumeProducer("video");
      }
    } catch (error) {
      console.error("[CallStore] Failed to toggle video producer:", error);
    }

    set({ isVideoOff: newVideoOffState });
    console.log("[CallStore] Video toggled:", newVideoOffState ? "off" : "on");
  },

  /**
   * Toggle screen sharing
   * Requirement 4.4: Screen share functionality
   */
  toggleScreenShare: async () => {
    const { isScreenSharing, callState, currentCall, _setErrorFromType } =
      get();

    if (callState !== "connected" && callState !== "producing") {
      console.warn("[CallStore] Cannot toggle screen share: not in call");
      return;
    }

    const mediaHandler = getMediaHandler();
    const mediasoupService = getMediasoupService();

    try {
      if (!isScreenSharing) {
        // Start screen sharing
        const screenStream = await mediaHandler.getDisplayMedia();
        const screenTrack = screenStream.getVideoTracks()[0];

        if (screenTrack) {
          // Replace video track with screen track
          await mediaHandler.replaceVideoTrack(screenTrack);

          // Close existing video producer and create new one with screen track
          await mediasoupService.closeProducer("video");
          await mediasoupService.produce(screenTrack, "video");

          // Listen for screen share end (user clicks browser stop button)
          screenTrack.onended = async () => {
            console.log("[CallStore] Screen share ended by user");
            await get().toggleScreenShare(); // This will restore camera
          };

          set({ isScreenSharing: true });
          console.log("[CallStore] Screen sharing started");
        }
      } else {
        // Stop screen sharing and restore camera
        mediaHandler.stopScreenShare();

        // Restore original video track
        const restoredTrack = await mediaHandler.restoreVideoTrack();

        if (restoredTrack && currentCall?.type === "video") {
          // Close screen producer and create new one with camera track
          await mediasoupService.closeProducer("video");
          await mediasoupService.produce(restoredTrack, "video");
        }

        set({ isScreenSharing: false });
        console.log("[CallStore] Screen sharing stopped");
      }
    } catch (error) {
      console.error("[CallStore] Failed to toggle screen share:", error);
      const err = error as Error;
      const errorType = determineErrorType(err);
      _setErrorFromType(errorType, err.message);
    }
  },

  // ============================================
  // WebSocket Event Handlers
  // ============================================

  /**
   * Handle call initiated event (sent to caller with real call ID)
   * Updates the temporary call ID with the real UUID from backend
   */
  handleCallInitiated: (event: CallInitiatedEvent) => {
    const { currentCall, callState } = get();

    if (callState !== "calling" || !currentCall) {
      console.warn(
        "[CallStore] Received CallInitiated but not in calling state"
      );
      return;
    }

    console.log("[CallStore] Call initiated, updating call ID:", event.callId);

    // Update the temporary call ID with the real one from backend
    set({
      currentCall: {
        ...currentCall,
        id: event.callId,
      },
    });
  },

  /**
   * Handle incoming call notification
   * Requirement 2.1: Display incoming call notification
   */
  handleIncomingCall: (event: IncomingCallEvent) => {
    const { callState, _setCallState, declineCall } = get();

    // Ignore if this call was recently ended (race condition protection)
    if (recentlyEndedCalls.has(event.callId)) {
      console.log(
        "[CallStore] Ignoring incoming call: call was recently ended",
        event.callId
      );
      return;
    }

    // If already in a call, ignore incoming call (user is busy)
    if (callState !== "idle") {
      console.log("[CallStore] Ignoring incoming call: already in a call");
      // The backend should handle sending UserBusy to the caller
      return;
    }

    console.log("[CallStore] Incoming call:", event);

    // Set call info
    set({
      currentCall: {
        id: event.callId,
        roomId: "", // Will be set when call is accepted
        type: event.callType,
        remoteUserId: event.callerId,
        remoteUserName: event.callerName,
        remoteUserAvatar: event.callerAvatar || "",
        chatId: event.chatId,
        // chatId: event.chatId, (removed duplicate)
        isIncoming: true,
        currentUserId: useAuthStore.getState().session?.user.id,
      },
    });

    _setCallState("ringing");

    // Set timeout to auto-decline after 30 seconds
    // Requirement 2.5: Auto-decline after 30 seconds
    incomingCallTimeout = setTimeout(() => {
      console.log("[CallStore] Incoming call timeout - auto declining");
      declineCall();
    }, INCOMING_CALL_TIMEOUT_MS);
  },

  /**
   * Handle call accepted event
   * Requirement 2.3: Establish connection when call is accepted
   * Requirement 8.1: Handle connection failures with retry option
   * Requirement 8.2: Handle transport disconnection and reconnection
   * Requirement 8.4: Handle server unreachable errors
   */
  handleCallAccepted: async (event: CallAcceptedEvent) => {
    const {
      callState,
      currentCall,
      _setCallState,
      _setErrorFromType,
      _cleanup,
      _startDurationTimer,
      _startReconnection,
      _stopReconnection,
    } = get();

    if ((callState !== "calling" && callState !== "joining") || !currentCall) {
      console.warn(
        "[CallStore] Received CallAccepted but not in calling/joining state"
      );
      return;
    }

    console.log("[CallStore] Call accepted:", event);

    try {
      _setCallState("joining");

      // Update call info with room ID
      set({
        currentCall: {
          ...currentCall,
          id: event.callId,
          roomId: event.roomId,
        },
      });

      // Setup mediasoup event handlers with enhanced error handling
      const mediasoupHandlers: MediasoupEventHandlers = {
        onNewProducer: async (oderId, producerId, kind) => {
          console.log("[CallStore] New producer:", {
            oderId,
            producerId,
            kind,
          });
          await handleNewProducer(oderId, producerId, kind);
        },
        onProducerRemoved: (oderId, producerId, kind) => {
          console.log("[CallStore] Producer removed:", {
            oderId,
            producerId,
            kind,
          });
          handleProducerRemoved(oderId, kind);
        },
        onParticipantLeft: (oderId) => {
          console.log("[CallStore] Participant left:", oderId);
          handleParticipantLeft(oderId);
        },
        /**
         * Handle connection state changes
         * Requirement 8.1: Display error on connection failure
         * Requirement 8.2: Attempt reconnection on disconnect
         */
        onConnectionStateChange: (state) => {
          console.log("[CallStore] Connection state changed:", state);

          if (state === "failed") {
            // Requirement 8.1: Connection failed - display error with retry option
            _setErrorFromType(
              "connection_failed",
              "Connection to call server failed. Please try again."
            );
            _cleanup();
          } else if (state === "disconnected") {
            // Requirement 8.2: Network disconnected - attempt reconnection
            const currentCallState = get().callState;
            if (
              currentCallState === "connected" ||
              currentCallState === "producing"
            ) {
              console.log(
                "[CallStore] Connection disconnected, starting reconnection..."
              );
              _startReconnection();
            }
          } else if (state === "connected") {
            const currentState = get();
            if (currentState.isReconnecting) {
              // Successfully reconnected
              console.log("[CallStore] Successfully reconnected");
              _stopReconnection();
              _setCallState("connected");
              set({ error: null, reconnectAttempts: 0 });
            }
          }
        },
        /**
         * Handle mediasoup errors
         * Requirement 8.4: Handle server unreachable errors
         */
        onError: (error) => {
          console.error("[CallStore] Mediasoup error:", error);
          const errorType = determineErrorType(error);
          _setErrorFromType(errorType, error.message);
        },
      };

      // Connect to mediasoup server and join room
      // Requirement 8.4: Handle server unreachable
      const mediasoupService = getMediasoupService(mediasoupHandlers);

      try {
        await mediasoupService.connect();
      } catch (connectError) {
        console.error(
          "[CallStore] Failed to connect to mediasoup server:",
          connectError
        );
        _setErrorFromType(
          "server_unreachable",
          "Unable to connect to the call server. Please check your connection and try again."
        );
        _cleanup();
        return;
      }

      // Join the room (this also creates transports)
      // Use the current user's ID if available, trying to fallback to something reasonable if not
      // But we really need the current user's ID here since that's what we registered with
      // when joining the room via WebSocket signals earlier (or will need to match)
      const myId = currentCall.currentUserId;
      if (!myId) {
        console.error(
          "[CallStore] Missing currentUserId in call info, cannot join room correctly"
        );
        throw new Error("Internal error: Missing user identity");
      }

      console.log("[CallStore] Joining mediasoup room:", {
        roomId: event.roomId,
        myId,
        isIncoming: currentCall.isIncoming,
      });

      console.log(
        "[CallStore] Mediasoup service state - connected:",
        mediasoupService.isConnected
      );
      console.log("[CallStore] About to call joinRoom()...");

      const existingProducers = await mediasoupService.joinRoom(
        event.roomId,
        myId
      );

      console.log(
        "[CallStore] Successfully joined room, existing producers:",
        existingProducers.length
      );

      _setCallState("producing");

      // Produce local media
      // Try to use existing localStream first (for caller who already has it)
      let audioTrack: MediaStreamTrack | null = null;
      let videoTrack: MediaStreamTrack | null = null;

      if (currentCall.isIncoming) {
        // For incoming calls, get tracks from mediaHandler
        const mediaHandler = getMediaHandler();
        audioTrack = mediaHandler.currentAudioTrack;
        videoTrack = mediaHandler.currentVideoTrack;
      } else {
        // For outgoing calls, use the localStream that was created during initiateCall
        const { localStream } = get();
        if (localStream) {
          const audioTracks = localStream.getAudioTracks();
          const videoTracks = localStream.getVideoTracks();
          audioTrack = audioTracks.length > 0 ? audioTracks[0] : null;
          videoTrack = videoTracks.length > 0 ? videoTracks[0] : null;
        }
      }

      console.log("[CallStore] About to produce media:", {
        hasAudioTrack: !!audioTrack,
        hasVideoTrack: !!videoTrack,
        callType: currentCall.type,
        isIncoming: currentCall.isIncoming,
      });

      if (audioTrack) {
        console.log("[CallStore] Producing audio...");
        await mediasoupService.produce(audioTrack, "audio");
      } else {
        console.warn("[CallStore] No audio track available to produce");
      }

      if (videoTrack && currentCall.type === "video") {
        console.log("[CallStore] Producing video...");
        await mediasoupService.produce(videoTrack, "video");
      } else if (currentCall.type === "video") {
        console.warn("[CallStore] No video track available to produce");
      }

      // Consume existing producers from other participants
      for (const producer of existingProducers) {
        await handleNewProducer(
          producer.oderId,
          producer.producerId,
          producer.kind
        );
      }

      _setCallState("connected");
      _startDurationTimer();

      // Update call start time
      set({
        currentCall: {
          ...get().currentCall!,
          startTime: new Date(),
        },
      });

      console.log("[CallStore] Call connected");
    } catch (error) {
      console.error("[CallStore] Failed to join room:", error);
      const err = error as Error;
      const errorType = determineErrorType(err);
      _setErrorFromType(errorType, err.message);
      _cleanup();
    }
  },

  /**
   * Handle call declined event
   */
  handleCallDeclined: (event: CallDeclinedEvent) => {
    const { currentCall, _cleanup } = get();

    // Mark this call as recently ended to prevent race conditions
    markCallAsEnded(event.callId);

    if (!currentCall || currentCall.id !== event.callId) {
      return;
    }

    console.log("[CallStore] Call declined:", event.callId);
    _cleanup();
  },

  /**
   * Handle call ended event
   * Requirement 5.2: Handle remote call end
   */
  handleCallEnded: (event: CallEndedEvent) => {
    const { currentCall, _cleanup } = get();

    // Mark this call as recently ended to prevent race conditions
    markCallAsEnded(event.callId);

    if (!currentCall || currentCall.id !== event.callId) {
      return;
    }

    console.log(
      "[CallStore] Call ended:",
      event.callId,
      "reason:",
      event.reason
    );
    _cleanup();
  },

  /**
   * Handle user busy event
   */
  handleUserBusy: (event: UserBusyEvent) => {
    const { currentCall, _setErrorFromType, _cleanup } = get();

    if (!currentCall || currentCall.id !== event.callId) {
      return;
    }

    console.log("[CallStore] User busy:", event.callId);
    _setErrorFromType("user_busy");
    _cleanup();
  },
}));

// ============================================
// Helper Functions for Mediasoup Events
// ============================================

/**
 * Handle new producer from remote participant
 */
async function handleNewProducer(
  oderId: string,
  producerId: string,
  kind: string
): Promise<void> {
  const state = useCallStore.getState();
  const { currentCall, remoteParticipants } = state;

  if (!currentCall) return;

  try {
    const mediasoupService = getMediasoupService();
    const consumer = await mediasoupService.consume(
      currentCall.roomId,
      producerId
    );

    // Get current state to ensure we have the latest participant data
    const currentState = useCallStore.getState();
    let participant = currentState.remoteParticipants.get(oderId);

    if (!participant) {
      participant = {
        oderId,
        name: currentCall.remoteUserName,
        avatar: currentCall.remoteUserAvatar,
        audioEnabled: false,
        videoEnabled: false,
      };
    }

    // IMPORTANT: Reuse the existing stream to keep all tracks together
    let stream = participant.stream;
    if (!stream) {
      stream = new MediaStream();
    }

    // Add track to the SAME stream instance
    stream.addTrack(consumer.track);

    // Update participant based on kind
    if (kind === "audio") {
      participant = {
        ...participant,
        audioConsumer: consumer,
        audioEnabled: true,
        stream, // Use the same stream instance
      };
    } else if (kind === "video") {
      participant = {
        ...participant,
        videoConsumer: consumer,
        videoEnabled: true,
        stream, // Use the same stream instance
      };
    }

    // Update state
    const newParticipants = new Map(currentState.remoteParticipants);
    newParticipants.set(oderId, participant);
    useCallStore.setState({ remoteParticipants: newParticipants });

    console.log("[CallStore] Consumer created for participant:", oderId, kind);
    console.log("[CallStore] Remote participants count:", newParticipants.size);
    console.log("[CallStore] Remote participant stream:", {
      oderId,
      hasStream: !!participant.stream,
      audioTracks: participant.stream?.getAudioTracks().length || 0,
      videoTracks: participant.stream?.getVideoTracks().length || 0,
    });
  } catch (error) {
    console.error("[CallStore] Failed to consume producer:", error);
  }
}

/**
 * Handle producer removed from remote participant
 */
function handleProducerRemoved(oderId: string, kind: string): void {
  const { remoteParticipants } = useCallStore.getState();

  const participant = remoteParticipants.get(oderId);
  if (!participant) return;

  // Update participant state
  const updatedParticipant = { ...participant };

  if (kind === "audio") {
    if (updatedParticipant.audioConsumer) {
      // Remove audio track from stream
      if (updatedParticipant.stream && updatedParticipant.audioConsumer.track) {
        updatedParticipant.stream.removeTrack(
          updatedParticipant.audioConsumer.track
        );
      }
      updatedParticipant.audioConsumer = undefined;
      updatedParticipant.audioEnabled = false;
    }
  } else if (kind === "video") {
    if (updatedParticipant.videoConsumer) {
      // Remove video track from stream
      if (updatedParticipant.stream && updatedParticipant.videoConsumer.track) {
        updatedParticipant.stream.removeTrack(
          updatedParticipant.videoConsumer.track
        );
      }
      updatedParticipant.videoConsumer = undefined;
      updatedParticipant.videoEnabled = false;
    }
  }

  const newParticipants = new Map(remoteParticipants);
  newParticipants.set(oderId, updatedParticipant);
  useCallStore.setState({ remoteParticipants: newParticipants });

  console.log("[CallStore] Producer removed for participant:", oderId, kind);
}

/**
 * Handle participant leaving the call
 */
function handleParticipantLeft(oderId: string): void {
  const { remoteParticipants, currentCall, callState } =
    useCallStore.getState();

  // Remove participant
  const newParticipants = new Map(remoteParticipants);
  newParticipants.delete(oderId);
  useCallStore.setState({ remoteParticipants: newParticipants });

  console.log("[CallStore] Participant left:", oderId);

  // Don't end call immediately - participant might reconnect
  // Only end call if:
  // 1. No participants left AND
  // 2. We're in a connected state (not just joining) AND
  // 3. After a short delay to allow for reconnection
  if (
    currentCall &&
    newParticipants.size === 0 &&
    (callState === "connected" || callState === "producing")
  ) {
    console.log(
      "[CallStore] Remote participant left, waiting for reconnection..."
    );

    // Wait 5 seconds before ending call to allow for reconnection
    setTimeout(() => {
      const state = useCallStore.getState();
      if (
        state.remoteParticipants.size === 0 &&
        state.currentCall?.id === currentCall.id
      ) {
        console.log("[CallStore] No reconnection, ending call");
        state.endCall();
      }
    }, 5000);
  }
}

// ============================================
// Selectors
// ============================================

export const selectCallState = (state: CallStoreState) => state.callState;
export const selectCurrentCall = (state: CallStoreState) => state.currentCall;
export const selectLocalStream = (state: CallStoreState) => state.localStream;
export const selectRemoteParticipants = (state: CallStoreState) =>
  state.remoteParticipants;
export const selectIsMuted = (state: CallStoreState) => state.isMuted;
export const selectIsVideoOff = (state: CallStoreState) => state.isVideoOff;
export const selectIsScreenSharing = (state: CallStoreState) =>
  state.isScreenSharing;
export const selectError = (state: CallStoreState) => state.error;
export const selectCallDuration = (state: CallStoreState) => state.callDuration;
export const selectIsInCall = (state: CallStoreState) =>
  state.callState !== "idle";
export const selectIsRinging = (state: CallStoreState) =>
  state.callState === "ringing";
export const selectIsConnected = (state: CallStoreState) =>
  state.callState === "connected";
export const selectIsReconnecting = (state: CallStoreState) =>
  state.callState === "reconnecting" || state.isReconnecting;
export const selectReconnectAttempts = (state: CallStoreState) =>
  state.reconnectAttempts;
export const selectCanRetry = (state: CallStoreState) =>
  state.error?.canRetry ?? false;

// ============================================
// Utility Functions
// ============================================

/**
 * Format call duration as MM:SS or HH:MM:SS
 */
export function formatCallDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

/**
 * Get the first remote participant's stream (for 1:1 calls)
 */
export function getRemoteStream(state: CallStoreState): MediaStream | null {
  const participants = Array.from(state.remoteParticipants.values());


  if (participants.length > 0 && participants[0].stream) {

    return participants[0].stream;
  }

 
  return null;
}

export default useCallStore;
