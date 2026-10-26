"use client";

import { ModelFormDialog } from "@/components/settings/providers/model-form-dialog";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import type { AiModelRow } from "@/types/provider/ai-model-row";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";

/**
 * Represents model table modals props.
 *
 * @author Maruf Bepary
 */
export type ModelTableModalsProps = {
  dialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
  providers: AiProviderRow[];
  editingModel: AiModelRow | null;
  onRefresh: () => Promise<void> | void;
  modelToDelete: AiModelRow | null;
  onCloseDeleteModel: () => void;
  isModelDeleteLoading: boolean;
  onConfirmDeleteModel: () => Promise<void>;
  isBulkDeleteConfirmOpen: boolean;
  onCloseBulkDelete: () => void;
  selectedCount: number;
  isBulkDeleteLoading: boolean;
  onConfirmBulkDelete: () => Promise<void>;
};

/**
 * Renders the model table modals component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
export function ModelTableModals(props: ModelTableModalsProps) {
  return (
    <>
      <ModelFormDialog
        open={props.dialogOpen}
        onOpenChange={props.onDialogOpenChange}
        providers={props.providers}
        model={props.editingModel}
        onSaved={() => {
          void props.onRefresh();
        }}
      />

      <DeleteConfirmDialog
        isOpen={Boolean(props.modelToDelete)}
        onClose={props.onCloseDeleteModel}
        title="Delete Model"
        description={`Are you sure you want to delete "${props.modelToDelete?.label ?? props.modelToDelete?.modelId ?? props.modelToDelete?.id}"? This action cannot be undone.`}
        loading={props.isModelDeleteLoading}
        onConfirm={props.onConfirmDeleteModel}
      />

      <DeleteConfirmDialog
        isOpen={props.isBulkDeleteConfirmOpen}
        onClose={props.onCloseBulkDelete}
        title="Delete Models"
        description={`Are you sure you want to delete ${props.selectedCount} selected models? This action cannot be undone.`}
        loading={props.isBulkDeleteLoading}
        onConfirm={props.onConfirmBulkDelete}
      />
    </>
  );
}
