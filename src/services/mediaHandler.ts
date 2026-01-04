/**
 * Media Handler Service
 * Handles camera, microphone, and screen sharing for voice/video calls
 * Requirements: 1.3, 4.1, 4.2, 4.4
 */

export type CallType = 'voice' | 'video';

export interface MediaConstraints {
  audio: boolean | MediaTrackConstraints;
  video: boolean | MediaTrackConstraints;
}

export interface MediaHandlerState {
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  audioTrack: MediaStreamTrack | null;
  videoTrack: MediaStreamTrack | null;
  screenTrack: MediaStreamTrack | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
}

export interface MediaHandlerEventHandlers {
  onTrackEnded?: (kind: 'audio' | 'video' | 'screen') => void;
  onPermissionDenied?: (kind: 'audio' | 'video' | 'screen') => void;
  onError?: (error: Error) => void;
}

/**
 * Get media constraints based on call type
 * Voice calls: audio only
 * Video calls: audio + video
 * Requirement 1.3: Media constraints match call type
 */
export function getMediaConstraints(callType: CallType): MediaConstraints {
  if (callType === 'voice') {
    return {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    };
  }

  // Video call
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 },
      frameRate: { ideal: 30, max: 60 },
      facingMode: 'user',
    },
  };
}

export class MediaHandler {
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private audioTrack: MediaStreamTrack | null = null;
  private videoTrack: MediaStreamTrack | null = null;
  private screenTrack: MediaStreamTrack | null = null;
  private isAudioEnabled = true;
  private isVideoEnabled = true;
  private isScreenSharing = false;
  private eventHandlers: MediaHandlerEventHandlers = {};
  private originalVideoTrack: MediaStreamTrack | null = null;

  constructor(handlers?: MediaHandlerEventHandlers) {
    if (handlers) {
      this.eventHandlers = handlers;
    }
  }

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: MediaHandlerEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Get user media (camera/microphone) based on call type
   * Requirement 1.3: Request appropriate media permissions
   */
  async getUserMedia(callType: CallType): Promise<MediaStream> {
    const constraints = getMediaConstraints(callType);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;

      // Extract tracks
      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();

      if (audioTracks.length > 0) {
        this.audioTrack = audioTracks[0];
        this.isAudioEnabled = this.audioTrack.enabled;
        
        // Listen for track ended event
        this.audioTrack.onended = () => {
          console.log('[MediaHandler] Audio track ended');
          this.eventHandlers.onTrackEnded?.('audio');
        };
      }

      if (videoTracks.length > 0) {
        this.videoTrack = videoTracks[0];
        this.isVideoEnabled = this.videoTrack.enabled;
        
        // Listen for track ended event
        this.videoTrack.onended = () => {
          console.log('[MediaHandler] Video track ended');
          this.eventHandlers.onTrackEnded?.('video');
        };
      }

      console.log('[MediaHandler] Got user media:', {
        audio: audioTracks.length > 0,
        video: videoTracks.length > 0,
      });

      return stream;
    } catch (error) {
      const err = error as Error;
      console.error('[MediaHandler] getUserMedia error:', err);

      // Check for permission denied
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        this.eventHandlers.onPermissionDenied?.(callType === 'voice' ? 'audio' : 'video');
      }

