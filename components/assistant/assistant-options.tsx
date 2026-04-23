"use client";

import { Trash2, Edit2, MessageSquare, Settings2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { Assistant } from "@/types/assistant";
import { RenameDialog } from "@/components/shared/rename-dialog";
import { ResponsiveMenu } from "@/components/shared/responsive-menu";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { useCreateChat } from "@/hooks/use-create-chat";
import { useEntityOptions } from "@/hooks/use-entity-options";

/**
 * Options menu for an assistant, providing Rename and Delete actions.
 * Shares logic between the AssistantCard and the global header.
 * Automatically handles navigation to the assistant list after deletion.
 *
 * @param props.assistant - The assistant entity to manage.
 * @author Maruf Bepary
 */
export function AssistantOptions({ assistant }: { assistant: Assistant }) {
  const router = useRouter();
  const createNewChat = useCreateChat();
  const renameAssistantDb = useAppStore((state) => state.renameAssistantDb);
  const deleteAssistantDb = useAppStore((state) => state.deleteAssistantDb);

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
    id: assistant.id,
    type: "Assistant",
    onRename: (id, name) => renameAssistantDb(id, name),
    onDelete: (id) => deleteAssistantDb(id),
    redirectPath: ROUTES.ASSISTANTS.path,
  });

  const items = [
    {
      label: "New Chat",
      icon: <MessageSquare className="mr-2 h-4 w-4" />,
      onClick: () => createNewChat("New Chat", undefined, assistant.id),
    },
    {
      label: "Manage",
      icon: <Settings2 className="mr-2 h-4 w-4" />,
      onClick: () => router.push(ROUTES.ASSISTANTS.detail(assistant.id)),
      separator: true,
    },
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
