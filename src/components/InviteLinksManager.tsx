import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { inviteLinksApi, type InviteLink } from "@/services/inviteLinks";
import { Check, Copy, Link as LinkIcon, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

export function InviteLinksManager() {
  const [links, setLinks] = useState<InviteLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    try {
      const data = await inviteLinksApi.getMyInviteLinks();
      setLinks(data);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error("Failed to load invite links");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (link: InviteLink) => {
    const fullUrl = `${window.location.origin}${link.url}`;
    await navigator.clipboard.writeText(fullUrl);
    setCopiedId(link.id);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = async (link: InviteLink) => {
    try {
      await inviteLinksApi.revokeInviteLink(link.id);
      toast.success("Invite link revoked");
      loadLinks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error("Failed to revoke invite link");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <LinkIcon className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No invite links yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            Create invite links to share with others
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {links.map((link) => (
        <Card key={link.id} className={!link.isActive ? "opacity-60" : ""}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-base flex items-center gap-2">
                  {link.type === "group" ? (
                    <>
                      <Users className="h-4 w-4" />
                      {link.chatName || "Group Chat"}
                    </>
                  ) : (
                    <>
                      <LinkIcon className="h-4 w-4" />
                      Direct Chat Link
                    </>
                  )}
                  {!link.isActive && (
                    <span className="text-xs text-muted-foreground">(Revoked)</span>
                  )}
                </CardTitle>
                <CardDescription className="mt-1">
                  Created {format(new Date(link.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {link.isActive && (
                  <>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleCopy(link)}
                    >
                      {copiedId === link.id ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleRevoke(link)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Uses:</span>
                <span>
                  {link.currentUses}
                  {link.maxUses ? ` / ${link.maxUses}` : " / Unlimited"}
                </span>
              </div>
              {link.expiresAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expires:</span>
                  <span>
                    {new Date(link.expiresAt) > new Date()
                      ? format(new Date(link.expiresAt), "MMM d, yyyy 'at' h:mm a")
                      : "Expired"}
                  </span>
                </div>
              )}
              {link.isActive && (
                <div className="mt-3 p-2 bg-muted rounded text-xs font-mono break-all">
                  {window.location.origin}
                  {link.url}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