      this.eventHandlers.onError?.(err);
      throw err;
    }
  }

  /**
   * Get display media for screen sharing
   * Requirement 4.4: Screen share functionality
   */
  async getDisplayMedia(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false, // Screen audio can be added if needed
      });

      this.screenStream = stream;
      const videoTracks = stream.getVideoTracks();

      if (videoTracks.length > 0) {
        this.screenTrack = videoTracks[0];
        this.isScreenSharing = true;

        // Listen for track ended event (user stops sharing via browser UI)
        this.screenTrack.onended = () => {
          console.log('[MediaHandler] Screen share track ended');
          this.isScreenSharing = false;
          this.screenTrack = null;
          this.screenStream = null;
          this.eventHandlers.onTrackEnded?.('screen');
        };
      }

      console.log('[MediaHandler] Got display media');
      return stream;
    } catch (error) {
      const err = error as Error;
      console.error('[MediaHandler] getDisplayMedia error:', err);

      // Check for permission denied
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        this.eventHandlers.onPermissionDenied?.('screen');
      }

      this.eventHandlers.onError?.(err);
      throw err;
    }
  }

  /**
   * Toggle audio track enabled state
   * Requirement 4.1: Mute/unmute audio
   */
  toggleAudio(enabled?: boolean): boolean {
    if (!this.audioTrack) {
      console.warn('[MediaHandler] No audio track to toggle');
      return this.isAudioEnabled;
    }

    const newState = enabled !== undefined ? enabled : !this.audioTrack.enabled;
    this.audioTrack.enabled = newState;
    this.isAudioEnabled = newState;

    console.log('[MediaHandler] Audio toggled:', newState ? 'enabled' : 'disabled');
    return this.isAudioEnabled;
  }

  /**
   * Toggle video track enabled state
   * Requirement 4.2: Enable/disable video
   */
  toggleVideo(enabled?: boolean): boolean {
    if (!this.videoTrack) {
      console.warn('[MediaHandler] No video track to toggle');
      return this.isVideoEnabled;
    }

    const newState = enabled !== undefined ? enabled : !this.videoTrack.enabled;
    this.videoTrack.enabled = newState;
    this.isVideoEnabled = newState;

    console.log('[MediaHandler] Video toggled:', newState ? 'enabled' : 'disabled');
    return this.isVideoEnabled;
  }

  /**
   * Replace video track with screen share track
   * Requirement 4.4: Screen share replaces video track
   * Returns the new track for the producer to use
   */
  async replaceVideoTrack(newTrack: MediaStreamTrack): Promise<MediaStreamTrack | null> {
    // Store original video track if not already stored
    if (!this.originalVideoTrack && this.videoTrack) {
      this.originalVideoTrack = this.videoTrack;
    }

    // Update current video track reference
    this.videoTrack = newTrack;
    this.isVideoEnabled = newTrack.enabled;

    // Listen for track ended event
    newTrack.onended = () => {
      console.log('[MediaHandler] Replaced video track ended');
      this.eventHandlers.onTrackEnded?.('video');
    };

    console.log('[MediaHandler] Video track replaced');
    return newTrack;
  }

  /**
   * Restore original video track after screen sharing ends
   */
  async restoreVideoTrack(): Promise<MediaStreamTrack | null> {
    if (!this.originalVideoTrack) {
      console.warn('[MediaHandler] No original video track to restore');
      return null;
    }

    this.videoTrack = this.originalVideoTrack;
    this.originalVideoTrack = null;
    this.isVideoEnabled = this.videoTrack.enabled;

    console.log('[MediaHandler] Original video track restored');
    return this.videoTrack;
  }

  /**
   * Stop screen sharing
   */
  stopScreenShare(): void {
    if (this.screenTrack) {
      this.screenTrack.stop();
      this.screenTrack = null;
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    this.isScreenSharing = false;
    console.log('[MediaHandler] Screen share stopped');
  }

  /**
   * Stop all media tracks and cleanup
   * Requirement 5.2: Cleanup resources on call end
   */
  stopAllTracks(): void {
    // Stop audio track
    if (this.audioTrack) {
      this.audioTrack.stop();
      this.audioTrack = null;
    }

    // Stop video track
    if (this.videoTrack) {
      this.videoTrack.stop();
      this.videoTrack = null;
    }

    // Stop original video track if stored
    if (this.originalVideoTrack) {
      this.originalVideoTrack.stop();
      this.originalVideoTrack = null;
    }

    // Stop screen track
    if (this.screenTrack) {
      this.screenTrack.stop();
      this.screenTrack = null;
    }

    // Stop all tracks in streams
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    // Reset state
    this.isAudioEnabled = true;
    this.isVideoEnabled = true;
    this.isScreenSharing = false;

    console.log('[MediaHandler] All tracks stopped');
  }

  /**
   * Get current state
   */
  getState(): MediaHandlerState {
    return {
      localStream: this.localStream,
      screenStream: this.screenStream,
      audioTrack: this.audioTrack,
      videoTrack: this.videoTrack,
      screenTrack: this.screenTrack,
      isAudioEnabled: this.isAudioEnabled,
      isVideoEnabled: this.isVideoEnabled,
      isScreenSharing: this.isScreenSharing,
    };
  }

  // Getters for individual properties
  get currentLocalStream(): MediaStream | null {
    return this.localStream;
  }

  get currentScreenStream(): MediaStream | null {
    return this.screenStream;
  }

  get currentAudioTrack(): MediaStreamTrack | null {
    return this.audioTrack;
  }

  get currentVideoTrack(): MediaStreamTrack | null {
    return this.videoTrack;
  }

  get currentScreenTrack(): MediaStreamTrack | null {
    return this.screenTrack;
  }

  get audioEnabled(): boolean {
    return this.isAudioEnabled;
  }

  get videoEnabled(): boolean {
    return this.isVideoEnabled;
  }

  get screenSharing(): boolean {
    return this.isScreenSharing;
  }
}

// Singleton instance for app-wide use
let mediaHandlerInstance: MediaHandler | null = null;

export function getMediaHandler(handlers?: MediaHandlerEventHandlers): MediaHandler {
  if (!mediaHandlerInstance) {
    mediaHandlerInstance = new MediaHandler(handlers);
  } else if (handlers) {
    mediaHandlerInstance.setEventHandlers(handlers);
  }
  return mediaHandlerInstance;
}

export function resetMediaHandler(): void {
  if (mediaHandlerInstance) {
    mediaHandlerInstance.stopAllTracks();
    mediaHandlerInstance = null;
  }
}

export default MediaHandler;
