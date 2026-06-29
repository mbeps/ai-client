"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/use-is-mobile";

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
 * Manages rename and delete modal state for entities with consistent error handling and navigation.
 * Provides toast feedback on success/failure, optional router refresh, and post-mutation callback.
 * Supports both Zustand store actions and direct Server Actions with conditional routing.
 *
 * Side effects: Shows toast notifications, calls router.refresh() if enabled, navigates on delete if redirectPath provided.
 * Use case: Context menu actions, entity detail page options, bulk operation feedback.
 * Constraint: Dialogs managed here; parent must render delete confirmation UI based on showDelete state.
 *
 * @param props.id - Entity ID to operate on (project, assistant, prompt, KB, etc.).
 * @param props.type - Human-readable entity type for toast messages (e.g. 'Project', 'Assistant').
 * @param props.onRename - Optional async callback invoked with (id, newName); if not provided, rename is disabled.
 * @param props.onDelete - Optional async callback invoked with (id); if not provided, delete is disabled.
 * @param props.redirectPath - Optional route to navigate to after successful deletion (e.g. /projects).
 * @param props.useRouterRefresh - If true, calls router.refresh() after successful mutation (default: false).
 * @param props.onAfterMutation - Optional callback invoked after successful rename or delete.
 * @returns Dialog state (showRename, showDelete, isDeleting) and handlers (handleRename, handleDelete) for UI binding.
 * @throws Errors from onRename/onDelete are re-thrown after toast; caller must handle in component.
 * @see useCreateChat for similar chat creation flow.
 * @see useAppStore for entity store mutations.
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
