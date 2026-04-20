"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, MoreHorizontal, Edit2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAppStore } from "@/lib/store";
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
import type { Assistant } from "@/lib/store";
import { RenameDialog } from "@/components/shared/rename-dialog";
import { toast } from "sonner";

/**
 * Internal options menu for an assistant card.
 * Renders as a Drawer on mobile and a DropdownMenu on desktop.
 * Provides a Delete Assistant action.
 */
export function AssistantOptions({ assistant }: { assistant: Assistant }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [showRename, setShowRename] = useState(false);

  const renameAssistantDb = useAppStore((state) => state.renameAssistantDb);

  const handleRename = async (newName: string) => {
    try {
      await renameAssistantDb(assistant.id, newName);
      toast.success("Assistant renamed");
    } catch (error) {
      toast.error("Failed to rename assistant");
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
              <DrawerTitle>{assistant.name}</DrawerTitle>
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
                Rename Assistant
              </Button>
              <Button
                variant="destructive"
                className="w-full justify-start"
                onClick={() => {
                  setOpen(false);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Assistant
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
          initialValue={assistant.name}
          onConfirm={handleRename}
          title="Rename Assistant"
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
            Rename Assistant
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:bg-destructive focus:text-destructive-foreground">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Assistant
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
