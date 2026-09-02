"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-is-mobile";

interface ResponsiveDetailsProps {
  /** The element that triggers opening the details panel on click. */
  trigger: React.ReactNode;
  /** Heading displayed at the top of the dialog/drawer. */
  title: string;
  /** Accessible description for screen readers. */
  description?: string;
  /** Content rendered inside the dialog/drawer body. */
  children: React.ReactNode;
}

/**
 * Adaptive details panel: renders a Dialog on desktop and a Drawer on mobile.
 * Wraps a trigger element that opens the panel on click.
 *
 * @param props.trigger - Clickable element that opens the panel
 * @param props.title - Dialog/drawer heading
 * @param props.description - Accessible description text
 * @param props.children - Panel body content
 */
export function ResponsiveDetails({
  trigger,
  title,
  description,
  children,
}: ResponsiveDetailsProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>{title}</DrawerTitle>
            {description && (
              <DrawerDescription>{description}</DrawerDescription>
            )}
          </DrawerHeader>
          <div className="px-4 pb-4">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
