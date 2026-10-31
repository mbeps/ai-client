"use client";
import { Edit2, Trash2 } from "lucide-react";
import { deleteProject } from "@/actions/projects/delete-project";
import { renameProject } from "@/actions/projects/rename-project";
import { BaseEntityOptions } from "@/components/shared/base-entity-options";
import { ROUTES } from "@/config/routes";
import { useEntityOptions } from "@/hooks/use-entity-options";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Project } from "@/types/project/project";

/**
 * Dropdown/Drawer menu with Rename and Delete options for projects.
 * Uses useEntityOptions hook for shared dialog state and direct Server Actions for mutations.
 * Responsive design: renders as Popover on desktop, Drawer on mobile via useIsMobile.
 *
 * @param props.project - Project entity with id and name.
 * @returns Menu with action items, rename dialog, and delete confirmation dialog.
 * @see useEntityOptions for dialog and action state management.
 * @see ResponsiveMenu for responsive menu wrapper.
 */
export function ProjectOptions({ project }: { project: Project }) {
  const loadProjects = useAppStore((state) => state.loadProjects);

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
    id: project.id,
    type: "Project",
    onRename: (id, name) => renameProject(id, name),
    onDelete: (id) => deleteProject(id),
    redirectPath: ROUTES.PROJECTS.path,
    useRouterRefresh: true,
    onAfterMutation: loadProjects,
  });

  const items = [
    {
      label: "Rename Project",
      icon: <Edit2 className="mr-2 h-4 w-4" />,
      onClick: () => setShowRename(true),
    },
    {
      label: "Delete Project",
      icon: <Trash2 className="mr-2 h-4 w-4" />,
      onClick: () => setShowDelete(true),
      isDestructive: true,
    },
  ];

  return (
    <BaseEntityOptions
      name={project.name}
      items={items}
      isMobile={isMobile}
      showRename={showRename}
      setShowRename={setShowRename}
      showDelete={showDelete}
      setShowDelete={setShowDelete}
      isDeleting={isDeleting}
      handleRename={handleRename}
      handleDelete={handleDelete}
      renameTitle="Rename Project"
      deleteTitle="Delete Project"
      deleteDescription={`Are you sure you want to delete "${project.name}"? This will also remove all associated chats and cannot be undone.`}
    />
  );
}
