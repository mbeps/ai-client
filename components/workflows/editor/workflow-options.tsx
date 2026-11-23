"use client";

import { Edit2, Trash2 } from "lucide-react";
import { deleteWorkflow } from "@/actions/workflows/delete-workflow";
import { renameWorkflow } from "@/actions/workflows/rename-workflow";
import { BaseEntityOptions } from "@/components/shared/base-entity-options";
import { ROUTES } from "@/config/routes";
import { useEntityOptions } from "@/hooks/use-entity-options";
import type { WorkflowItem } from "@/types/workflows/workflow";

/**
 * Dropdown/drawer context menu for renaming or deleting a workflow.
 */
export function WorkflowOptions({ workflow }: { workflow: WorkflowItem }) {
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
    id: workflow.id,
    type: "Workflow",
    onRename: (id, name) => renameWorkflow(id, { name }),
    onDelete: (id) => deleteWorkflow(id),
    redirectPath: ROUTES.WORKFLOWS.AUTOMATIONS.path,
    useRouterRefresh: true,
  });

  const items = [
    {
      label: "Rename Workflow",
      icon: <Edit2 className="mr-2 h-4 w-4" />,
      onClick: () => setShowRename(true),
    },
    {
      label: "Delete Workflow",
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      onClick: () => setShowDelete(true),
      isDestructive: true,
    },
  ];

  return (
    <BaseEntityOptions
      name={workflow.name}
      items={items}
      isMobile={isMobile}
      showRename={showRename}
      setShowRename={setShowRename}
      showDelete={showDelete}
      setShowDelete={setShowDelete}
      isDeleting={isDeleting}
      handleRename={handleRename}
      handleDelete={handleDelete}
      renameTitle="Rename Workflow"
      deleteTitle="Delete Workflow"
      deleteDescription={`Are you sure you want to delete "${workflow.name}"? This will remove all graph nodes, edges, and run history.`}
    />
  );
}
