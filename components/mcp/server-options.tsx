"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Trash2,
  MoreHorizontal,
  Edit2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
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
import type { McpServer } from "@/lib/store";
import { RenameDialog } from "@/components/shared/rename-dialog";
import { toast } from "sonner";

export function ServerOptions({ server }: { server: McpServer }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [showRename, setShowRename] = useState(false);

  const renameMcpServer = useAppStore((state) => state.renameMcpServer);
  const toggleMcpServer = useAppStore((state) => state.toggleMcpServer);
  const removeMcpServer = useAppStore((state) => state.removeMcpServer);

  const handleRename = async (newName: string) => {
    try {
      await renameMcpServer(server.id, newName);
      toast.success("Server renamed");
    } catch (error) {
      toast.error("Failed to rename server");
      throw error;
    }
  };

  const handleToggle = async () => {
    try {
      await toggleMcpServer(server.id);
      toast.success(server.enabled ? "Server disabled" : "Server enabled");
    } catch {
      toast.error("Failed to toggle server");
    }
    setOpen(false);
  };

  const handleDelete = async () => {
    try {
      await removeMcpServer(server.id);
      toast.success("Server deleted");
    } catch {
      toast.error("Failed to delete server");
    }
    setOpen(false);
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
              <DrawerTitle>{server.name}</DrawerTitle>
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
                Rename Server
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleToggle}
              >
                {server.enabled ? (
                  <>
                    <ToggleRight className="mr-2 h-4 w-4" />
                    Disable Server
                  </>
                ) : (
                  <>
                    <ToggleLeft className="mr-2 h-4 w-4" />
                    Enable Server
                  </>
                )}
              </Button>
              <Button
                variant="destructive"
                className="w-full justify-start"
                onClick={handleDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Server
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
          initialValue={server.name}
          onConfirm={handleRename}
          title="Rename Server"
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
            Rename Server
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleToggle}>
            {server.enabled ? (
              <>
                <ToggleRight className="mr-2 h-4 w-4" />
                Disable Server
              </>
            ) : (
              <>
                <ToggleLeft className="mr-2 h-4 w-4" />
                Enable Server
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
            onClick={handleDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Server
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameDialog
        isOpen={showRename}
        onClose={() => setShowRename(false)}
        initialValue={server.name}
        onConfirm={handleRename}
        title="Rename Server"
      />
    </>
  );
}
