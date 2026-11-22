import { LINKABLE_BUILT_IN_AGENT_IDS } from "@/config/built-in-agents";
import { DEFAULT_ENABLED_TOOLS } from "@/config/tools";
import { extractServerIdsFromTools } from "@/lib/chat/extract-server-ids-from-tools";
import { parseMessageMetadata } from "@/lib/chat/parse-message-metadata";
import type { ReasoningEffort } from "@/schemas/providers/provider-registry";
import type { Agent } from "@/types/agent/agent";
import type { Chat } from "@/types/chat/chat";
import type { Message } from "@/types/message/message";
import type { Project } from "@/types/project/project";
import type { ApprovalMode } from "@/types/tool/approval";
import type { UserSettingsRow } from "@/types/user/user-settings-row";

/**
 * Retrieves thread last model id.
 *
 * @param thread - Array of chat messages in the conversation
 * @returns The resolved result
 * @author Maruf Bepary
 */
function getThreadLastModelId(thread: Message[]): string | undefined {
  for (let i = thread.length - 1; i >= 0; i--) {
    const msg = thread[i];
    if (msg.role === "user" && msg.metadata) {
      const { modelId } = parseMessageMetadata(msg.metadata);
      if (modelId) return modelId;
    }
  }
  return undefined;
}

/**
 * Resolves initial model id.
 *
 * @param thread - Array of chat messages in the conversation
 * @param currentProject - Target current project
 * @param currentAssistant - Target current assistant
 * @param userSettings - Target user settings
 * @returns The resolved result
 * @author Maruf Bepary
 */
function resolveInitialModelId(
  thread: Message[],
  currentProject: Project | undefined,
  currentAssistant: Agent | undefined,
  userSettings: UserSettingsRow | null,
): string | undefined {
  const fromThread = getThreadLastModelId(thread);
  if (fromThread) return fromThread;

  const projectModel = (currentProject as any)?.defaultChatModelId;
  if (projectModel) return projectModel;

  const assistantModel = (currentAssistant as any)?.defaultChatModelId;
  if (assistantModel) return assistantModel;

  return userSettings?.defaultChatModelId || undefined;
}

/**
 * Resolves initial subagent enablement and model override.
 * Prioritizes an explicit user toggle saved in the last user message metadata;
 * otherwise auto-enables subagents when the active assistant or project has linked subagents.
 *
 * @param thread - Array of chat messages in the conversation
 * @param currentProject - Active project configuration
 * @param currentAssistant - Active assistant/agent configuration
 * @returns Initial subagent enabled flag and optional model override
 * @author Maruf Bepary
 */
function resolveInitialSubagents(
  thread: Message[],
  currentProject?: Project,
  currentAssistant?: Agent,
): {
  initialSubagentsEnabled: boolean;
  initialSubagentModelId: string | undefined;
  initialSubagentIds: string[];
} {
  const lastUserMessage = [...thread].reverse().find((m) => m.role === "user");
  const lastUserMeta = lastUserMessage?.metadata
    ? parseMessageMetadata(lastUserMessage.metadata)
    : undefined;

  const hasEntitySubagents =
    Boolean(currentAssistant?.subagentIds?.length) ||
    Boolean(currentProject?.subagentIds?.length);

  const initialSubagentsEnabled =
    lastUserMeta?.subagentsEnabled !== undefined
      ? lastUserMeta.subagentsEnabled
      : hasEntitySubagents;

  const initialSubagentModelId =
    lastUserMeta?.subagentsEnabled !== undefined
      ? lastUserMeta.subagentModelId
      : undefined;

  const initialSubagentIds =
    lastUserMeta?.subagentIds !== undefined
      ? lastUserMeta.subagentIds
      : currentAssistant?.subagentIds?.length
        ? [...currentAssistant.subagentIds]
        : currentProject?.subagentIds?.length
          ? [...currentProject.subagentIds]
          : [...LINKABLE_BUILT_IN_AGENT_IDS];

  return {
    initialSubagentsEnabled,
    initialSubagentModelId,
    initialSubagentIds,
  };
}

/**
 * Resolves initial tools.
 *
 * @param currentProject - Target current project
 * @param currentAssistant - Target current assistant
 * @returns The resolved result
 * @author Maruf Bepary
 */
function resolveInitialTools(
  currentProject?: Project,
  currentAssistant?: Agent,
): {
  initialServerIds: string[];
  initialSelectedTools: string[];
} {
  const configuredTools =
    currentAssistant?.tools ?? currentProject?.tools ?? undefined;

  if (Array.isArray(configuredTools)) {
    const selectedTools = configuredTools.filter((t) => t.includes(":tool:"));
    const serverIds = extractServerIdsFromTools(configuredTools);
    return {
      initialServerIds: serverIds,
      initialSelectedTools: selectedTools,
    };
  }

  return {
    initialServerIds: [],
    initialSelectedTools: [...DEFAULT_ENABLED_TOOLS],
  };
}

/**
 * Resolves initial kb ids.
 *
 * @param chat - Target chat
 * @param currentProject - Target current project
 * @param currentAssistant - Target current assistant
 * @returns The resolved result
 * @author Maruf Bepary
 */
