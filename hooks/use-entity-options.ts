"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";

interface UseEntityOptionsProps {
  id: string;
  type: string;
  onRename?: (id: string, newName: string) => Promise<any>;
  onDelete?: (id: string) => Promise<any>;
  redirectPath?: string;
  useRouterRefresh?: boolean;
  onAfterMutation?: () => void;
}

/**
 * Manages rename and delete operations for entities with dialog state and error handling.
 * Centralises toast notifications and conditional navigation for consistency across entity types.
 * Supports both Zustand store actions and direct Server Actions with optional router.refresh().
 *
 * @param props.id - Entity ID to manage.
 * @param props.type - Human-readable entity type (e.g., 'Project', 'Assistant') for toast messages.
 * @param props.onRename - Async callback for rename operation.
 * @param props.onDelete - Async callback for delete operation.
 * @param props.redirectPath - Optional path to navigate to after successful deletion.
 * @param props.useRouterRefresh - Whether to trigger router.refresh() after successful mutation.
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
  useRouterRefresh = false,
  onAfterMutation,
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
      if (useRouterRefresh) {
        router.refresh();
      }
      onAfterMutation?.();
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
      if (useRouterRefresh) {
        router.refresh();
      }
      onAfterMutation?.();
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
