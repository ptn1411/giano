import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { inviteLinksApi, type InviteLink } from "@/services/inviteLinks";
import { useAuthStore } from "@/stores/authStore";
import { Check, Link as LinkIcon, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { session } = useAuthStore();
  const [link, setLink] = useState<InviteLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (code) {
      loadInviteLink();
    }
  }, [code]);

  const loadInviteLink = async () => {
    if (!code) return;

    try {
      const data = await inviteLinksApi.getInviteLink(code);
      setLink(data);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Link mời không hợp lệ");
      setTimeout(() => navigate("/"), 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!code || !session) {
      navigate("/auth");
      return;
    }

    setJoining(true);
    try {
      const result = await inviteLinksApi.useInviteLink(code);
      setJoined(true);
      toast.success(`Đã tham gia ${result.chatName}!`);
      setTimeout(() => {
        navigate("/", { state: { openChatId: result.chatId } });
      }, 1500);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Không thể tham gia");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!link) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <LinkIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Link mời không hợp lệ</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();
  const isMaxedOut = link.maxUses && link.currentUses >= link.maxUses;
  const isInvalid = !link.isActive || isExpired || isMaxedOut;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {link.type === "group" ? (
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-8 w-8 text-primary" />
              </div>
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <LinkIcon className="h-8 w-8 text-primary" />
              </div>
            )}
          </div>
          <CardTitle>
            {link.type === "group"
              ? link.chatName || "Nhóm chat"
              : `Chat với ${link.creatorName}`}
          </CardTitle>
          <CardDescription>
            {link.type === "group"
              ? `${link.creatorName} đã mời bạn tham gia nhóm này`
              : `Bắt đầu cuộc trò chuyện trực tiếp với ${link.creatorName}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isInvalid ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                {!link.isActive && "Link mời này đã bị thu hồi"}
                {isExpired && "Link mời này đã hết hạn"}
                {isMaxedOut && "Link mời này đã đạt giới hạn sử dụng"}
              </p>
              <Button onClick={() => navigate("/")} variant="outline" className="w-full">
                Về trang chủ
              </Button>
            </div>
          ) : joined ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Check className="h-6 w-6 text-green-500" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Tham gia thành công! Đang chuyển hướng...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {!session && (
                <p className="text-sm text-muted-foreground text-center">
                  Bạn cần đăng nhập để tham gia
                </p>
              )}
              <Button
                onClick={handleJoin}
                disabled={joining}
                className="w-full"
                size="lg"
              >
                {joining
                  ? "Đang tham gia..."
                  : session
                  ? link.type === "group"
                    ? "Tham gia nhóm"
                    : "Bắt đầu chat"
                  : "Đăng nhập để tham gia"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
