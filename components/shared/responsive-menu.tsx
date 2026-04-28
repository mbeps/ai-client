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
  /** Display label shown to the user. */
  label: string;
  /** Optional icon element (lucide-react icon recommended) rendered before the label. */
  icon?: React.ReactNode;
  /** Callback executed when the menu item is clicked. */
  onClick: () => void;
  /** Visual indicator that this item performs a destructive action (e.g. delete). */
  isDestructive?: boolean;
  /** When true, hides the item from the menu. Useful for conditional actions. */
  hidden?: boolean;
  /** When true, renders a visual separator line above this item. */
  separator?: boolean;
}

export interface ResponsiveMenuProps {
  /** Optional custom trigger button; defaults to three-dot icon button if omitted. */
  trigger?: React.ReactNode;
  /** Heading displayed at the top of the mobile drawer. */
  title: string;
  /** Array of menu actions with labels, icons, and callbacks. */
  items: MenuItem[];
  /** Whether the component is rendering on a mobile device; controls Drawer vs DropdownMenu. */
  isMobile: boolean;
}

/**
 * Adaptive menu component that renders as a DropdownMenu on desktop and a Drawer on mobile.
 * Filters hidden items and executes callbacks when menu items are clicked. Automatically
 * closes the menu after selection. Use with `useMobile()` hook to detect viewport size.
 *
 * @param props.trigger - Custom button element for opening the menu; uses default three-dot icon if not provided
 * @param props.title - Drawer header text (mobile only)
 * @param props.items - Menu items with destructive state and separators
 * @param props.isMobile - Toggles between Drawer (true) and DropdownMenu (false) layouts
 * @see {@link useResponsiveMenu} for recommended setup with mobile detection
 * @author Maruf Bepary
 */
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
                      ? "focus:bg-destructive focus:text-destructive-foreground"
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
