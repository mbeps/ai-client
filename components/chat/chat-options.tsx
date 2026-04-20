"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, FolderOutput, MoreHorizontal, Edit2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { toast } from "sonner";
import { RenameDialog } from "@/components/shared/rename-dialog";
import { useAppStore } from "@/lib/store";
import type { Chat } from "@/lib/store";

/**
 * Internal options menu for a chat card.
 * Renders as a Drawer on mobile and a DropdownMenu on desktop.
 * Provides Rename, Move Chat, and Delete Chat actions.
 * @author Maruf Bepary
 */
export function ChatOptions({
  chat,
  onDelete,
}: {
  chat: Chat;
  onDelete: () => void;
}) {
  const isMobile = useIsMobile();
  const renameChatDb = useAppStore((state) => state.renameChatDb);
  const [open, setOpen] = useState(false);
  const [showRename, setShowRename] = useState(false);

  const handleRename = async (newName: string) => {
    try {
      await renameChatDb(chat.id, newName);
      toast.success("Chat renamed");
    } catch (error) {
      toast.error("Failed to rename chat");
      throw error;
    }
  };

  if (isMobile) {
    return (
      <>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle className="truncate">{chat.title}</DrawerTitle>
            </DrawerHeader>
            <div className="p-4 space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setShowRename(true);
                  setOpen(false);
                }}
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Rename
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setOpen(false)}
              >
                <FolderOutput className="mr-2 h-4 w-4" />
                Move Chat
              </Button>
              <Button
                variant="destructive"
                className="w-full justify-start"
                onClick={() => {
                  onDelete();
                  setOpen(false);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Chat
              </Button>
            </div>
            <DrawerFooter className="pt-2">
              <DrawerClose asChild>
                <Button variant="outline">Cancel</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

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

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowRename(true)}>
            <Edit2 className="mr-2 h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem>
            <FolderOutput className="mr-2 h-4 w-4" />
            Move Chat
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
            onClick={onDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Chat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
