"use client";

import { useCallback, useState } from "react";

/**
 * Custom hook that provides message editing state management.
 *
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
export function useMessageEditing() {
  const [isEditing, setIsEditing] = useState(false);

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  return {
    isEditing,
    setIsEditing,
    handleStartEdit,
    handleCancel,
  };
}
