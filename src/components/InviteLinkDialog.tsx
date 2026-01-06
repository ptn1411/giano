import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inviteLinksApi, type CreateInviteLinkRequest } from "@/services/inviteLinks";
import { Check, Copy, Link as LinkIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface InviteLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "group" | "direct";
  chatId?: string;
  chatName?: string;
}

export function InviteLinkDialog({
  open,
  onOpenChange,
  type,
  chatId,
  chatName,
}: InviteLinkDialogProps) {
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiresIn, setExpiresIn] = useState<string>("never");
  const [maxUses, setMaxUses] = useState<string>("unlimited");

  const handleCreate = async () => {
    setLoading(true);
    try {
      const request: CreateInviteLinkRequest = {
        type,
        chatId,
      };

      // Set expiration
      if (expiresIn !== "never") {
        const hours = parseInt(expiresIn);
        request.expiresIn = hours * 3600; // Convert to seconds
      }

      // Set max uses
      if (maxUses !== "unlimited") {
        request.maxUses = parseInt(maxUses);
      }

      const link = await inviteLinksApi.createInviteLink(request);
      const fullUrl = `${window.location.origin}${link.url}`;
      setInviteLink(fullUrl);
      toast.success("Invite link created successfully!");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create invite link");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (inviteLink) {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setInviteLink(null);
    setExpiresIn("never");
    setMaxUses("unlimited");
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {type === "group" ? "Create Group Invite Link" : "Create Chat Invite Link"}
          </DialogTitle>
          <DialogDescription>
            {type === "group"
              ? `Create an invite link for ${chatName || "this group"}`
              : "Create a link to start a direct chat with you"}
          </DialogDescription>
        </DialogHeader>

        {!inviteLink ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="expires">Link Expiration</Label>
              <Select value={expiresIn} onValueChange={setExpiresIn}>
                <SelectTrigger id="expires">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never</SelectItem>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="168">7 days</SelectItem>
                  <SelectItem value="720">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxUses">Maximum Uses</Label>
              <Select value={maxUses} onValueChange={setMaxUses}>
                <SelectTrigger id="maxUses">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unlimited">Unlimited</SelectItem>
                  <SelectItem value="1">1 use</SelectItem>
                  <SelectItem value="5">5 uses</SelectItem>
                  <SelectItem value="10">10 uses</SelectItem>
                  <SelectItem value="50">50 uses</SelectItem>
                  <SelectItem value="100">100 uses</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button onClick={handleCreate} disabled={loading} className="w-full">
                <LinkIcon className="mr-2 h-4 w-4" />
                {loading ? "Creating..." : "Create Link"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Your Invite Link</Label>
              <div className="flex items-center space-x-2">
                <Input value={inviteLink} readOnly className="flex-1" />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} variant="outline" className="w-full">
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
