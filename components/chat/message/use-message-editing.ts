"use client";

import { useState } from "react";

interface UseMessageEditingProps {
  displayContent: string;
  hasAttachments: boolean;
  onSaveMessage: (content: string) => void;
}

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
