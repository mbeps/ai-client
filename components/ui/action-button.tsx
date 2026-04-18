"use client";

import { type ComponentProps, type ReactNode, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LoadingSwap } from "@/components/ui/loading-swap";
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Generic async action wrapper that handles loading state and toast feedback.
 * Uses `useTransition()` for non-blocking pending state. Optionally wraps the trigger
 * in an `AlertDialog` confirmation step. Prefer `BetterAuthActionButton` for Better
 * Auth mutations whose responses use `{ error: null | { message } }`.
 *
 * @param props.action - Async callback; return `{ error: true }` to surface an error toast
 * @param props.requireAreYouSure - Show an `AlertDialog` before executing the action
 * @param props.areYouSureDescription - Custom body copy for the confirmation dialog
 * @author Maruf Bepary
 */
export function ActionButton({
  action,
  requireAreYouSure = false,
  areYouSureDescription = "This action cannot be undone.",
  ...props
}: ComponentProps<typeof Button> & {
  action: () => Promise<{ error: boolean; message?: string }>;
  requireAreYouSure?: boolean;
  areYouSureDescription?: ReactNode;
}) {
  const [isLoading, startTransition] = useTransition();

  /**
   * Executes the async action and displays toast feedback based on the result.
   */
  function performAction() {
    startTransition(async () => {
      const data = await action();
      if (data.error) {
        toast.error(data.message ?? "Error");
      } else if (data.message) {
        toast.success(data.message);
      }
    });
  }

  if (requireAreYouSure) {
    return (
      <AlertDialog open={isLoading ? true : undefined}>
        <AlertDialogTrigger asChild>
          <Button {...props} />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {areYouSureDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isLoading} onClick={performAction}>
              <LoadingSwap isLoading={isLoading}>Yes</LoadingSwap>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <Button
      {...props}
      disabled={props.disabled ?? isLoading}
      onClick={(e) => {
        performAction();
        props.onClick?.(e);
      }}
    >
      <LoadingSwap
        isLoading={isLoading}
        className="inline-flex items-center gap-2"
      >
        {props.children}
      </LoadingSwap>
    </Button>
  );
}
