"use client";

import { Edit2, Trash2 } from "lucide-react";
import { renameKnowledgebase } from "@/lib/actions/knowledgebases/rename-knowledgebase";
import { deleteKnowledgebase } from "@/lib/actions/knowledgebases/delete-knowledgebase";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import { BaseEntityOptions } from "@/components/shared/base-entity-options";
import { useEntityOptions } from "@/hooks/use-entity-options";
import { ROUTES } from "@/constants/routes";

/**
 * Dropdown/Drawer menu with Rename and Delete options for knowledgebases.
 * Uses useEntityOptions hook for shared dialog state and direct Server Actions for mutations.
 * Responsive design: renders as Popover on desktop, Drawer on mobile via useIsMobile.
 *
 * @param props.kb - Knowledgebase entity with id and name.
 * @returns Menu with action items, rename dialog, and delete confirmation dialog.
 * @see useEntityOptions for dialog and action state management.
 * @author Maruf Bepary
 */
export function KnowledgebaseOptions({
  kb,
  onAfterMutation,
}: {
  kb: Knowledgebase;
  onAfterMutation?: () => void;
}) {
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
    id: kb.id,
    type: "Knowledgebase",
    onRename: renameKnowledgebase,
    onDelete: (id) => deleteKnowledgebase(id),
    redirectPath: ROUTES.KNOWLEDGEBASES.path,
    useRouterRefresh: true,
    onAfterMutation,
  });

  const items = [
    {
      label: "Rename Knowledgebase",
      icon: <Edit2 className="mr-2 h-4 w-4" />,
      onClick: () => setShowRename(true),
    },
    {
      label: "Delete Knowledgebase",
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      onClick: () => setShowDelete(true),
      isDestructive: true,
    },
  ];

  return (
    <BaseEntityOptions
      name={kb.name}
      items={items}
      isMobile={isMobile}
      showRename={showRename}
      setShowRename={setShowRename}
      showDelete={showDelete}
      setShowDelete={setShowDelete}
      isDeleting={isDeleting}
      handleRename={handleRename}
      handleDelete={handleDelete}
      renameTitle="Rename Knowledgebase"
      deleteTitle="Delete Knowledgebase"
      deleteDescription={`Are you sure you want to delete "${kb.name}"? This cannot be undone.`}
    />
  );
}
