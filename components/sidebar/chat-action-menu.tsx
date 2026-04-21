"use client";

import * as React from "react";
import { SidebarMenuAction, useSidebar } from "@/components/ui/sidebar";
import {
  MoreHorizontal,
  Trash2,
  Edit2,
  FolderInput,
  Check,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RenameDialog } from "@/components/shared/rename-dialog";

/**
 * Internal action menu for a sidebar chat item.
 * Renders as a Drawer on mobile and a DropdownMenu on desktop.
 * Provides Rename, Move to Project, and Delete actions.
 *
 * @param props.chat - The chat object containing id, title, and projectId.
 * @author Maruf Bepary
 */
export function ChatActionMenu({
  chat,
}: {
  chat: { id: string; title: string; projectId?: string };
}) {
  const { isMobile } = useSidebar();
  const deleteChatDb = useAppStore((state) => state.deleteChatDb);
  const renameChatDb = useAppStore((state) => state.renameChatDb);
  const moveChatDb = useAppStore((state) => state.moveChatDb);
  const projects = useAppStore((state) => state.projects);
  const router = useRouter();

  const [showRename, setShowRename] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteChatDb(chat.id);
        toast.success("Chat deleted");
        router.push(ROUTES.CHATS.path);
      } catch (error) {
        toast.error("Failed to delete chat");
      }
    });
  };

  const handleRename = async (newName: string) => {
    try {
      await renameChatDb(chat.id, newName);
      toast.success("Chat renamed");
    } catch (error) {
      toast.error("Failed to rename chat");
      throw error;
    }
  };

  const handleMove = (projectId: string | null) => {
    startTransition(async () => {
      try {
        await moveChatDb(chat.id, projectId);
        toast.success(
          projectId ? "Chat moved to project" : "Chat moved to standalone",
        );
      } catch (error) {
        toast.error("Failed to move chat");
      }
    });
  };

  return (
    <>
      {isMobile ? (
        <Drawer>
          <DrawerTrigger asChild>
            <SidebarMenuAction className="lg:opacity-0 lg:group-hover/menu-item:opacity-100">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">More</span>
            </SidebarMenuAction>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Manage Chat</DrawerTitle>
            </DrawerHeader>
            <div className="p-4 space-y-4">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setShowRename(true)}
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Rename
              </Button>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2">
                  Move to Project
                </p>
                <div className="space-y-1">
                  <Button
                    variant="ghost"
                    className="w-full justify-start font-normal"
                    onClick={() => handleMove(null)}
                  >
                    {!chat.projectId && (
                      <Check className="mr-2 h-4 w-4 text-primary" />
                    )}
                    <span className={!chat.projectId ? "" : "ml-6"}>
                      None (Standalone)
                    </span>
                  </Button>
                  {projects.map((p) => (
                    <Button
                      key={p.id}
                      variant="ghost"
                      className="w-full justify-start font-normal"
                      onClick={() => handleMove(p.id)}
                    >
                      {chat.projectId === p.id && (
                        <Check className="mr-2 h-4 w-4 text-primary" />
                      )}
                      <span className={chat.projectId === p.id ? "" : "ml-6"}>
                        {p.name}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>

              <DropdownMenuSeparator />

              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isPending}
                className="w-full justify-start"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Chat
              </Button>
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">Cancel</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction className="lg:opacity-0 lg:group-hover/menu-item:opacity-100">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">More</span>
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-56">
            <DropdownMenuItem onClick={() => setShowRename(true)}>
              <Edit2 className="mr-2 h-4 w-4" />
              <span>Rename</span>
            </DropdownMenuItem>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderInput className="mr-2 h-4 w-4" />
                <span>Move to Project</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => handleMove(null)}>
                    {!chat.projectId && (
                      <Check className="mr-2 h-4 w-4 text-primary" />
                    )}
                    <span className={!chat.projectId ? "" : "ml-6"}>
                      None (Standalone)
                    </span>
                  </DropdownMenuItem>
                  {projects.length > 0 && <DropdownMenuSeparator />}
                  {projects.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => handleMove(p.id)}
                    >
                      {chat.projectId === p.id && (
                        <Check className="mr-2 h-4 w-4 text-primary" />
                      )}
                      <span className={chat.projectId === p.id ? "" : "ml-6"}>
                        {p.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleDelete}
              disabled={isPending}
              className="text-destructive focus:bg-destructive focus:text-destructive-foreground cursor-pointer"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

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

