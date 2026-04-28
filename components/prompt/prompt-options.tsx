"use client";
import { Trash2, Edit2, ExternalLink } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { Prompt } from "@/types/prompt";
import { RenameDialog } from "@/components/shared/rename-dialog";
import { ResponsiveMenu } from "@/components/shared/responsive-menu";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { useEntityOptions } from "@/hooks/use-entity-options";

/**
 * Dropdown/Drawer menu with Edit Content, Rename, and Delete options for prompts.
 * Uses useEntityOptions hook for shared dialog state and updatePromptDb/deletePromptDb from store for mutations.
 * Responsive design: renders as Popover on desktop, Drawer on mobile via useIsMobile.
 *
 * @param props.prompt - Prompt entity with id, title, and shortcut.
 * @returns Menu with action items, rename dialog, and delete confirmation dialog.
 * @see useEntityOptions for dialog and action state management.
 * @see ResponsiveMenu for responsive menu wrapper.
 * @author Maruf Bepary
 */
export function PromptOptions({ prompt }: { prompt: Prompt }) {
  const router = useRouter();
  const updatePromptDb = useAppStore((state) => state.updatePromptDb);
  const deletePromptDb = useAppStore((state) => state.deletePromptDb);

  const {
    isMobile,
    showRename,
    setShowRename,
    showDelete,
    setShowDelete,
    isDeleting,
    handleRename,
    handleDelete,
  } = useEntityOptions({
    id: prompt.id,
    type: "Prompt",
    onRename: (id, name) => updatePromptDb(id, { title: name }),
    onDelete: (id) => deletePromptDb(id),
    redirectPath: ROUTES.SETTINGS.PROMPTS.path,
  });

  const items = [
    {
      label: "Edit Content",
      icon: <ExternalLink className="mr-2 h-4 w-4" />,
      onClick: () => router.push(ROUTES.SETTINGS.PROMPTS.detail(prompt.id)),
    },
    {
      label: "Rename Prompt",
      icon: <Edit2 className="mr-2 h-4 w-4" />,
      onClick: () => setShowRename(true),
    },
    {
      label: "Delete Prompt",
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      onClick: () => setShowDelete(true),
      isDestructive: true,
    },
  ];

  return (
    <>
      <ResponsiveMenu title={prompt.title} items={items} isMobile={isMobile} />
      <RenameDialog
        isOpen={showRename}
        onClose={() => setShowRename(false)}
        initialValue={prompt.title}
        onConfirm={handleRename}
        title="Rename Prompt"
      />
      <DeleteConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Prompt"
        description={`Are you sure you want to delete "${prompt.title}"? This cannot be undone.`}
        loading={isDeleting}
      />
    </>
  );
}
