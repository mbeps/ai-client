"use client";

import { useState } from "react";
import { Trash2, Edit2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAppStore } from "@/lib/store";
import type { Assistant } from "@/lib/store";
import { RenameDialog } from "@/components/shared/rename-dialog";
import { ResponsiveMenu } from "@/components/shared/responsive-menu";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";

/**
 * Options menu for an assistant, providing Rename and Delete actions.
 * Shares logic between the AssistantCard and the global header.
 * Automatically handles navigation to the assistant list after deletion.
 *
 * @param props.assistant - The assistant entity to manage.
 * @author Maruf Bepary
 */
export function AssistantOptions({ assistant }: { assistant: Assistant }) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [showRename, setShowRename] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
    setIsDeleting(true);
    try {
      await deleteAssistantDb(assistant.id);
      toast.success("Assistant deleted");
      router.push(ROUTES.ASSISTANTS.path);
    } catch {
      toast.error("Failed to delete assistant");
    } finally {
      setIsDeleting(false);
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
      onClick: () => setShowDelete(true),
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
      <DeleteConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Assistant"
        description={`Are you sure you want to delete "${assistant.name}"? This action cannot be undone.`}
        loading={isDeleting}
      />
    </>
  );
}
