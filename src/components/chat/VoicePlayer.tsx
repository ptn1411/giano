import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoicePlayerProps {
  audioUrl: string;
  duration?: number;
  isOwn?: boolean;
}

export function VoicePlayer({ audioUrl, duration = 0, isOwn }: VoicePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setAudioDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const progress = progressRef.current;
    if (!audio || !progress) return;

    const rect = progress.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    audio.currentTime = percentage * audioDuration;
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 min-w-[200px]">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      <button
        onClick={togglePlay}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
          isOwn
            ? "bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
            : "bg-primary/10 hover:bg-primary/20 text-primary"
        )}
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5 ml-0.5" />
        )}
      </button>

      <div className="flex-1 space-y-1">
        <div
          ref={progressRef}
          onClick={handleProgressClick}
          className={cn(
            "h-1.5 rounded-full cursor-pointer",
            isOwn ? "bg-primary-foreground/30" : "bg-border"
          )}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-100",
              isOwn ? "bg-primary-foreground" : "bg-primary"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className={cn(
          "text-[10px]",
          isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          {formatTime(currentTime)} / {formatTime(audioDuration)}
        </div>
      </div>
    </div>
  );
}
