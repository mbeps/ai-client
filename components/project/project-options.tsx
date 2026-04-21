"use client";

import { useState } from "react";
import { Trash2, Pin, PinOff, Edit2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAppStore } from "@/lib/store";
import type { Project } from "@/lib/store";
import { RenameDialog } from "@/components/shared/rename-dialog";
import { ResponsiveMenu } from "@/components/shared/responsive-menu";
import { toast } from "sonner";

export function ProjectOptions({ project }: { project: Project }) {
  const isMobile = useIsMobile();
  const [showRename, setShowRename] = useState(false);

  const toggleProjectPinDb = useAppStore((state) => state.toggleProjectPinDb);
  const renameProjectDb = useAppStore((state) => state.renameProjectDb);
  const deleteProjectDb = useAppStore((state) => state.deleteProjectDb);

  const handleRename = async (newName: string) => {
    try {
      await renameProjectDb(project.id, newName);
      toast.success("Project renamed");
    } catch (error) {
      toast.error("Failed to rename project");
      throw error;
    }
  };

  const handleTogglePin = async () => {
    try {
      await toggleProjectPinDb(project.id);
    } catch {
      toast.error("Failed to update pin");
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete project "${project.name}"? This cannot be undone.`))
      return;
    try {
      await deleteProjectDb(project.id);
      toast.success("Project deleted");
    } catch {
      toast.error("Failed to delete project");
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
      onClick: handleDelete,
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
    </>
  );
}
