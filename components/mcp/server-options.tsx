"use client";

import { useState } from "react";
import { Trash2, Edit2, ToggleLeft, ToggleRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAppStore } from "@/lib/store";
import type { McpServer } from "@/types/mcp-server";
import { RenameDialog } from "@/components/shared/rename-dialog";
import { ResponsiveMenu } from "@/components/shared/responsive-menu";
import { toast } from "sonner";

export function ServerOptions({ server }: { server: McpServer }) {
  const isMobile = useIsMobile();
  const [showRename, setShowRename] = useState(false);

  const renameMcpServer = useAppStore((state) => state.renameMcpServer);
  const toggleMcpServer = useAppStore((state) => state.toggleMcpServer);
  const removeMcpServer = useAppStore((state) => state.removeMcpServer);

  const handleRename = async (newName: string) => {
    try {
      await renameMcpServer(server.id, newName);
      toast.success("Server renamed");
    } catch (error) {
      toast.error("Failed to rename server");
      throw error;
    }
  };

  const handleToggle = async () => {
    try {
      await toggleMcpServer(server.id);
      toast.success(server.enabled ? "Server disabled" : "Server enabled");
    } catch {
      toast.error("Failed to toggle server");
    }
  };

  const handleDelete = async () => {
    try {
      await removeMcpServer(server.id);
      toast.success("Server deleted");
    } catch {
      toast.error("Failed to delete server");
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
      onClick: handleDelete,
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
    </>
  );
}
