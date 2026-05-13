"use client";
import { Trash2, Edit2, ToggleLeft, ToggleRight } from "lucide-react";
import type { McpServer } from "@/types/mcp-server";
import { RenameDialog } from "@/components/shared/rename-dialog";
import { ResponsiveMenu } from "@/components/shared/responsive-menu";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { toast } from "sonner";
import { useEntityOptions } from "@/hooks/use-entity-options";
import { renameMcpServer } from "@/lib/actions/mcp-servers/rename-mcp-server";
import { toggleMcpServer } from "@/lib/actions/mcp-servers/toggle-mcp-server";
import { deleteMcpServer } from "@/lib/actions/mcp-servers/delete-mcp-server";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";

/**
 * Responsive menu for server actions: rename, enable/disable toggle, and delete.
 * Adapts between dropdown (desktop) and drawer (mobile) UI. Uses direct Server Actions for mutations.
 * Shows delete confirmation dialog before permanent removal.
 *
 * @param server - MCP server to manage; used for rename, toggle, and delete operations
 * @see {@link ServerCard} for server display
 * @see {@link RenameDialog} for rename confirmation UI
 * @see {@link DeleteConfirmDialog} for deletion confirmation UI
 */
export interface ServerOptionsProps {
  /**
   * The MCP server to manage.
   * All operations (rename, toggle, delete) are scoped to this server.
   */
  server: McpServer;
}

export function ServerOptions({ server }: ServerOptionsProps) {
  const router = useRouter();
  const loadMcpServers = useAppStore((state) => state.loadMcpServers);

  const {
    isMobile,
    showRename,
    setShowRename,
    showDelete,
    setShowDelete,
    isDeleting,
    handleRename,
    handleDelete,
  } = useEntityOptions({
    id: server.id,
    type: "Server",
    onRename: (id, name) => renameMcpServer(id, name),
    onDelete: (id) => deleteMcpServer(id),
    useRouterRefresh: true,
    onAfterMutation: loadMcpServers,
  });

  const handleToggle = async () => {
    try {
      await toggleMcpServer(server.id);
      toast.success(server.enabled ? "Server disabled" : "Server enabled");
      router.refresh();
      loadMcpServers();
    } catch {
      toast.error("Failed to toggle server");
    }
  };

  const items = [
    {
      label: "Rename Server",
      icon: <Edit2 className="mr-2 h-4 w-4" />,
      onClick: () => setShowRename(true),
    },
    {
      label: server.enabled ? "Disable Server" : "Enable Server",
      icon: server.enabled ? (
        <ToggleRight className="mr-2 h-4 w-4" />
      ) : (
        <ToggleLeft className="mr-2 h-4 w-4" />
      ),
      onClick: handleToggle,
    },
    {
      label: "Delete Server",
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      onClick: () => setShowDelete(true),
      isDestructive: true,
    },
  ];

  return (
    <>
      <ResponsiveMenu title={server.name} items={items} isMobile={isMobile} />
      <RenameDialog
        isOpen={showRename}
        onClose={() => setShowRename(false)}
        initialValue={server.name}
        onConfirm={handleRename}
        title="Rename Server"
      />
      <DeleteConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Server"
        description={`Are you sure you want to delete "${server.name}"? This action cannot be undone.`}
        loading={isDeleting}
      />
    </>
  );
}
