import { useCallback, useMemo } from "react";
import type { MentionPromptItem } from "@/hooks/chat/use-mention-commands";

export function resolvePromptPayload(
  promptIds: string[],
  selectedPromptId?: string,
): string[] | undefined {
  if (promptIds.length > 0) return promptIds;
  return selectedPromptId ? [selectedPromptId] : undefined;
}

/**
 * Manages selection and toggle state for single and multiple prompt items.
 */
export function useChatPromptSelection(
  selectedPrompts: MentionPromptItem[] | undefined,
  setSelectedPrompts:
    | React.Dispatch<React.SetStateAction<MentionPromptItem[]>>
    | undefined,
  setSelectedPrompt: ((prompt: MentionPromptItem | null) => void) | undefined,
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
      } else if (setSelectedPrompt) {
        setSelectedPrompt(prompt);
      }
    },
    [setSelectedPrompts, setSelectedPrompt],
  );

  const handleRemovePrompt = useCallback(
    (promptId?: string) => {
      if (setSelectedPrompts) {
        setSelectedPrompts((prev = []) => {
          if (!promptId) return [];
          return prev.filter((p) => p.id !== promptId);
        });
      } else if (setSelectedPrompt) {
        setSelectedPrompt(null);
      }
    },
    [setSelectedPrompts, setSelectedPrompt],
  );

  const handleClearPrompts = useCallback(() => {
    if (setSelectedPrompts) {
      setSelectedPrompts([]);
    } else if (setSelectedPrompt) {
      setSelectedPrompt(null);
    }
  }, [setSelectedPrompts, setSelectedPrompt]);

  return {
    promptList,
    selectedPromptIds,
    handleTogglePrompt,
    handleRemovePrompt,
    handleClearPrompts,
  };
}
