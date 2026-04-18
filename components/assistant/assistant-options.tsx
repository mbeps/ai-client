"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, MoreHorizontal } from "lucide-react";
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
import type { Assistant } from "@/lib/store";

/**
 * Internal options menu for an assistant card.
 * Renders as a Drawer on mobile and a DropdownMenu on desktop.
 * Provides a Delete Assistant action.
 */
export function AssistantOptions({ assistant }: { assistant: Assistant }) {
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
            <DrawerTitle>{assistant.name}</DrawerTitle>
          </DrawerHeader>
          <div className="p-4">
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
        <DropdownMenuItem className="text-destructive focus:bg-destructive focus:text-destructive-foreground">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Assistant
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
