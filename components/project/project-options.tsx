"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Pin, PinOff, MoreHorizontal, Edit2 } from "lucide-react";
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
import type { Project } from "@/lib/store";
import { RenameDialog } from "@/components/shared/rename-dialog";
import { toast } from "sonner";

/**
 * Internal options menu for a project card.
 * Renders as a Drawer on mobile and a DropdownMenu on desktop.
 * Provides Pin/Unpin and Delete Project actions.
 * @author Maruf Bepary
 */
export function ProjectOptions({ project }: { project: Project }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [isPending, startTransition] = useTransition();

  const toggleProjectPin = useAppStore((state) => state.toggleProjectPin);
  const renameProjectDb = useAppStore((state) => state.renameProjectDb);

  const handleRename = async (newName: string) => {
    try {
      await renameProjectDb(project.id, newName);
      toast.success("Project renamed");
    } catch (error) {
      toast.error("Failed to rename project");
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
              <DrawerTitle>{project.name}</DrawerTitle>
            </DrawerHeader>
            <div className="p-4 space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  toggleProjectPin(project.id);
                  setOpen(false);
                }}
              >
                {project.isPinned ? (
                  <>
                    <PinOff className="mr-2 h-4 w-4" />
                    Unpin Project
                  </>
                ) : (
                  <>
                    <Pin className="mr-2 h-4 w-4" />
                    Pin Project
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setShowRename(true);
                  setOpen(false);
                }}
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Rename Project
              </Button>
              <Button
                variant="destructive"
                className="w-full justify-start"
                onClick={() => setOpen(false)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Project
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
          initialValue={project.name}
          onConfirm={handleRename}
          title="Rename Project"
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
          <DropdownMenuItem
            onClick={() => {
              toggleProjectPin(project.id);
              setOpen(false);
            }}
          >
            {project.isPinned ? (
              <>
                <PinOff className="mr-2 h-4 w-4" />
                Unpin Project
              </>
            ) : (
              <>
                <Pin className="mr-2 h-4 w-4" />
                Pin Project
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowRename(true)}>
            <Edit2 className="mr-2 h-4 w-4" />
            Rename Project
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:bg-destructive focus:text-destructive-foreground">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameDialog
        isOpen={showRename}
        onClose={() => setShowRename(false)}
        initialValue={project.name}
        onConfirm={handleRename}
        title="Rename Project"
      />
    </>
  );
}
