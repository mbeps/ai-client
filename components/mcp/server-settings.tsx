"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { toast } from "sonner";
import { useState } from "react";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { Trash2, Globe, Info } from "lucide-react";
import { deleteMcpServer } from "@/lib/actions/mcp-servers/delete-mcp-server";
import { toggleMcpServerPublic } from "@/lib/actions/mcp-servers/toggle-mcp-server-public";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";

/**
 * Props for ServerSettings component.
 *
 * @interface ServerSettingsProps
 */
export interface ServerSettingsProps {
  /**
   * Unique identifier of the MCP server.
   * Used to perform deletion and navigation after deletion.
   */
  serverId: string;
}

/**
 * Settings panel for managing an MCP server configuration.
 * Displays public sharing toggle and permanent deletion option with confirmation.
 * Shows warning about deletion impact on assistants and chats.
 * Redirects to tools list after successful deletion.
 *
 * @param props - Component props
 * @param props.serverId - ID of the server to manage settings for; used in delete and toggle operations
 * @see {@link EditServerForm} for editing server configuration
 * @see {@link ServerOptions} for quick actions menu
 * @see {@link DeleteConfirmDialog} for deletion confirmation UX
 * @author Maruf Bepary
 */
export function ServerSettings({ serverId }: ServerSettingsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [togglingPublic, setTogglingPublic] = useState(false);

  const { server, loadMcpServers } = useAppStore(
    useShallow((state) => ({
      server: state.mcpServers.find((s) => s.id === serverId),
      loadMcpServers: state.loadMcpServers,
    })),
  );

  if (!server) return null;

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteMcpServer(serverId);
      toast.success("MCP server deleted");
      router.refresh();
      router.push(ROUTES.TOOLS.path);
    } catch {
      toast.error("Failed to delete MCP server");
      setDeleting(false);
    }
  }

  async function handleTogglePublic() {
    if (!server) return;
    setTogglingPublic(true);
    try {
      await toggleMcpServerPublic(serverId);
      toast.success(`Server is now ${!server.isPublic ? "public" : "private"}`);
      await loadMcpServers();
      router.refresh();
    } catch {
      toast.error("Failed to toggle public status");
    } finally {
      setTogglingPublic(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Public Sharing Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle>Public Sharing</CardTitle>
          </div>
          <CardDescription>
            Share this MCP server with the community to allow other users to
            discover and use its tools.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="public-toggle" className="text-base">
                Make this server public
              </Label>
              <p className="text-sm text-muted-foreground">
                When enabled, anyone can find and use this server in their
                chats.
              </p>
            </div>
            <Switch
              id="public-toggle"
              checked={server.isPublic}
              onCheckedChange={handleTogglePublic}
              disabled={togglingPublic}
            />
          </div>

          <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4 text-sm">
            <Info className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
            <div className="text-muted-foreground">
              <p className="font-medium text-foreground">Important Note</p>
              <p>
                Public servers are accessible to all users on the platform.
                Ensure that your server does not expose sensitive data or
                internal functions that should remain private.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Server Section */}
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Server
            </h3>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Permanently remove this MCP server configuration. This will affect
              all assistants and chats using this server. This action is
              irreversible.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Server
            </Button>
            <DeleteConfirmDialog
              isOpen={deleteOpen}
              onClose={() => setDeleteOpen(false)}
              onConfirm={handleDelete}
              title="Are you sure?"
              description="This will permanently delete the MCP server and remove all its tool bindings. This action cannot be undone."
              loading={deleting}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
