"use client";

import { Ban, CirclePlay, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { JobItem } from "@/types/jobs";

export interface CancelJobDialogProps {
  cancelTarget: JobItem | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * Confirmation dialog for cancelling an active or queued background job.
 */
export function CancelJobDialog({
  cancelTarget,
  isPending,
  onOpenChange,
  onConfirm,
}: CancelJobDialogProps) {
  return (
    <AlertDialog
      open={cancelTarget !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) {
          onOpenChange(false);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Job Run</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to cancel the job &quot;
            {cancelTarget?.title}&quot;? Any in-progress processing will be
            aborted immediately.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            <CirclePlay className="mr-1.5 size-4" />
            Keep Running
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              <>
                <Ban className="mr-1.5 size-4" />
                Cancel Job
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
