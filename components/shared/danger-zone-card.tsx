"use client";

import { Loader2, Shield, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Represents danger zone card props.
 *
 * @author Maruf Bepary
 */
export interface DangerZoneCardProps {
  /** Title for the danger zone section. Defaults to "Danger Zone" */
  title?: string;
  /** Description of the danger zone section. Defaults to standard message */
  description?: string;
  /** Detailed explanation of the consequences of deletion */
  consequences: ReactNode;
  /** Label for the delete action button. Defaults to "Delete" */
  buttonLabel?: string;
  /** Title for the confirmation dialog */
  confirmTitle: string;
  /** Description for the confirmation dialog */
  confirmDescription: string;
  /** Custom label for confirmation action button in dialog. Defaults to "Delete" */
  confirmLabel?: string;
  /** Custom loading text for confirmation action button in dialog. Defaults to "Deleting..." */
  confirmLoadingLabel?: string;
  /** Callback fired when deletion is confirmed in the dialog */
  onDelete: () => Promise<void> | void;
  /** Whether the delete action is currently processing */
  isDeleting?: boolean;
  /** Whether the delete button is disabled */
  disabled?: boolean;
}

/**
 * Reusable Danger Zone card component with integrated confirmation dialog.
 * Standardizes deletion warning containers and confirmation UX across all entity management views.
 *
 * @author Maruf Bepary
 */
export function DangerZoneCard({
  title = "Danger Zone",
  description = "Irreversible actions for this resource.",
  consequences,
  buttonLabel = "Delete",
  confirmTitle,
  confirmDescription,
  confirmLabel,
  confirmLoadingLabel,
  onDelete,
  isDeleting = false,
  disabled = false,
}: DangerZoneCardProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  return (
    <>
      <Card className="border-destructive/50 shadow-none">
        <CardHeader>
          <div className="mb-1 flex items-center gap-2">
            <Shield className="text-destructive h-5 w-5" />
            <CardTitle className="text-destructive">{title}</CardTitle>
          </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-muted-foreground text-sm">{consequences}</div>
          <Button
            variant="destructive"
            onClick={() => setIsConfirmOpen(true)}
            disabled={disabled || isDeleting}
            className="w-full sm:w-auto"
          >
            {isDeleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            {buttonLabel}
          </Button>
        </CardContent>
      </Card>

      <DeleteConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={onDelete}
        title={confirmTitle}
        description={confirmDescription}
        loading={isDeleting}
        confirmLabel={confirmLabel}
        confirmLoadingLabel={confirmLoadingLabel}
      />
    </>
  );
}
