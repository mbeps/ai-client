"use client";

import { useState } from "react";

/**
 * Represents use message editing props.
 *
 * @author Maruf Bepary
 */
interface UseMessageEditingProps {
  displayContent: string;
  hasAttachments: boolean;
  onSaveMessage: (content: string) => void;
}

/**
 * Custom hook that provides use message editing functionality.
 *
 * @param props - Target props
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
export function useMessageEditing({
  displayContent,
  hasAttachments,
  onSaveMessage,
}: UseMessageEditingProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(displayContent);

  const handleStartEdit = () => {
    setEditContent(displayContent);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!editContent.trim() && !hasAttachments) {
      return;
    }
    onSaveMessage(editContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(displayContent);
    setIsEditing(false);
  };

  return {
    isEditing,
    editContent,
    setEditContent,
    handleStartEdit,
    handleSave,
    handleCancel,
  };
}
