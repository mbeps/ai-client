"use client";

import { Loader2, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
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

/**
 * Represents delete confirm dialog props.
 *
 * @author Maruf Bepary
 */
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
  /** Custom label for confirmation action button. Defaults to "Delete". */
  confirmLabel?: string;
  /** Custom loading text for confirmation action button. Defaults to "Deleting...". */
  confirmLoadingLabel?: string;
  /** Custom icon for confirmation action button. Defaults to Trash2. Pass null to omit icon. */
  confirmIcon?: ReactNode;
  /** Custom label for cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Custom icon for cancel button. Defaults to X. Pass null to omit icon. */
  cancelIcon?: ReactNode;
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
  confirmLabel = "Delete",
  confirmLoadingLabel = "Deleting...",
  confirmIcon,
  cancelLabel = "Cancel",
  cancelIcon,
}: DeleteConfirmDialogProps) {
  const renderedCancelIcon =
    cancelIcon === undefined ? <X className="mr-2 h-4 w-4" /> : cancelIcon;
  const renderedConfirmIcon =
    confirmIcon === undefined ? (
      <Trash2 className="mr-2 h-4 w-4" />
    ) : (
      confirmIcon
    );

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            {renderedCancelIcon}
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={async (e) => {
              e.preventDefault();
              await onConfirm();
              onClose();
            }}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {confirmLoadingLabel}
              </>
            ) : (
              <>
                {renderedConfirmIcon}
                {confirmLabel}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
