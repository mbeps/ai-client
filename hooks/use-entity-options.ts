"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";

interface UseEntityOptionsProps {
  id: string;
  type: string;
  onRename?: (id: string, newName: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  redirectPath?: string;
}

/**
 * Manages rename and delete operations for entities with dialog state and error handling.
 * Centralises toast notifications and conditional navigation for consistency across entity types.
 * Integrates with Zustand store actions (renameDb, deleteDb) and supports optional redirect on delete.
 *
 * @param props.id - Entity ID to manage.
 * @param props.type - Human-readable entity type (e.g., 'Project', 'Assistant') for toast messages.
 * @param props.onRename - Async callback for rename operation.
 * @param props.onDelete - Async callback for delete operation.
 * @param props.redirectPath - Optional path to navigate to after successful deletion.
 * @returns Dialog state (showRename, showDelete, isDeleting) and handlers (handleRename, handleDelete).
 * @see useCreateChat for chat creation flows.
 * @author Maruf Bepary
 */
export function useEntityOptions({
  id,
  type,
  onRename,
  onDelete,
  redirectPath,
}: UseEntityOptionsProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [showRename, setShowRename] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRename = async (newName: string) => {
    if (!onRename) return;
    try {
      await onRename(id, newName);
      toast.success(`${type} renamed`);
    } catch (error) {
      toast.error(`Failed to rename ${type.toLowerCase()}`);
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(id);
      toast.success(`${type} deleted`);
      if (redirectPath) {
        router.push(redirectPath);
      }
    } catch (error) {
      toast.error(`Failed to delete ${type.toLowerCase()}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    isMobile,
    showRename,
    setShowRename,
    showDelete,
    setShowDelete,
    isDeleting,
    handleRename,
    handleDelete,
  };
}
