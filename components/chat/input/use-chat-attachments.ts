import { useCallback, useState } from "react";
import { toast } from "sonner";
import { processAttachment } from "@/lib/attachments/process-attachment";
import type { Attachment } from "@/types/attachment/attachment";

/**
 * Represents use chat attachments options.
 *
 * @author Maruf Bepary
 */
export interface UseChatAttachmentsOptions {
  initialAttachments?: Attachment[];
  supportsVision: boolean;
  onVisionUnsupported: () => void;
}

const EMPTY_ATTACHMENTS: Attachment[] = [];

/**
 * Performs process files to add.
 *
 * @param files - Target files
 * @param existingAttachments - Target existing attachments
 * @param supportsVision - Target supports vision
 * @param onVisionUnsupported - Target on vision unsupported
 * @returns The resolved result
 * @author Maruf Bepary
 */
async function processFilesToAdd(
  files: File[],
  existingAttachments: Attachment[],
  supportsVision: boolean,
  onVisionUnsupported: () => void,
): Promise<Attachment[]> {
  const localNew: Attachment[] = [];
  for (const file of files) {
    if (file.type.startsWith("image/") && !supportsVision) {
      onVisionUnsupported();
      continue;
    }

    try {
      const att = await processAttachment(file, [
        ...existingAttachments,
        ...localNew,
      ]);
      localNew.push(att);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to process file",
      );
    }
  }
  return localNew;
}

/**
 * Manages chat input attachment state, file validation, and drag-and-drop interactions.
 *
 * @param options - Target options
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
export function useChatAttachments(options: UseChatAttachmentsOptions) {
  const { supportsVision, onVisionUnsupported } = options;
  const [attachments, setAttachments] = useState<Attachment[]>(
    () => options.initialAttachments ?? EMPTY_ATTACHMENTS,
  );
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const newAttachments = await processFilesToAdd(
        Array.from(files),
        attachments,
        supportsVision,
        onVisionUnsupported,
      );
      if (newAttachments.length > 0) {
        setAttachments((prev) => [...prev, ...newAttachments]);
      }
    },
    [attachments, supportsVision, onVisionUnsupported],
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) addFiles(e.target.files);
      e.target.value = "";
    },
    [addFiles],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments(EMPTY_ATTACHMENTS);
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
    isDragging,
    addFiles,
    handleFileInputChange,
    removeAttachment,
    clearAttachments,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
