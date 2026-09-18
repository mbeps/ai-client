"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-is-mobile";

interface ResponsiveDetailsProps {
  /** The element that triggers opening the details panel on click. */
  trigger: React.ReactNode;
  /** Heading displayed at the top of the dialog/drawer. */
  title: string;
  /** Accessible description for screen readers. */
  description?: string;
  /** Optional tooltip content to display when hovering over the trigger. */
  tooltip?: React.ReactNode;
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
  tooltip,
  children,
}: ResponsiveDetailsProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const triggerButton = isMobile ? (
    <DrawerTrigger asChild>{trigger}</DrawerTrigger>
  ) : (
    <DialogTrigger asChild>{trigger}</DialogTrigger>
  );

  const renderedTrigger = tooltip ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{triggerButton}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    triggerButton
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        {renderedTrigger}
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
      {renderedTrigger}
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
