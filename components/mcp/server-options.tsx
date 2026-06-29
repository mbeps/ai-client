"use client";
import { Trash2, Edit2, ToggleLeft, ToggleRight } from "lucide-react";
import type { McpServer } from "@/types/mcp/mcp-server";
import { BaseEntityOptions } from "@/components/shared/base-entity-options";
import { toast } from "sonner";
import { useEntityOptions } from "@/hooks/use-entity-options";
import { renameMcpServer } from "@/lib/actions/mcp-servers/rename-mcp-server";
import { toggleMcpServer } from "@/lib/actions/mcp-servers/toggle-mcp-server";
import { deleteMcpServer } from "@/lib/actions/mcp-servers/delete-mcp-server";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";

/**
 * Props for ServerOptions component.
 *
 * @interface ServerOptionsProps
 */
export interface ServerOptionsProps {
  /** The MCP server to manage options for. */
  server: McpServer;
}

/**
 * Options menu component for MCP server actions.
 * Provides rename, toggle enable/disable, and delete operations through a context menu.
 * Handles mobile vs desktop UX patterns automatically.
 * All operations trigger app store refresh and router updates.
 *
 * @param props - Component props
 * @param props.server - The MCP server to manage options for
 * @see {@link ServerCard} for server display with options
 * @see {@link ServerSettings} for detailed settings panel
 * @see {@link BaseEntityOptions} for base menu implementation
 * @author Maruf Bepary
 */
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
    <BaseEntityOptions
      name={server.name}
      items={items}
      isMobile={isMobile}
      showRename={showRename}
      setShowRename={setShowRename}
      showDelete={showDelete}
      setShowDelete={setShowDelete}
      isDeleting={isDeleting}
      handleRename={handleRename}
      handleDelete={handleDelete}
      renameTitle="Rename Server"
      deleteTitle="Delete Server"
    />
  );
}
