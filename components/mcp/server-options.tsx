"use client";
import { Trash2, Edit2, ToggleLeft, ToggleRight } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { McpServer } from "@/types/mcp-server";
import { RenameDialog } from "@/components/shared/rename-dialog";
import { ResponsiveMenu } from "@/components/shared/responsive-menu";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { toast } from "sonner";
import { useEntityOptions } from "@/hooks/use-entity-options";

export function ServerOptions({ server }: { server: McpServer }) {
  const renameMcpServer = useAppStore((state) => state.renameMcpServer);
  const toggleMcpServer = useAppStore((state) => state.toggleMcpServer);
  const removeMcpServer = useAppStore((state) => state.removeMcpServer);

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
    onDelete: (id) => removeMcpServer(id),
  });

  const handleToggle = async () => {
    try {
      await toggleMcpServer(server.id);
      toast.success(server.enabled ? "Server disabled" : "Server enabled");
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
