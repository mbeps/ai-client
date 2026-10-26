import { useCallback, useMemo } from "react";
import type { MentionPromptItem } from "@/hooks/chat/use-mention-commands";

/**
 * Manages selection and toggle state for multiple prompt items.
 */
export function useChatPromptSelection(
  selectedPrompts: MentionPromptItem[] | undefined,
  setSelectedPrompts:
    | React.Dispatch<React.SetStateAction<MentionPromptItem[]>>
    | undefined,
) {
  const promptList = selectedPrompts || [];
  const selectedPromptIds = useMemo(
    () => new Set(promptList.map((p) => p.id)),
    [promptList],
  );

  const handleTogglePrompt = useCallback(
    (prompt: MentionPromptItem) => {
      if (setSelectedPrompts) {
        setSelectedPrompts((prev = []) => {
          if (prev.some((p) => p.id === prompt.id)) {
            return prev.filter((p) => p.id !== prompt.id);
          }
          return [...prev, prompt];
        });
      }
    },
    [setSelectedPrompts],
  );

  const handleRemovePrompt = useCallback(
    (promptId?: string) => {
      if (setSelectedPrompts) {
        setSelectedPrompts((prev = []) => {
          if (!promptId) return [];
          return prev.filter((p) => p.id !== promptId);
        });
      }
    },
    [setSelectedPrompts],
  );

  const handleClearPrompts = useCallback(() => {
    if (setSelectedPrompts) {
      setSelectedPrompts([]);
    }
  }, [setSelectedPrompts]);

  return {
    promptList,
    selectedPromptIds,
    handleTogglePrompt,
    handleRemovePrompt,
    handleClearPrompts,
  };
}
