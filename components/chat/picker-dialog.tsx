"use client";

import { Check, ExternalLink, type LucideIcon, X } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface PickerDialogProps {
  /** Controlled open state */
  open?: boolean;
  /** Callback fired when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Custom trigger element */
  trigger?: React.ReactNode;

  /** Header title */
  title: string;
  /** Header description for screen readers */
  description?: string;

  /** Flag indicating whether the list is empty */
  isEmpty?: boolean;
  /** Icon shown in empty state */
  emptyIcon?: LucideIcon;
  /** Title text shown in empty state */
  emptyTitle?: string;
  /** Action link shown in empty state */
  emptyAction?: {
    label: string;
    href: string;
  };

  /** Management link shown on the bottom left */
  manageAction?: {
    label: string;
    href: string;
  };

  /** Optional action buttons placed before Cancel/Done */
  extraActions?: React.ReactNode;

  /** Callback when Cancel is clicked */
  onCancel?: () => void;
  /** Callback when Done is clicked */
  onDone?: () => void;

  /** Dialog content body */
  children?: React.ReactNode;
}

/**
 * Unified dialog shell for chat resource pickers (tools, prompts, skills, knowledgebases).
 *
 * @author Maruf Bepary
 */
export function PickerDialog({
  open: controlledOpen,
  onOpenChange,
  trigger,
  title,
  description,
  isEmpty = false,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyAction,
  manageAction,
  extraActions,
  onCancel,
  onDone,
  children,
}: PickerDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="flex max-h-[80vh] flex-col overflow-hidden p-0 sm:max-h-[600px] sm:max-w-lg">
        <DialogHeader className="border-b px-4 py-3.5 pr-12">
          <DialogTitle className="font-semibold text-base">{title}</DialogTitle>
          {description && (
            <DialogDescription className="sr-only">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        {isEmpty ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
            {EmptyIcon && (
              <EmptyIcon className="mx-auto mb-3 h-8 w-8 text-primary opacity-40" />
            )}
            {emptyTitle && <p className="mb-2">{emptyTitle}</p>}
            {emptyAction && (
              <Link
                href={emptyAction.href}
                className="text-primary underline underline-offset-4"
                onClick={() => handleOpenChange(false)}
              >
                {emptyAction.label}
              </Link>
            )}
          </div>
        ) : (
          <>
            {children}

            <div className="flex shrink-0 items-center justify-between border-t bg-muted/20 px-4 py-3">
              {manageAction ? (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-8 gap-1.5 text-muted-foreground text-xs hover:text-foreground"
                >
                  <Link
                    href={manageAction.href}
                    onClick={() => handleOpenChange(false)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>{manageAction.label}</span>
                  </Link>
                </Button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
                {extraActions}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onCancel?.();
                    handleOpenChange(false);
                  }}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onDone?.();
                    handleOpenChange(false);
                  }}
                  className="gap-2 px-6"
                >
                  <Check className="h-4 w-4" />
                  Done
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
