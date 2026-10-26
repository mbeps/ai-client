import { DEFAULT_ENABLED_TOOLS } from "@/config/tools";
import { parseMessageMetadata } from "@/lib/chat/parse-message-metadata";
import type { Assistant } from "@/types/assistant/assistant";
import type { Chat } from "@/types/chat/chat";
import type { Message } from "@/types/message/message";
import type { Project } from "@/types/project/project";
import type { UserSettingsRow } from "@/types/user/user-settings-row";

export function getThreadLastModelId(thread: Message[]): string | undefined {
  for (let i = thread.length - 1; i >= 0; i--) {
    const msg = thread[i];
    if (msg.role === "user" && msg.metadata) {
      const { modelId } = parseMessageMetadata(msg.metadata);
      if (modelId) return modelId;
    }
  }
  return undefined;
}

export function resolveInitialModelId(
  thread: Message[],
  currentProject: Project | undefined,
  currentAssistant: Assistant | undefined,
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

export function resolveInitialSubagents(thread: Message[]): {
  initialSubagentsEnabled: boolean;
  initialSubagentModelId: string | undefined;
} {
  const lastUserMessage = [...thread].reverse().find((m) => m.role === "user");
  if (lastUserMessage?.metadata) {
    const { subagentsEnabled, subagentModelId } = parseMessageMetadata(
      lastUserMessage.metadata,
    );
    return {
      initialSubagentsEnabled: subagentsEnabled ?? false,
      initialSubagentModelId: subagentModelId,
    };
  }
  return {
    initialSubagentsEnabled: false,
    initialSubagentModelId: undefined,
  };
}

export function resolveInitialTools(
  currentProject?: Project,
  currentAssistant?: Assistant,
): {
  initialServerIds: string[];
  initialSelectedTools: string[];
} {
  const projectTools = currentProject?.tools ?? [];
  const assistantTools = currentAssistant?.tools ?? [];
  const hasCustomTools = projectTools.length > 0 || assistantTools.length > 0;

  const combined = Array.from(new Set([...projectTools, ...assistantTools]));
  const serverIds = Array.from(
    new Set(
      combined
        .map((t) => t.split(":")[0])
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const customTools = combined.filter((t) => t.includes(":tool:"));
  const selectedTools = hasCustomTools
    ? customTools
    : [...DEFAULT_ENABLED_TOOLS];

  return {
    initialServerIds: serverIds,
    initialSelectedTools: selectedTools,
  };
}

export function resolveInitialKbIds(
  chat?: Chat,
  currentProject?: Project,
): string[] {
  const kbId = chat?.knowledgebaseId ?? currentProject?.knowledgebaseId;
  return kbId ? [kbId] : [];
}

export function resolveInitialSkillIds(
  currentAssistant?: Assistant,
  currentProject?: Project,
): string[] {
  const source = currentAssistant ?? currentProject;
  return source?.skillMode === "specific" ? (source.skillIds ?? []) : [];
}

export interface InitialChatConfig {
  initialModelId: string | undefined;
  initialSubagentsEnabled: boolean;
  initialSubagentModelId: string | undefined;
  initialServerIds: string[];
  initialSelectedTools: string[];
  initialKbIds: string[];
  initialSkillIds: string[];
}

export function resolveInitialChatConfig(
  thread: Message[],
  currentProject: Project | undefined,
  currentAssistant: Assistant | undefined,
  userSettings: UserSettingsRow | null,
  chat: Chat | undefined,
): InitialChatConfig {
  const { initialSubagentsEnabled, initialSubagentModelId } =
    resolveInitialSubagents(thread);
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
    initialServerIds,
    initialSelectedTools,
    initialKbIds: resolveInitialKbIds(chat, currentProject),
    initialSkillIds: resolveInitialSkillIds(currentAssistant, currentProject),
  };
}

/**
 * Resolves the active chat prioritizing hydrated store state over pre-fetched chat.
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

export function findAssistant(
  assistants: Assistant[],
  assistantId?: string | null,
): Assistant | undefined {
  if (!assistantId) return undefined;
  return assistants.find((a) => a.id === assistantId);
}

export function findProject(
  projects: Project[],
  projectId?: string | null,
): Project | undefined {
  if (!projectId) return undefined;
  return projects.find((p) => p.id === projectId);
}
