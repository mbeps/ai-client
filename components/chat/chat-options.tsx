"use client";

import { useState } from "react";
import { Trash2, FolderOutput, Edit2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAppStore } from "@/lib/store";
import type { Chat } from "@/lib/store";
import { RenameDialog } from "@/components/shared/rename-dialog";
import { ResponsiveMenu } from "@/components/shared/responsive-menu";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { MoveChatDialog } from "@/components/shared/move-chat-dialog";


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

  const isMobile = useIsMobile();
  const router = useRouter();
  const [showRename, setShowRename] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);


  const renameChatDb = useAppStore((state) => state.renameChatDb);
  const deleteChatDb = useAppStore((state) => state.deleteChatDb);

  const handleRename = async (newName: string) => {
    try {
      await renameChatDb(chat.id, newName);
      toast.success("Chat renamed");
    } catch (error) {
      toast.error("Failed to rename chat");
      throw error;
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteChatDb(chat.id);
      toast.success("Chat deleted");
      router.push(ROUTES.CHATS.path);
    } catch {
      toast.error("Failed to delete chat");
    } finally {
      setIsDeleting(false);
    }
  };

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
