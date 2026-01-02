import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Trash2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceRecorderProps {
  onSend: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
}

export function VoiceRecorder({ onSend, onCancel }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") 
          ? "audio/webm" 
          : "audio/mp4"
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start(100);
      setIsRecording(true);
      startTimeRef.current = Date.now();
      
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 100);
      
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [isRecording]);

  const handleSend = useCallback(() => {
    if (audioBlob) {
      onSend(audioBlob, duration);
      cleanup();
    }
  }, [audioBlob, duration, onSend]);

  const cleanup = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    onCancel();
  }, [audioUrl, onCancel]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-card border-t border-border animate-fade-in">
      {!audioBlob ? (
        <>
          {/* Recording controls */}
          <button
            onClick={onCancel}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-accent text-muted-foreground transition-colors"
          >
            <Trash2 className="h-5 w-5" />
          </button>
          
          <div className="flex-1 flex items-center gap-3">
            <div className={cn(
              "h-3 w-3 rounded-full",
              isRecording ? "bg-destructive animate-pulse" : "bg-muted"
            )} />
            <span className="text-sm font-medium text-foreground">
              {formatDuration(duration)}
            </span>
            {isRecording && (
              <div className="flex-1 flex items-center gap-0.5">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-primary rounded-full animate-pulse"
                    style={{
                      height: `${Math.random() * 16 + 4}px`,
                      animationDelay: `${i * 50}ms`
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          
          {isRecording ? (
            <button
              onClick={stopRecording}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive text-destructive-foreground transition-colors"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={startRecording}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors"
            >
              <Mic className="h-5 w-5" />
            </button>
          )}
        </>
      ) : (
        <>
          {/* Preview controls */}
          <button
            onClick={cleanup}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-accent text-muted-foreground transition-colors"
          >
            <Trash2 className="h-5 w-5" />
          </button>
          
          <div className="flex-1 flex items-center gap-3">
            <audio src={audioUrl || undefined} controls className="h-8 flex-1" />
          </div>
          
          <button
            onClick={handleSend}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Send className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}
