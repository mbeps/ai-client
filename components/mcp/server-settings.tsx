"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { deleteMcpServer } from "@/actions/mcp-servers/delete-mcp-server";
import { DangerZoneCard } from "@/components/shared/danger-zone-card";
import { ROUTES } from "@/config/routes";
import { useAppStore } from "@/lib/store/use-app-store";

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
 * @see {@link DangerZoneCard} for standardized danger zone UI and confirmation
 * @author Maruf Bepary
 */
export function ServerSettings({ serverId }: ServerSettingsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const { server, loadMcpServers } = useAppStore(
    useShallow((state) => ({
      server: state.mcpServers.find((s) => s.id === serverId),
      loadMcpServers: state.loadMcpServers,
    })),
  );

  if (!server) return null;

  async function handleDelete() {
    const isInstalled = Boolean(server?.isInstalled);
    setDeleting(true);
    try {
      const res = await deleteMcpServer(serverId);
      if (!res.ok) {
        toast.error(
          res.error.message ||
            (isInstalled
              ? "Failed to uninstall tool"
              : "Failed to delete MCP server"),
        );
        setDeleting(false);
        return;
      }
      await loadMcpServers();
      toast.success(isInstalled ? "Tool uninstalled" : "MCP server deleted");
      router.refresh();
      router.push(ROUTES.CONNECTORS.path);
    } catch {
      toast.error(
        isInstalled
          ? "Failed to uninstall tool"
          : "Failed to delete MCP server",
      );
      setDeleting(false);
    }
  }

  return (
    <DangerZoneCard
      title={server.isInstalled ? "Uninstall Tool" : undefined}
      description={
        server.isInstalled
          ? "Remove this community tool subscription from your account."
          : "Irreversible actions for this MCP server."
      }
      consequences={
        server.isInstalled
          ? "This will remove the community tool subscription from your account."
          : "Permanently remove this MCP server configuration. This will affect all assistants and chats using this server. This action is irreversible."
      }
      buttonLabel={server.isInstalled ? "Uninstall" : undefined}
      confirmTitle={
        server.isInstalled ? "Uninstall Community Tool?" : "Are you sure?"
      }
      confirmDescription={
        server.isInstalled
          ? "This will remove the community tool subscription from your account."
          : "This will permanently delete the MCP server and remove all its tool bindings. This action cannot be undone."
      }
      confirmLabel={server.isInstalled ? "Uninstall" : undefined}
      confirmLoadingLabel={server.isInstalled ? "Uninstalling..." : undefined}
      onDelete={handleDelete}
      isDeleting={deleting}
    />
  );
}
