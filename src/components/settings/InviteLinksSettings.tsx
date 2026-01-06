import { Button } from "@/components/ui/button";
import { InviteLinkDialog } from "@/components/InviteLinkDialog";
import { InviteLinksManager } from "@/components/InviteLinksManager";
import { Link as LinkIcon, Plus } from "lucide-react";
import { useState } from "react";

export function InviteLinksSettings() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Invite Links</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your invite links for groups and direct chats
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Link
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <LinkIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Share Your Profile</p>
            <p className="text-xs text-muted-foreground">
              Create a link for others to start a chat with you
            </p>
          </div>
        </div>

        <InviteLinksManager />
      </div>

      <InviteLinkDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        type="direct"
      />
    </div>
  );
}
