"use client";

import type * as React from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-is-mobile";

interface BaseResponsiveDialogProps {
  children?: React.ReactNode;
}

interface ResponsiveDialogRootProps extends BaseResponsiveDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Adaptive dialog root that dynamically switches between Dialog (desktop) and Drawer (mobile).
 *
 * @author Maruf Bepary
 */
export function ResponsiveDialog({
  children,
  ...props
}: ResponsiveDialogRootProps) {
  const isMobile = useIsMobile();
  const Component = isMobile ? Drawer : Dialog;
  return <Component {...props}>{children}</Component>;
}

export function ResponsiveDialogTrigger({
  children,
  ...props
}: React.ComponentProps<typeof DialogTrigger>) {
  const isMobile = useIsMobile();
  const Component = isMobile ? DrawerTrigger : DialogTrigger;
  return <Component {...props}>{children}</Component>;
}

export function ResponsiveDialogClose({
  children,
  ...props
}: React.ComponentProps<typeof DialogClose>) {
  const isMobile = useIsMobile();
  const Component = isMobile ? DrawerClose : DialogClose;
  return <Component {...props}>{children}</Component>;
}

export function ResponsiveDialogContent({
  children,
  className,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <DrawerContent
        className={className}
        {...(props as React.ComponentProps<typeof DrawerContent>)}
      >
        {children}
      </DrawerContent>
    );
  }

  return (
    <DialogContent className={className} {...props}>
      {children}
    </DialogContent>
  );
}

export function ResponsiveDialogHeader({
  children,
  className,
  ...props
}: React.ComponentProps<typeof DialogHeader>) {
  const isMobile = useIsMobile();
  const Component = isMobile ? DrawerHeader : DialogHeader;
  return (
    <Component className={className} {...props}>
      {children}
    </Component>
  );
}

export function ResponsiveDialogFooter({
  children,
  className,
  ...props
}: React.ComponentProps<typeof DialogFooter>) {
  const isMobile = useIsMobile();
  const Component = isMobile ? DrawerFooter : DialogFooter;
  return (
    <Component className={className} {...props}>
      {children}
    </Component>
  );
}

export function ResponsiveDialogTitle({
  children,
  className,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const isMobile = useIsMobile();
  const Component = isMobile ? DrawerTitle : DialogTitle;
  return (
    <Component className={className} {...props}>
      {children}
    </Component>
  );
}

export function ResponsiveDialogDescription({
  children,
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const isMobile = useIsMobile();
  const Component = isMobile ? DrawerDescription : DialogDescription;
  return (
    <Component className={className} {...props}>
      {children}
    </Component>
  );
}
