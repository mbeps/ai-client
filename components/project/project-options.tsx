"use client";
import { Trash2, Pin, PinOff, Edit2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { Project } from "@/types/project";
import { RenameDialog } from "@/components/shared/rename-dialog";
import { ResponsiveMenu } from "@/components/shared/responsive-menu";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { toast } from "sonner";
import { ROUTES } from "@/lib/routes";
import { useEntityOptions } from "@/hooks/use-entity-options";

/**
 * Options menu for a project, providing Rename, Pin/Unpin, and Delete actions.
 * Shares logic between the ProjectCard and the global header.
 * Automatically handles navigation to the project list after deletion.
 *
 * @param props.project - The project entity to manage.
 * @author Maruf Bepary
 */
export function ProjectOptions({ project }: { project: Project }) {
  const toggleProjectPinDb = useAppStore((state) => state.toggleProjectPinDb);
  const renameProjectDb = useAppStore((state) => state.renameProjectDb);
  const deleteProjectDb = useAppStore((state) => state.deleteProjectDb);

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
    onRename: (id, name) => renameProjectDb(id, name),
    onDelete: (id) => deleteProjectDb(id),
    redirectPath: ROUTES.PROJECTS.path,
  });

  const handleTogglePin = async () => {
    try {
      await toggleProjectPinDb(project.id);
    } catch {
      toast.error("Failed to update pin");
    }
  };

  const items = [
    {
      label: project.isPinned ? "Unpin Project" : "Pin Project",
      icon: project.isPinned ? (
        <PinOff className="mr-2 h-4 w-4" />
      ) : (
        <Pin className="mr-2 h-4 w-4" />
      ),
      onClick: handleTogglePin,
    },
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
    <>
      <ResponsiveMenu title={project.name} items={items} isMobile={isMobile} />
      <RenameDialog
        isOpen={showRename}
        onClose={() => setShowRename(false)}
        initialValue={project.name}
        onConfirm={handleRename}
        title="Rename Project"
      />
      <DeleteConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Project"
        description={`Are you sure you want to delete "${project.name}"? This will also remove all associated chats and cannot be undone.`}
        loading={isDeleting}
      />
    </>
  );
}
