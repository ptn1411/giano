import { useState, useEffect } from "react";
import { 
  Radio, 
  Eye, 
  Heart, 
  MessageCircle, 
  Share2, 
  X, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff,
  Maximize2,
  MoreVertical,
  Send
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface LiveComment {
  id: string;
  userName: string;
  userAvatar: string;
  text: string;
  timestamp: Date;
}

interface LiveStreamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isHost: boolean;
  streamTitle: string;
  hostName: string;
  hostAvatar: string;
}

const mockComments: LiveComment[] = [
  { id: '1', userName: 'Alice', userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice', text: 'Hello everyone! 👋', timestamp: new Date() },
  { id: '2', userName: 'Bob', userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob', text: 'Great stream!', timestamp: new Date() },
  { id: '3', userName: 'Carol', userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carol', text: '❤️❤️❤️', timestamp: new Date() },
];

export function LiveStreamModal({
  open,
  onOpenChange,
  isHost,
  streamTitle,
  hostName,
  hostAvatar,
}: LiveStreamModalProps) {
  const [viewerCount, setViewerCount] = useState(127);
  const [likeCount, setLikeCount] = useState(342);
  const [comments, setComments] = useState<LiveComment[]>(mockComments);
  const [newComment, setNewComment] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; x: number }[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [streamDuration, setStreamDuration] = useState(0);

  // Simulate viewer count changes
  useEffect(() => {
    if (!open || !isLive) return;
    
    const interval = setInterval(() => {
      setViewerCount(v => v + Math.floor(Math.random() * 5) - 2);
    }, 3000);

    return () => clearInterval(interval);
  }, [open, isLive]);

  // Stream duration timer
  useEffect(() => {
    if (!open || !isLive) return;

    const interval = setInterval(() => {
      setStreamDuration(d => d + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [open, isLive]);

  // Simulate new comments
  useEffect(() => {
    if (!open || !isLive) return;

    const interval = setInterval(() => {
      const randomComments = [
        "This is amazing! 🎉",
        "Love this content!",
        "Can you show that again?",
        "First time here!",
        "👏👏👏",
        "Great explanation!",
        "Hello from Brazil! 🇧🇷",
      ];
      const randomUsers = ['David', 'Emma', 'Frank', 'Grace', 'Henry'];
      const randomUser = randomUsers[Math.floor(Math.random() * randomUsers.length)];
      
      setComments(prev => [...prev.slice(-20), {
        id: Date.now().toString(),
        userName: randomUser,
        userAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${randomUser}`,
        text: randomComments[Math.floor(Math.random() * randomComments.length)],
        timestamp: new Date(),
      }]);
    }, 4000);

    return () => clearInterval(interval);
  }, [open, isLive]);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLike = () => {
    if (!hasLiked) {
      setLikeCount(l => l + 1);
      setHasLiked(true);
    }
    
    // Create floating heart
    const newHeart = { id: Date.now(), x: Math.random() * 60 + 20 };
    setFloatingHearts(prev => [...prev, newHeart]);
    
    setTimeout(() => {
      setFloatingHearts(prev => prev.filter(h => h.id !== newHeart.id));
    }, 2000);
  };

  const handleSendComment = () => {
    if (!newComment.trim()) return;
    
    setComments(prev => [...prev, {
      id: Date.now().toString(),
      userName: 'You',
      userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=You',
      text: newComment,
      timestamp: new Date(),
    }]);
    setNewComment("");
  };

  const handleEndStream = () => {
    setIsLive(false);
    setTimeout(() => onOpenChange(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 max-h-[90vh] overflow-hidden bg-black border-none">
        {/* Video Area */}
        <div className="relative aspect-video bg-gradient-to-br from-primary/30 via-background to-accent/30">
          {/* Floating Hearts */}
          {floatingHearts.map(heart => (
            <div
              key={heart.id}
              className="absolute bottom-20 animate-float-up pointer-events-none"
              style={{ left: `${heart.x}%` }}
            >
              <Heart className="h-6 w-6 text-red-500 fill-red-500" />
            </div>
          ))}

          {/* Live Badge */}
          {isLive && (
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                <Radio className="h-4 w-4 animate-pulse" />
                LIVE
              </div>
              <div className="bg-black/50 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm">
                {formatDuration(streamDuration)}
              </div>
            </div>
          )}

          {!isLive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <div className="text-center">
                <p className="text-2xl font-bold text-white mb-2">Stream Ended</p>
                <p className="text-muted-foreground">Thanks for watching!</p>
              </div>
            </div>
          )}

          {/* Viewer Count */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-black/50 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm">
              <Eye className="h-4 w-4" />
              {viewerCount.toLocaleString()}
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm hover:bg-black/70"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Host Info */}
          <div className="absolute bottom-4 left-4 flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-primary">
              <AvatarImage src={hostAvatar} alt={hostName} />
              <AvatarFallback>{hostName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-white text-sm">{hostName}</p>
              <p className="text-xs text-white/70">{streamTitle}</p>
            </div>
          </div>

          {/* Host Controls */}
          {isHost && isLive && (
            <div className="absolute bottom-4 right-4 flex items-center gap-2">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center backdrop-blur-sm transition-all",
                  isMuted ? "bg-red-500 text-white" : "bg-black/50 text-white hover:bg-black/70"
                )}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <button
                onClick={() => setIsVideoOff(!isVideoOff)}
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center backdrop-blur-sm transition-all",
                  isVideoOff ? "bg-red-500 text-white" : "bg-black/50 text-white hover:bg-black/70"
                )}
              >
                {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              </button>
              <button
                onClick={handleEndStream}
                className="px-4 py-2 rounded-full bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-all"
              >
                End Stream
              </button>
            </div>
          )}
        </div>

        {/* Comments & Actions */}
        <div className="bg-card flex flex-col h-[250px]">
          {/* Actions Bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-4">
              <button
                onClick={handleLike}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-red-500 transition-colors"
              >
                <Heart className={cn("h-5 w-5", hasLiked && "fill-red-500 text-red-500")} />
                <span className="text-sm">{likeCount.toLocaleString()}</span>
              </button>
              <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                <MessageCircle className="h-5 w-5" />
                <span className="text-sm">{comments.length}</span>
              </button>
              <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                <Share2 className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Comments List */}
          <ScrollArea className="flex-1 px-4">
            <div className="py-2 space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="flex items-start gap-2 animate-fade-in">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={comment.userAvatar} alt={comment.userName} />
                    <AvatarFallback>{comment.userName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="text-xs font-medium text-primary">{comment.userName}</span>
                    <span className="text-xs text-foreground ml-2">{comment.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Comment Input */}
          <div className="p-3 border-t border-border">
            <div className="flex items-center gap-2">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Say something..."
                className="flex-1 h-9 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
              />
              <Button size="sm" onClick={handleSendComment} disabled={!newComment.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
