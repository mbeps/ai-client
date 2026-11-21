"use client";

import { ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Props for the EntityCardActions component.
 */
export interface EntityCardActionsProps {
  detailUrl: string;
  openLabel: string;
  deleteLabel: string;
  confirmTitle: string;
  confirmDescription: string;
  onConfirmDelete: () => Promise<void> | void;
  isDeleting?: boolean;
  confirmLabel?: string;
  confirmLoadingLabel?: string;
}

/**
 * Shared open-link and delete-with-confirmation action buttons for listing cards.
 */
export function EntityCardActions({
  detailUrl,
  openLabel,
  deleteLabel,
  confirmTitle,
  confirmDescription,
  onConfirmDelete,
  isDeleting = false,
  confirmLabel,
  confirmLoadingLabel,
}: EntityCardActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground h-7 w-7"
          >
            <Link href={detailUrl} aria-label={openLabel}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{openLabel}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive h-7 w-7"
            onClick={() => setShowDeleteDialog(true)}
            aria-label={deleteLabel}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{deleteLabel}</TooltipContent>
      </Tooltip>

      <DeleteConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={onConfirmDelete}
        title={confirmTitle}
        description={confirmDescription}
        loading={isDeleting}
        confirmLabel={confirmLabel}
        confirmLoadingLabel={confirmLoadingLabel}
      />
    </>
  );
}
