"use client";

import { Trash2, Edit2 } from "lucide-react";
import type { TransformAgent } from "@/types/transform/transform-agent";
import { RenameDialog } from "@/components/shared/rename-dialog";
import { ResponsiveMenu } from "@/components/shared/responsive-menu";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { ROUTES } from "@/constants/routes";
import { useEntityOptions } from "@/hooks/use-entity-options";
import { renameTransformAgent } from "@/lib/actions/transform-agents/rename-transform-agent";
import { deleteTransformAgent } from "@/lib/actions/transform-agents/delete-transform-agent";

/**
 * Dropdown/Drawer menu with Rename and Delete options for transform agents.
 * Consistent with ProjectOptions and AssistantOptions.
 *
 * @param props.agent - TransformAgent entity.
 * @author Maruf Bepary
 */
export function TransformAgentOptions({ agent }: { agent: TransformAgent }) {
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
    id: agent.id,
    type: "Agent",
    onRename: (id, name) => renameTransformAgent(id, name),
    onDelete: (id) => deleteTransformAgent(id),
    redirectPath: ROUTES.WORKFLOWS.TRANSFORM.path,
    useRouterRefresh: true,
  });

  const items = [
    {
      label: "Rename Agent",
      icon: <Edit2 className="mr-2 h-4 w-4" />,
      onClick: () => setShowRename(true),
    },
    {
      label: "Delete Agent",
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      onClick: () => setShowDelete(true),
      isDestructive: true,
    },
  ];

  return (
    <>
      <ResponsiveMenu title={agent.name} items={items} isMobile={isMobile} />
      <RenameDialog
        isOpen={showRename}
        onClose={() => setShowRename(false)}
        initialValue={agent.name}
        onConfirm={handleRename}
        title="Rename Agent"
      />
      <DeleteConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Agent"
        description={`Are you sure you want to delete "${agent.name}"? This will also remove all associated runs and cannot be undone.`}
        loading={isDeleting}
      />
    </>
  );
}
