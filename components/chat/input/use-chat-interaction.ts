import { useCallback } from "react";
import { useChatAttachments } from "@/components/chat/input/use-chat-attachments";
import { useChatInputSelections } from "@/components/chat/input/use-chat-input-selections";
import type { useChatInputServices } from "@/components/chat/input/use-chat-input-services";
import { useChatPromptSelection } from "@/components/chat/input/use-chat-prompt-selection";
import { useChatSubmit } from "@/components/chat/input/use-chat-submit";
import { useMentionCommands } from "@/hooks/chat/use-mention-commands";
import { estimateTokens } from "@/lib/chat/calculate-context-tokens";
import { AttachmentVisionUnsupportedError } from "@/lib/errors";
import type { Attachment } from "@/types/attachment/attachment";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { PublicMcpServer } from "@/types/mcp/public-mcp-server";
import type { Skill } from "@/types/skill/skill";

export interface ChatInteractionProps {
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
  servers?: (McpServer | PublicMcpServer)[];
  initialAttachments?: Attachment[];
  initialSelectedServerIds?: string[];
  initialSelectedTools?: readonly string[] | string[];
  initialSelectedPromptId?: string | string[];
  initialSelectedAssistantId?: string;
  initialSelectedKbs?: string[];
  initialSelectedSkillIds?: string[];
  onKnowledgebaseChange?: (kbIds: string[]) => void;
  activeChatAssistantId?: string | null;
  initialSubagentsEnabled?: boolean;
  initialSubagentModelId?: string;
  initialSubagentExcludedTools?: string[];
}

function calculateSkillTokens(
  skills: Skill[],
  selectedSkills: Set<string>,
  supportsTools: boolean,
): { selectedSkillTokens: number; availableSkillCount: number } {
  const enabledSkills = skills.filter((s) => s.enabled);
  let injected = 0;
  for (const skill of enabledSkills) {
    if (!selectedSkills.has(skill.id)) continue;
    injected += estimateTokens(skill.content);
    if (skill.files) {
      for (const f of skill.files) {
        injected += estimateTokens(f.content);
      }
    }
  }
  const catalog = supportsTools ? enabledSkills.length : 0;
  return { selectedSkillTokens: injected, availableSkillCount: catalog };
}

function checkIsSendDisabled(
  hasNoModels: boolean,
  input: string,
  attachmentsCount: number,
  hasPrompts: boolean,
  hasAssistant: boolean,
  skillsCount: number,
  kbsCount: number,
): boolean {
  if (hasNoModels) return true;
  return (
    !input.trim() &&
    attachmentsCount === 0 &&
    !hasPrompts &&
    !hasAssistant &&
    skillsCount === 0 &&
    kbsCount === 0
  );
}

export interface UseChatInteractionOptions {
  props: ChatInteractionProps;
  services: ReturnType<typeof useChatInputServices>;
  input: string;
  setInput: (val: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  canMentionAssistant: boolean;
}

/**
 * Manages attachments, tool selections, mention commands, and send dispatching for ChatInput.
 */
export function useChatInteraction(options: UseChatInteractionOptions) {
  const { props, services, input, setInput, textareaRef, canMentionAssistant } =
    options;

  const handleVisionUnsupported = useCallback(
    () => services.handleApiError(new AttachmentVisionUnsupportedError()),
    [services.handleApiError],
  );

  const attachments = useChatAttachments({
    initialAttachments: props.initialAttachments,
    supportsVision: services.supportsVision,
    onVisionUnsupported: handleVisionUnsupported,
  });

  const selections = useChatInputSelections(props);

  const { selectedSkillTokens, availableSkillCount } = calculateSkillTokens(
    services.skills,
    selections.selectedSkills,
    services.supportsTools,
  );

  const mentions = useMentionCommands(
    input,
    setInput,
    textareaRef,
    props.activeChatAssistantId,
    props.initialSelectedPromptId,
    props.initialSelectedAssistantId,
    canMentionAssistant,
    selections.selectedServerIds,
    selections.onMentionSkill,
    selections.onMentionKb,
    services.knowledgebases,
  );

  const prompts = useChatPromptSelection(
    mentions.selectedPrompts,
    mentions.setSelectedPrompts,
    mentions.setSelectedPrompt,
  );

  const isSendDisabled = checkIsSendDisabled(
    services.hasNoModels,
    input,
    attachments.attachments.length,
    prompts.promptList.length > 0 || Boolean(mentions.selectedPrompt),
    Boolean(mentions.selectedAssistant),
    selections.selectedSkills.size,
    selections.selectedKbs.size,
  );

  const submit = useChatSubmit({
    onSend: props.onSend,
    isLoading: props.isLoading,
    isSendDisabled,
    supportsTools: services.supportsTools,
    selectedTools: selections.selectedTools,
    selectedServerIds: selections.selectedServerIds,
    promptList: prompts.promptList,
    selectedPrompt: mentions.selectedPrompt,
    input,
    setInput,
    attachments: attachments.attachments,
    clearAttachments: attachments.clearAttachments,
    handleClearPrompts: prompts.handleClearPrompts,
    setSelectedAssistant: mentions.setSelectedAssistant,
    clearSelectedSkills: selections.clearSelectedSkills,
    modelId: services.modelId,
    selectedAssistant: mentions.selectedAssistant,
    selectedKbs: selections.selectedKbs,
    selectedSkills: selections.selectedSkills,
    subagentsEnabled: selections.subagentsEnabled,
    subagentModelId: selections.subagentModelId,
    subagentExcludedTools: selections.subagentExcludedTools,
    handleCommandKeyDown: mentions.handleKeyDown,
  });

  const handleRemoveAssistant = useCallback(() => {
    mentions.setSelectedAssistant(null);
  }, [mentions.setSelectedAssistant]);

  const handleOpenSubagents = useCallback(() => {
    selections.setIsSubagentDialogOpen(true);
  }, [selections.setIsSubagentDialogOpen]);

  const handleCloseMentions = useCallback(() => {
    mentions.setOpenTrigger(null);
  }, [mentions.setOpenTrigger]);

  return {
    attachments,
    selections,
    selectedSkillTokens,
    availableSkillCount,
    mentions,
    prompts,
    isSendDisabled,
    submit,
    handleRemoveAssistant,
    handleOpenSubagents,
    handleCloseMentions,
  };
}
