"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { compactChat } from "@/actions/chats/compact-chat";
import { useApiError } from "@/hooks/use-api-error";
import { useAppStore } from "@/lib/store/use-app-store";

/**
 * Manages manual conversation compaction for an active chat session.
 *
 * @param chatId - Active chat identifier
 * @returns Compaction loading state and trigger handler
 * @author Maruf Bepary
 */
export function useCompactChat(chatId: string) {
  const [isCompacting, setIsCompacting] = useState(false);
  const addMessage = useAppStore((state) => state.addMessage);
  const { handleApiError } = useApiError();

  const handleCompact = useCallback(
    async (modelId?: string) => {
      if (isCompacting) return;
      setIsCompacting(true);
      const toastId = toast.loading("Compacting conversation...");
      try {
        const res = await compactChat({ chatId, modelId });
        if (!res.ok) {
          if (!handleApiError(res.error)) {
            toast.error(res.error.message || "Failed to compact conversation", {
              id: toastId,
            });
          } else {
            toast.dismiss(toastId);
          }
          return;
        }

        const { message, compactedCount } = res.value;
        addMessage(chatId, {
          id: message.id,
          role: "system",
          content: message.content,
          parentId: message.parentId,
          metadata: message.metadata,
        });
        toast.success(
          `Compacted ${compactedCount} message${compactedCount === 1 ? "" : "s"}`,
          { id: toastId },
        );
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to compact conversation",
          { id: toastId },
        );
      } finally {
        setIsCompacting(false);
      }
    },
    [chatId, isCompacting, addMessage, handleApiError],
  );

  return { isCompacting, handleCompact };
}
