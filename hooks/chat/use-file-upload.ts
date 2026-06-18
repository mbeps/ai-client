"use client";

import { useState, useCallback } from "react";
import type { Attachment } from "@/types/attachment/attachment";
import { processAttachment } from "@/lib/attachments/process-attachment";
import { AttachmentVisionUnsupportedError } from "@/lib/constants/errors";
import { useApiError } from "@/hooks/use-api-error";
import { toast } from "sonner";

interface UseFileUploadOptions {
  supportsVision: boolean;
  existingAttachments?: Attachment[];
}

interface UseFileUploadReturn {
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  addFiles: (files: FileList | File[]) => Promise<void>;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  isDragging: boolean;
  dragHandlers: {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}

/**
 * Manages file attachment state for the chat input.
 * Handles file validation, vision-support checks, drag-and-drop,
 * and processing via processAttachment.
 *
 * @param options.supportsVision - Whether the selected model supports vision/image inputs
 * @param options.existingAttachments - Initial attachments to populate
 * @returns Attachments array, add/remove helpers, and drag-and-drop handlers
 */
export function useFileUpload({
  supportsVision,
  existingAttachments = [],
}: UseFileUploadOptions): UseFileUploadReturn {
  const [attachments, setAttachments] =
    useState<Attachment[]>(existingAttachments);
  const [isDragging, setIsDragging] = useState(false);
  const { handleApiError } = useApiError();

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const localNew: Attachment[] = [];
      for (const file of Array.from(files)) {
        if (file.type.startsWith("image/") && !supportsVision) {
          const error = new AttachmentVisionUnsupportedError();
          handleApiError(error);
          continue;
        }

        try {
          const att = await processAttachment(file, [
            ...attachments,
            ...localNew,
          ]);
          localNew.push(att);
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Failed to process file",
          );
        }
      }
      if (localNew.length > 0) {
        setAttachments((prev) => [...prev, ...localNew]);
      }
    },
    [attachments, supportsVision, handleApiError],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  return {
    attachments,
    setAttachments,
    addFiles,
    removeAttachment,
    clearAttachments,
    isDragging,
    dragHandlers: {
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
  };
}
