"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, FolderOutput, MoreHorizontal } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import type { Chat } from "@/lib/store";

/**
 * Internal options menu for a chat card.
 * Renders as a Drawer on mobile and a DropdownMenu on desktop.
 * Provides "Move Chat" (UI-only) and "Delete Chat" actions.
 * @author Maruf Bepary
 */
export function ChatOptions({ chat, onDelete }: { chat: Chat; onDelete: () => void }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (isMobile) {
    return (
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
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>
          <FolderOutput className="mr-2 h-4 w-4" />
          Move Chat
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
          onClick={onDelete}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Chat
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
