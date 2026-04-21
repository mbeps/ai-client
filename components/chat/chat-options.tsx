"use client";

import { useState } from "react";
import { Trash2, FolderOutput, Edit2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAppStore } from "@/lib/store";
import type { Chat } from "@/lib/store";
import { RenameDialog } from "@/components/shared/rename-dialog";
import { ResponsiveMenu } from "@/components/shared/responsive-menu";
import { toast } from "sonner";

export function ChatOptions({
  chat,
  onDelete,
}: {
  chat: Chat;
  onDelete: () => void;
}) {
  const isMobile = useIsMobile();
  const [showRename, setShowRename] = useState(false);

  const renameChatDb = useAppStore((state) => state.renameChatDb);

  const handleRename = async (newName: string) => {
    try {
      await renameChatDb(chat.id, newName);
      toast.success("Chat renamed");
    } catch (error) {
      toast.error("Failed to rename chat");
      throw error;
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
      onClick: () => {},
    },
    {
      label: "Delete Chat",
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      onClick: onDelete,
      isDestructive: true,
      separator: true,
    },
  ];

  return (
    <>
      <ResponsiveMenu title={chat.title} items={items} isMobile={isMobile} />
      <RenameDialog
        isOpen={showRename}
        onClose={() => setShowRename(false)}
        initialValue={chat.title}
        onConfirm={handleRename}
        title="Rename Chat"
        label="Title"
      />
    </>
  );
}
