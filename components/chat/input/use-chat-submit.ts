import { useCallback } from "react";
import { resolvePromptPayload } from "@/components/chat/input/use-chat-prompt-selection";
import type { MentionPromptItem } from "@/hooks/chat/use-mention-commands";
import type { Attachment } from "@/types/attachment/attachment";

export interface UseChatSubmitOptions {
  onSend: (
    content: string,
    attachments: Attachment[],
    model: string,
    selectedServerIds: string[],
    selectedTools: string[],
    selectedPromptId?: string | string[],
    selectedAssistantId?: string,
    selectedKnowledgebases?: string[],
    selectedSkillIds?: string[],
    subagentsEnabled?: boolean,
    subagentModelId?: string,
    subagentExcludedTools?: string[],
  ) => void;
  isLoading?: boolean;
  isSendDisabled: boolean;
  supportsTools: boolean;
  selectedTools: Set<string>;
  selectedServerIds: Set<string>;
  promptList: MentionPromptItem[];
  selectedPrompt?: MentionPromptItem | null;
  input: string;
  setInput: (val: string) => void;
  attachments: Attachment[];
  clearAttachments: () => void;
  handleClearPrompts: () => void;
  setSelectedAssistant: (assistant: null) => void;
  clearSelectedSkills: () => void;
  modelId: string;
  selectedAssistant?: { id: string } | null;
  selectedKbs: Set<string>;
  selectedSkills: Set<string>;
  subagentsEnabled: boolean;
  subagentModelId?: string;
  subagentExcludedTools: string[];
  handleCommandKeyDown: (e: React.KeyboardEvent) => boolean;
}

/**
 * Handles enter key presses and submission dispatching for the chat input form.
 */
export function useChatSubmit(options: UseChatSubmitOptions) {
  const {
    onSend,
    isLoading,
    isSendDisabled,
    supportsTools,
    selectedTools,
    selectedServerIds,
    promptList,
    selectedPrompt,
    input,
    setInput,
    attachments,
    clearAttachments,
    handleClearPrompts,
    setSelectedAssistant,
    clearSelectedSkills,
    modelId,
    selectedAssistant,
    selectedKbs,
    selectedSkills,
    subagentsEnabled,
    subagentModelId,
    subagentExcludedTools,
    handleCommandKeyDown,
  } = options;

  const handleSend = useCallback(() => {
    if (isLoading || isSendDisabled) return;

    const effectiveTools = supportsTools ? Array.from(selectedTools) : [];
    const effectiveServerIds = supportsTools
      ? Array.from(selectedServerIds)
      : [];
    const promptPayload = resolvePromptPayload(
      promptList.map((p) => p.id),
      selectedPrompt?.id,
    );

    onSend(
      input,
      attachments,
      modelId,
      effectiveServerIds,
      effectiveTools,
      promptPayload,
      selectedAssistant?.id,
      Array.from(selectedKbs),
      Array.from(selectedSkills),
      subagentsEnabled,
      subagentModelId,
      subagentExcludedTools,
    );
    setInput("");
    clearAttachments();
    handleClearPrompts();
    setSelectedAssistant(null);
    clearSelectedSkills();
  }, [
    isLoading,
    isSendDisabled,
    supportsTools,
    selectedTools,
    selectedServerIds,
    promptList,
    selectedPrompt,
    onSend,
    input,
    attachments,
    modelId,
    selectedAssistant,
    selectedKbs,
    selectedSkills,
    subagentsEnabled,
    subagentModelId,
    subagentExcludedTools,
    setInput,
    clearAttachments,
    handleClearPrompts,
    setSelectedAssistant,
    clearSelectedSkills,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const wasCommandHandled = handleCommandKeyDown(e);
      if (wasCommandHandled) return;

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleCommandKeyDown, handleSend],
  );

  return { handleSend, handleKeyDown };
}

