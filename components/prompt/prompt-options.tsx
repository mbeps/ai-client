"use client";

import { useState } from "react";
import { Trash2, Edit2, ExternalLink } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAppStore } from "@/lib/store";
import type { Prompt } from "@/types/prompt";
import { RenameDialog } from "@/components/shared/rename-dialog";
import { ResponsiveMenu } from "@/components/shared/responsive-menu";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";

/**
 * Options menu for a prompt, providing Rename, Edit, and Delete actions.
 *
 * @param props.prompt - The prompt entity to manage.
 * @author Maruf Bepary
 */
export function PromptOptions({ prompt }: { prompt: Prompt }) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const [showRename, setShowRename] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const updatePromptDb = useAppStore((state) => state.updatePromptDb);
  const deletePromptDb = useAppStore((state) => state.deletePromptDb);

  const handleRename = async (newName: string) => {
    try {
      await updatePromptDb(prompt.id, { title: newName });
      toast.success("Prompt renamed");
    } catch (error) {
      toast.error("Failed to rename prompt");
      throw error;
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deletePromptDb(prompt.id);
      toast.success("Prompt deleted");
      router.push(ROUTES.SETTINGS.PROMPTS.path);
    } catch {
      toast.error("Failed to delete prompt");
    } finally {
      setIsDeleting(false);
    }
  };

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
