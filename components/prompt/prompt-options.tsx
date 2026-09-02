"use client";
import { Edit2, ExternalLink, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { BaseEntityOptions } from "@/components/shared/base-entity-options";
import { ROUTES } from "@/constants/routes";
import { useEntityOptions } from "@/hooks/use-entity-options";
import { deletePrompt } from "@/lib/actions/prompts/delete-prompt";
import { updatePrompt } from "@/lib/actions/prompts/update-prompt";
import { useAppStore } from "@/lib/store";
import type { Prompt } from "@/types/prompt/prompt";

/**
 * Dropdown/Drawer menu with Edit Content, Rename, and Delete options for prompts.
 */
export function PromptOptions({ prompt }: { prompt: Prompt }) {
  const router = useRouter();
  const loadPrompts = useAppStore((state) => state.loadPrompts);

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
    onRename: (id, name) => updatePrompt(id, { title: name }),
    onDelete: (id) => deletePrompt(id),
    redirectPath: ROUTES.SETTINGS.PROMPTS.path,
    useRouterRefresh: true,
    onAfterMutation: loadPrompts,
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
    <BaseEntityOptions
      name={prompt.title}
      items={items}
      isMobile={isMobile}
      showRename={showRename}
      setShowRename={setShowRename}
      showDelete={showDelete}
      setShowDelete={setShowDelete}
      isDeleting={isDeleting}
      handleRename={handleRename}
      handleDelete={handleDelete}
      renameTitle="Rename Prompt"
      deleteTitle="Delete Prompt"
    />
  );
}
