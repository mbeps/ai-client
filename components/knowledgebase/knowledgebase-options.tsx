"use client";
import { Edit2, Trash2 } from "lucide-react";
import { renameKnowledgebase } from "@/lib/actions/knowledgebases/rename-knowledgebase";
import { deleteKnowledgebase } from "@/lib/actions/knowledgebases/delete-knowledgebase";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import { RenameDialog } from "@/components/shared/rename-dialog";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { ResponsiveMenu } from "@/components/shared/responsive-menu";
import { useEntityOptions } from "@/hooks/use-entity-options";
import { ROUTES } from "@/constants/routes";

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
    <>
      <ResponsiveMenu title={kb.name} items={items} isMobile={isMobile} />
      <RenameDialog
        isOpen={showRename}
        onClose={() => setShowRename(false)}
        initialValue={kb.name}
        onConfirm={handleRename}
        title="Rename Knowledgebase"
      />
      <DeleteConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Knowledgebase"
        description={`Are you sure you want to delete "${kb.name}"? This cannot be undone.`}
        loading={isDeleting}
      />
    </>
  );
}
