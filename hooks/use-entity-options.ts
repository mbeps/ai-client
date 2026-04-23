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
 * Shared hook for entity options components (Chat, Project, Assistant, etc.).
 * Manages state for rename and delete dialogs, handles toasts, and navigation.
 *
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
