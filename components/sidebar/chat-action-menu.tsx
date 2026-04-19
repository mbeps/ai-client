"use client";

import * as React from "react";
import { SidebarMenuAction, useSidebar } from "@/components/ui/sidebar";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

/**
 * Internal action menu for a sidebar chat item.
 * Renders as a Drawer on mobile and a DropdownMenu on desktop.
 * Provides a Delete action that removes the chat from the Zustand store
 * and redirects to the chats list.
 * @props chat - The chat object containing at least an id and title.
 */
export function ChatActionMenu({
  chat,
}: {
  chat: { id: string; title: string };
}) {
  const { isMobile } = useSidebar();
  const deleteChatDb = useAppStore((state) => state.deleteChatDb);
  const router = useRouter();

  const handleDelete = async () => {
    await deleteChatDb(chat.id);
    router.push(ROUTES.CHATS.path);
  };

  if (isMobile) {
    return (
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
          <div className="p-4 flex flex-col gap-2">
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="w-full justify-start"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Chat
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction className="lg:opacity-0 lg:group-hover/menu-item:opacity-100">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">More</span>
        </SidebarMenuAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start">
        <DropdownMenuItem
          onClick={handleDelete}
          className="text-destructive focus:bg-destructive focus:text-destructive-foreground cursor-pointer"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
