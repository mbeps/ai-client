"use client";

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

interface DeleteConfirmDialogProps {
  /** Whether the dialog is currently visible. */
  isOpen: boolean;
  /** Callback to close the dialog. */
  onClose: () => void;
  /** Callback invoked when the user confirms deletion. */
  onConfirm: () => Promise<void> | void;
  /** Title text for the dialog. */
  title: string;
  /** Descriptive text explaining the consequences of deletion. */
  description: string;
  /** Optional loading state to disable buttons during processing. */
  loading?: boolean;
}

/**
 * Shared alert dialog for confirming destructive delete actions.
 * Provides a standardised layout with a title, description, and "Cancel" vs "Delete" buttons.
 *
 * @author Maruf Bepary
 */
export function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  loading,
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={async (e) => {
              e.preventDefault();
              await onConfirm();
              onClose();
            }}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