function resolveInitialKbIds(
  chat?: Chat,
  currentProject?: Project,
  currentAssistant?: Agent,
): string[] {
  const primaryKbId = chat?.knowledgebaseId ?? currentProject?.knowledgebaseId;
  const agentKbIds = currentAssistant?.knowledgebaseIds ?? [];
  return Array.from(
    new Set([...(primaryKbId ? [primaryKbId] : []), ...agentKbIds]),
  );
}

/**
 * Resolves initial skill ids.
 *
 * @param currentAssistant - Target current assistant
 * @param currentProject - Target current project
 * @returns The resolved result
 * @author Maruf Bepary
 */
function resolveInitialSkillIds(
  currentAssistant?: Agent,
  currentProject?: Project,
): string[] {
  const source = currentAssistant ?? currentProject;
  return source?.skillMode === "specific" ? (source.skillIds ?? []) : [];
}

/**
 * Resolves initial reasoning effort from the thread's last user message or defaults to 'medium'.
 *
 * @param thread - Array of chat messages in the conversation
 * @returns Resolved reasoning effort
 * @author Maruf Bepary
 */
export function resolveInitialReasoningEffort(
  thread: Message[],
): ReasoningEffort {
  for (let i = thread.length - 1; i >= 0; i--) {
    const msg = thread[i];
    if (msg.role === "user" && msg.metadata) {
      const { reasoningEffort } = parseMessageMetadata(msg.metadata);
      if (reasoningEffort) return reasoningEffort;
    }
  }
  return "medium";
}

/**
 * Resolves initial approval mode from the thread's last user message or defaults to "ask".
 */
export function resolveInitialApprovalMode(thread: Message[]): ApprovalMode {
  for (let i = thread.length - 1; i >= 0; i--) {
    const msg = thread[i];
    if (msg.role === "user" && msg.metadata) {
      const { approvalMode } = parseMessageMetadata(msg.metadata);
      if (approvalMode) return approvalMode;
    }
  }
  return "ask";
}

/**
 * Represents initial chat config.
 *
 * @author Maruf Bepary
 */
export interface InitialChatConfig {
  initialModelId: string | undefined;
  initialSubagentsEnabled: boolean;
  initialSubagentModelId: string | undefined;
  initialSubagentIds: string[];
  initialReasoningEffort: ReasoningEffort;
  initialServerIds: string[];
  initialSelectedTools: string[];
  initialKbIds: string[];
  initialSkillIds: string[];
  initialApprovalMode: ApprovalMode;
}

/**
 * Resolves initial chat config.
 *
 * @param thread - Array of chat messages in the conversation
 * @param currentProject - Target current project
 * @param currentAssistant - Target current assistant
 * @param userSettings - Target user settings
 * @param chat - Target chat
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function resolveInitialChatConfig(
  thread: Message[],
  currentProject: Project | undefined,
  currentAssistant: Agent | undefined,
  userSettings: UserSettingsRow | null,
  chat: Chat | undefined,
): InitialChatConfig {
  const {
    initialSubagentsEnabled,
    initialSubagentModelId,
    initialSubagentIds,
  } = resolveInitialSubagents(thread, currentProject, currentAssistant);
  const { initialServerIds, initialSelectedTools } = resolveInitialTools(
    currentProject,
    currentAssistant,
  );

  return {
    initialModelId: resolveInitialModelId(
      thread,
      currentProject,
      currentAssistant,
      userSettings,
    ),
    initialSubagentsEnabled,
    initialSubagentModelId,
    initialSubagentIds,
    initialReasoningEffort: resolveInitialReasoningEffort(thread),
    initialServerIds,
    initialSelectedTools,
    initialKbIds: resolveInitialKbIds(chat, currentProject, currentAssistant),
    initialSkillIds: resolveInitialSkillIds(currentAssistant, currentProject),
    initialApprovalMode: resolveInitialApprovalMode(thread),
  };
}

/**
 * Resolves the active chat prioritizing hydrated store state over pre-fetched chat.
 *
 * @param storeChat - Target store chat
 * @param initialChat - Target initial chat
 * @param chatId - Chat session identifier
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function resolveActiveChat(
  storeChat: Chat | undefined,
  initialChat: Chat | undefined,
  chatId: string,
): Chat | undefined {
  if (storeChat && Object.keys(storeChat.messages).length > 0) {
    return storeChat;
  }
  if (initialChat?.id === chatId) {
    return initialChat;
  }
  return storeChat;
}

/**
 * Finds assistant.
 *
 * @param assistants - Target assistants
 * @param assistantId - Target assistant id
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function findAssistant(
  assistants: Agent[],
  assistantId?: string | null,
): Agent | undefined {
  if (!assistantId) return undefined;
  return assistants.find((a) => a.id === assistantId);
}

/**
 * Finds project.
 *
 * @param projects - Target projects
 * @param projectId - Project identifier
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function findProject(
  projects: Project[],
  projectId?: string | null,
): Project | undefined {
  if (!projectId) return undefined;
  return projects.find((p) => p.id === projectId);
}
