"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { deleteMcpServer } from "@/actions/mcp-servers/delete-mcp-server";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { useAppStore } from "@/lib/store";

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
 * Danger zone settings panel for managing an MCP server.
 * Displays permanent deletion or uninstall option with confirmation.
 * Shows warning about deletion impact on assistants and chats.
 * Redirects to the connectors list after successful deletion.
 *
 * @param props - Component props
 * @param props.serverId - ID of the server to manage settings for; used in delete operation
 * @see {@link EditServerForm} for editing server configuration
 * @see {@link ServerSharingTab} for public sharing settings
 * @see {@link ServerOptions} for quick actions menu
 * @see {@link DeleteConfirmDialog} for deletion confirmation UX
 * @author Maruf Bepary
 */
export function ServerSettings({ serverId }: ServerSettingsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { server } = useAppStore(
    useShallow((state) => ({
      server: state.mcpServers.find((s) => s.id === serverId),
    })),
  );

  if (!server) return null;

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteMcpServer(serverId);
      toast.success("MCP server deleted");
      router.refresh();
      router.push(ROUTES.CONNECTORS.path);
    } catch {
      toast.error("Failed to delete MCP server");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Delete / Uninstall Server Section */}
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 font-semibold text-destructive text-lg">
              <Trash2 className="h-5 w-5" />
              {server.isInstalled ? "Uninstall Tool" : "Delete Server"}
            </h3>
            <p className="max-w-2xl text-muted-foreground text-sm">
              {server.isInstalled
                ? "Remove this community tool subscription from your account."
                : "Permanently remove this MCP server configuration. This will affect all assistants and chats using this server. This action is irreversible."}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {server.isInstalled ? "Uninstall Tool" : "Delete Server"}
            </Button>
            <DeleteConfirmDialog
              isOpen={deleteOpen}
              onClose={() => setDeleteOpen(false)}
              onConfirm={handleDelete}
              title={
                server.isInstalled
                  ? "Uninstall Community Tool?"
                  : "Are you sure?"
              }
              description={
                server.isInstalled
                  ? "This will remove the community tool subscription from your account."
                  : "This will permanently delete the MCP server and remove all its tool bindings. This action cannot be undone."
              }
              loading={deleting}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
