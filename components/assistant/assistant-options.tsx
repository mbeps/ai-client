"use client";

import { useState } from "react";
import { Trash2, Edit2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAppStore } from "@/lib/store";
import type { Assistant } from "@/lib/store";
import { RenameDialog } from "@/components/shared/rename-dialog";
import { ResponsiveMenu } from "@/components/shared/responsive-menu";
import { toast } from "sonner";

export function AssistantOptions({ assistant }: { assistant: Assistant }) {
  const isMobile = useIsMobile();
  const [showRename, setShowRename] = useState(false);

  const renameAssistantDb = useAppStore((state) => state.renameAssistantDb);
  const deleteAssistantDb = useAppStore((state) => state.deleteAssistantDb);

  const handleRename = async (newName: string) => {
    try {
      await renameAssistantDb(assistant.id, newName);
      toast.success("Assistant renamed");
    } catch (error) {
      toast.error("Failed to rename assistant");
      throw error;
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(`Delete assistant "${assistant.name}"? This cannot be undone.`)
    )
      return;
    try {
      await deleteAssistantDb(assistant.id);
      toast.success("Assistant deleted");
    } catch {
      toast.error("Failed to delete assistant");
    }
  };

  const items = [
    {
      label: "Rename Assistant",
      icon: <Edit2 className="mr-2 h-4 w-4" />,
      onClick: () => setShowRename(true),
    },
    {
      label: "Delete Assistant",
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      onClick: handleDelete,
      isDestructive: true,
    },
  ];

  return (
    <>
      <ResponsiveMenu
        title={assistant.name}
        items={items}
        isMobile={isMobile}
      />
      <RenameDialog
        isOpen={showRename}
        onClose={() => setShowRename(false)}
        initialValue={assistant.name}
        onConfirm={handleRename}
        title="Rename Assistant"
      />
    </>
  );
}
