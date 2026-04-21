"use client";

import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  isDestructive?: boolean;
  hidden?: boolean;
  separator?: boolean;
}

export interface ResponsiveMenuProps {
  trigger?: React.ReactNode;
  title: string;
  items: MenuItem[];
  isMobile: boolean;
}

export function ResponsiveMenu({
  trigger,
  title,
  items,
  isMobile,
}: ResponsiveMenuProps) {
  const [open, setOpen] = useState(false);

  const visibleItems = items.filter((item) => !item.hidden);

  const defaultTrigger = (
    <Button variant="ghost" size="icon" className="h-8 w-8">
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  );

  return (
    <>
      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>{trigger ?? defaultTrigger}</DrawerTrigger>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>{title}</DrawerTitle>
            </DrawerHeader>
            <div className="p-4 space-y-2">
              {visibleItems.map((item, i) => (
                <Button
                  key={i}
                  variant={item.isDestructive ? "destructive" : "outline"}
                  className="w-full justify-start"
                  onClick={() => {
                    item.onClick();
                    setOpen(false);
                  }}
                >
                  {item.icon}
                  {item.label}
                </Button>
              ))}
            </div>
            <DrawerFooter className="pt-2">
              <DrawerClose asChild>
                <Button variant="outline">Cancel</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            {trigger ?? defaultTrigger}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {visibleItems.map((item, i) => (
              <Fragment key={i}>
                {item.separator && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  className={
                    item.isDestructive
                      ? "text-destructive focus:bg-destructive focus:text-destructive-foreground"
                      : undefined
                  }
                  onClick={item.onClick}
                >
                  {item.icon}
                  {item.label}
                </DropdownMenuItem>
              </Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}

