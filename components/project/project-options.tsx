"use client";
import { Trash2, Pin, PinOff, Edit2 } from "lucide-react";
import type { Project } from "@/types/project";
import { RenameDialog } from "@/components/shared/rename-dialog";
import { ResponsiveMenu } from "@/components/shared/responsive-menu";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { toast } from "sonner";
import { ROUTES } from "@/constants/routes";
import { useEntityOptions } from "@/hooks/use-entity-options";
import { renameProject } from "@/lib/actions/projects/rename-project";
import { deleteProject } from "@/lib/actions/projects/delete-project";
import { togglePinProject } from "@/lib/actions/projects/toggle-pin-project";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";

/**
 * Dropdown/Drawer menu with Pin/Unpin, Rename, and Delete options for projects.
 * Uses useEntityOptions hook for shared dialog state and direct Server Actions for mutations.
 * Responsive design: renders as Popover on desktop, Drawer on mobile via useIsMobile.
 *
 * @param props.project - Project entity with id, name, and isPinned status.
 * @returns Menu with action items, rename dialog, and delete confirmation dialog.
 * @see useEntityOptions for dialog and action state management.
 * @see ResponsiveMenu for responsive menu wrapper.
 * @author Maruf Bepary
 */
export function ProjectOptions({ project }: { project: Project }) {
  const router = useRouter();
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

  const handleTogglePin = async () => {
    try {
      await togglePinProject(project.id);
      router.refresh();
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
