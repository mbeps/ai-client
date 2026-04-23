"use client";
import { useState } from "react";
import { Trash2, FolderOutput, Edit2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { Chat } from "@/types/chat";
import { RenameDialog } from "@/components/shared/rename-dialog";
import { ResponsiveMenu } from "@/components/shared/responsive-menu";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { ROUTES } from "@/lib/routes";
import { MoveChatDialog } from "@/components/shared/move-chat-dialog";
import { useEntityOptions } from "@/hooks/use-entity-options";


/**
 * Options menu for a chat, providing Rename, Move, and Delete actions.
 * Shares logic between the ChatCard and the global header.
 * Automatically handles navigation to the chat list after deletion.
 *
 * @param props.chat - The chat entity to manage.
 * @author Maruf Bepary
 */
export function ChatOptions({
  chat,
  trigger,
}: {
  chat: Chat;
  trigger?: React.ReactNode;
}) {
  const [showMove, setShowMove] = useState(false);

  const renameChatDb = useAppStore((state) => state.renameChatDb);
  const deleteChatDb = useAppStore((state) => state.deleteChatDb);

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
    id: chat.id,
    type: "Chat",
    onRename: (id, name) => renameChatDb(id, name),
    onDelete: (id) => deleteChatDb(id),
    redirectPath: ROUTES.CHATS.path,
  });

  const items = [
    {
      label: "Rename",
      icon: <Edit2 className="mr-2 h-4 w-4" />,
      onClick: () => setShowRename(true),
    },
    {
      label: "Move Chat",
      icon: <FolderOutput className="mr-2 h-4 w-4" />,
      onClick: () => setShowMove(true),
    },

    {
      label: "Delete Chat",
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      onClick: () => setShowDelete(true),
      isDestructive: true,
      separator: true,
    },
  ];

  return (
    <>
      <ResponsiveMenu
        title={chat.title}
        items={items}
        isMobile={isMobile}
        trigger={trigger}
      />
      <RenameDialog
        isOpen={showRename}
        onClose={() => setShowRename(false)}
        initialValue={chat.title}
        onConfirm={handleRename}
        title="Rename Chat"
        label="Title"
      />
      <DeleteConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Chat"
        description={`Are you sure you want to delete "${chat.title}"? This action cannot be undone.`}
        loading={isDeleting}
      />
      <MoveChatDialog
        isOpen={showMove}
        onClose={() => setShowMove(false)}
        chatId={chat.id}
        currentProjectId={chat.projectId}
      />
    </>

  );
}
