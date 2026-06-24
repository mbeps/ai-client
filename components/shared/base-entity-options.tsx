"use client";

import { RenameDialog } from "@/components/shared/rename-dialog";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { ResponsiveMenu } from "@/components/shared/responsive-menu";
import type { MenuItem } from "@/components/shared/responsive-menu";

/**
 * Shared UI pattern for entity option menus: a responsive menu (DropdownMenu on
 * desktop, Drawer on mobile) paired with Rename and Delete confirmation dialogs.
 *
 * Accepts rendering props rather than hook outputs, keeping it independent of
 * any particular entity type or state management.
 */
export function BaseEntityOptions({
  name,
  items,
  isMobile,
  showRename,
  setShowRename,
  showDelete,
  setShowDelete,
  isDeleting,
  handleRename,
  handleDelete,
  renameTitle = "Rename",
  renameLabel,
  deleteTitle = "Delete",
  deleteDescription = `Are you sure you want to delete "${name}"? This action cannot be undone.`,
  trigger,
}: {
  name: string;
  items: MenuItem[];
  isMobile: boolean;
  showRename: boolean;
  setShowRename: (v: boolean) => void;
  showDelete: boolean;
  setShowDelete: (v: boolean) => void;
  isDeleting: boolean;
  handleRename: (name: string) => Promise<void>;
  handleDelete: () => Promise<void>;
  renameTitle?: string;
  renameLabel?: string;
  deleteTitle?: string;
  deleteDescription?: string;
  trigger?: React.ReactNode;
}) {
  return (
    <>
      <ResponsiveMenu
        title={name}
        items={items}
        isMobile={isMobile}
        trigger={trigger}
      />
      <RenameDialog
        isOpen={showRename}
        onClose={() => setShowRename(false)}
        initialValue={name}
        onConfirm={handleRename}
        title={renameTitle}
        label={renameLabel}
      />
      <DeleteConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title={deleteTitle}
        description={deleteDescription}
        loading={isDeleting}
      />
    </>
  );
}
