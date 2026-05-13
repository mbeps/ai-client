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
import { Trash2 } from "lucide-react";
import { deleteMcpServer } from "@/lib/actions/mcp-servers/delete-mcp-server";

/**
 * Settings panel for an MCP server with permanent deletion option.
 * Displays warning about deletion impact on assistants and chats.
 * Shows confirmation dialog before allowing deletion; redirects to tools list after deletion.
 *
 * @param serverId - ID of the server to manage settings for; used in delete operation
 * @see {@link EditServerForm} for editing server configuration
 * @see {@link ServerOptions} for quick actions menu
 */
export interface ServerSettingsProps {
  /**
   * Unique identifier of the MCP server.
   * Used to perform deletion and navigation after deletion.
   */
  serverId: string;
}

export function ServerSettings({ serverId }: ServerSettingsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

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

  return (
    <div className="space-y-6">
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

          <>
            <Button
              variant="destructive"
              disabled={deleting}
              className="shrink-0"
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
          </>
        </div>
      </div>
    </div>
  );
}
