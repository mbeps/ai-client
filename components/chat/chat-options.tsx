"use client";
import { useState } from "react";
import { Trash2, FolderOutput, Edit2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { Chat } from "@/types/chat/chat";
import { BaseEntityOptions } from "@/components/shared/base-entity-options";
import { ROUTES } from "@/constants/routes";
import { MoveChatDialog } from "@/components/shared/move-chat-dialog";
import { useEntityOptions } from "@/hooks/use-entity-options";

/**
 * Options menu for a chat, providing Rename, Move, and Delete actions.
 * Shares logic between the ChatCard and the global header.
 * Automatically handles navigation to the chat list after deletion.
 *
 * @param props.chat - The chat entity to manage.
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
      <BaseEntityOptions
        name={chat.title}
        items={items}
        isMobile={isMobile}
        showRename={showRename}
        setShowRename={setShowRename}
        showDelete={showDelete}
        setShowDelete={setShowDelete}
        isDeleting={isDeleting}
        handleRename={handleRename}
        handleDelete={handleDelete}
        renameTitle="Rename Chat"
        renameLabel="Title"
        deleteTitle="Delete Chat"
        trigger={trigger}
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
