"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { ArtifactPanel } from "@/components/chat/artifact-panel";
import { AssistantBar } from "@/components/chat/assistant-bar";
import { CanvasReopenButton } from "@/components/chat/canvas-reopen-button";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageThread } from "@/components/chat/message-thread";
import { StreamingSection } from "@/components/chat/streaming-section";
import { useChatArtifactPanel } from "@/components/chat/use-chat-artifact-panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DEFAULT_ENABLED_TOOLS } from "@/config/tools";
import { useStreamResponse } from "@/hooks/chat/use-stream-response";
import { useResourceHydration } from "@/hooks/use-resource-hydration";
import { extractCitations } from "@/lib/chat/extract-citations";
import { getDeepestLeaf } from "@/lib/chat/get-deepest-leaf";
import { parseMessageMetadata } from "@/lib/chat/parse-message-metadata";
import { reconstructThread } from "@/lib/chat/reconstruct-thread";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Assistant } from "@/types/assistant/assistant";
import type { Attachment } from "@/types/attachment/attachment";
import type { Chat } from "@/types/chat/chat";
import type { Message } from "@/types/message/message";
import type { Project } from "@/types/project/project";
import type { UserSettingsRow } from "@/types/user/user-settings-row";

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

function resolveInitialModelId(
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

function resolveInitialSubagents(thread: Message[]): {
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

function resolveInitialTools(
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

function resolveInitialKbIds(chat?: Chat, currentProject?: Project): string[] {
  const kbId = chat?.knowledgebaseId ?? currentProject?.knowledgebaseId;
  return kbId ? [kbId] : [];
}

function resolveInitialSkillIds(
  currentAssistant?: Assistant,
  currentProject?: Project,
): string[] {
  const source = currentAssistant ?? currentProject;
  return source?.skillMode === "specific" ? (source.skillIds ?? []) : [];
}

interface InitialChatConfig {
  initialModelId: string | undefined;
  initialSubagentsEnabled: boolean;
  initialSubagentModelId: string | undefined;
  initialServerIds: string[];
  initialSelectedTools: string[];
  initialKbIds: string[];
  initialSkillIds: string[];
}

function resolveInitialChatConfig(
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

function findAssistant(
  assistants: Assistant[],
  assistantId?: string | null,
): Assistant | undefined {
  if (!assistantId) return undefined;
  return assistants.find((a) => a.id === assistantId);
}

function findProject(
  projects: Project[],
  projectId?: string | null,
): Project | undefined {
  if (!projectId) return undefined;
  return projects.find((p) => p.id === projectId);
}

function scrollElementToBottom(container: HTMLElement | null): void {
  if (!container) return;
  const viewport = container.querySelector("[data-radix-scroll-area-viewport]");
  if (viewport) {
    viewport.scrollTop = viewport.scrollHeight;
  } else {
    container.scrollTop = container.scrollHeight;
  }
}

function resolveRegeneratePayload(chat?: Chat, assistantMessageId?: string) {
  if (!chat || !assistantMessageId) return null;
  const msg = chat.messages[assistantMessageId];
  if (msg?.role !== "assistant" || !msg.parentId) return null;
  const parentMsg = chat.messages[msg.parentId];
  if (!parentMsg) return null;
  return {
    parentMsg,
    payload: extractRegeneratePayload(parentMsg),
  };
}

type StreamResponseFn = ReturnType<typeof useStreamResponse>["streamResponse"];

interface UseChatMessageActionsParams {
  chatId: string;
  chat?: Chat;
  streamResponse: StreamResponseFn;
  deleteMessageDb: (chatId: string, id: string) => void;
  setCurrentLeafDb: (chatId: string, leafId: string) => void;
}

function useChatMessageActions({
  chatId,
  chat,
  streamResponse,
  deleteMessageDb,
  setCurrentLeafDb,
}: UseChatMessageActionsParams) {
  const handleSend = useCallback(
    async (
      content: string,
      attachments: Attachment[] = [],
      model = "",
      selectedServerIds: string[] = [],
      selectedTools: string[] = [],
      selectedPromptId?: string | string[],
      selectedAssistantId?: string,
      selectedKbIds: string[] = [],
      selectedSkillIds: string[] = [],
      subagentsEnabled?: boolean,
      subagentModelId?: string,
    ) => {
      await streamResponse(
        crypto.randomUUID(),
        content,
        chat?.currentLeafId || null,
        attachments,
        model,
        selectedServerIds,
        selectedTools,
        selectedPromptId,
        selectedAssistantId,
        selectedKbIds,
        selectedSkillIds,
        subagentsEnabled,
        subagentModelId,
      );
    },
    [chat?.currentLeafId, streamResponse],
  );

  const handleEdit = useCallback(
    async (
      id: string,
      newContent: string,
      attachments: Attachment[],
      model: string,
      serverIds: string[],
      toolIds: string[],
      promptId?: string | string[],
      assistantId?: string,
      selectedKbIds?: string[],
      selectedSkillIds?: string[],
      subagentsEnabled?: boolean,
      subagentModelId?: string,
    ) => {
      const msg = chat?.messages[id];
      if (!msg) return;
      await streamResponse(
        crypto.randomUUID(),
        newContent,
        msg.parentId,
        attachments,
        model,
        serverIds,
        toolIds,
        promptId,
        assistantId,
        selectedKbIds,
        selectedSkillIds,
        subagentsEnabled,
        subagentModelId,
      );
    },
    [chat, streamResponse],
  );

  const handleRegenerate = useCallback(
    async (id: string) => {
      const data = resolveRegeneratePayload(chat, id);
      if (!data) return;
      const { parentMsg, payload } = data;

      await streamResponse(
        crypto.randomUUID(),
        payload.userContent,
        parentMsg.parentId,
        parentMsg.attachments,
        payload.model,
        payload.serverIds,
        payload.toolIds,
        payload.promptIds,
        payload.assistantId,
        payload.selectedKbIds,
        payload.selectedSkillIds,
        payload.subagentsEnabled,
        payload.subagentModelId,
      );
    },
    [chat, streamResponse],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteMessageDb(chatId, id);
    },
    [chatId, deleteMessageDb],
  );

  const handleNavigateBranch = useCallback(
    (siblingId: string) => {
      navigateToSiblingLeaf(chat, chatId, siblingId, setCurrentLeafDb);
    },
    [chatId, chat, setCurrentLeafDb],
  );

  return {
    handleSend,
    handleEdit,
    handleRegenerate,
    handleDelete,
    handleNavigateBranch,
  };
}

function useInitialChatAutoSend(
  chat: Chat | undefined,
  initialMessage: string | undefined,
  onInitialMessageSent: (() => void) | undefined,
  handleSend: (
    content: string,
    attachments?: Attachment[],
    model?: string,
    serverIds?: string[],
    toolIds?: string[],
    promptId?: string | string[],
    assistantId?: string,
    kbIds?: string[],
    skillIds?: string[],
  ) => void,
  initialModelId: string | undefined,
  initialServerIds: string[],
  initialSelectedTools: string[],
  initialKbIds: string[],
) {
  const sentInitial = useRef(false);

  useEffect(() => {
    if (!initialMessage || !chat || sentInitial.current) return;
    sentInitial.current = true;
    onInitialMessageSent?.();
    clearMsgQueryParamFromUrl();

    if (Object.keys(chat.messages).length > 0) return;

    handleSend(
      initialMessage,
      [],
      initialModelId ?? "",
      initialServerIds,
      initialSelectedTools,
      undefined,
      chat.assistantId ?? undefined,
      initialKbIds,
      [],
    );
  }, [
    chat,
    initialMessage,
    handleSend,
    onInitialMessageSent,
    initialModelId,
    initialServerIds,
    initialSelectedTools,
    initialKbIds,
  ]);
}

function extractAssistantId(
  metadata: string | null | undefined,
): string | undefined {
  if (!metadata) return undefined;
  try {
    const raw = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
    return typeof raw?.assistantId === "string" ? raw.assistantId : undefined;
  } catch {
    return undefined;
  }
}

function extractLegacyPromptIds(
  metadata: string | null | undefined,
): string[] | undefined {
  if (!metadata) return undefined;
  try {
    const raw = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
    if (Array.isArray(raw?.promptIds) && raw.promptIds.length > 0) {
      return raw.promptIds;
    }
    if (typeof raw?.promptId === "string") {
      return [raw.promptId];
    }
  } catch {}
  return undefined;
}

function extractPromptInfo(parentMsg: Message) {
  const meta = parseMessageMetadata(parentMsg.metadata);
  const promptMeta = meta.promptMeta;
  const promptIds =
    promptMeta?.promptIds ?? extractLegacyPromptIds(parentMsg.metadata);
  return {
    userContent: promptMeta?.userContent || parentMsg.content,
    promptIds,
    assistantId: extractAssistantId(parentMsg.metadata),
    meta,
  };
}

function extractRegeneratePayload(parentMsg: Message) {
  const { userContent, promptIds, assistantId, meta } =
    extractPromptInfo(parentMsg);

  return {
    userContent,
    model: meta.modelId || "",
    serverIds: meta.selectedServerIds || [],
    toolIds: meta.selectedTools || [],
    promptIds,
    assistantId,
    selectedKbIds: meta.selectedKbIds || [],
    selectedSkillIds: meta.selectedSkillIds || [],
    subagentsEnabled: meta.subagentsEnabled,
    subagentModelId: meta.subagentModelId,
  };
}

function extractActiveStreamingCitations(activeToolCalls: any[]) {
  if (activeToolCalls.length === 0) return [];
  const completedSearchToolResults = activeToolCalls
    .filter(
      (tc) =>
        tc.status === "complete" &&
        tc.toolName === "search_knowledge_base" &&
        tc.result,
    )
    .map((tc) => ({
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      result: tc.result,
    }));

  return extractCitations(completedSearchToolResults);
}

/**
 * Props for the ChatUI component.
 * Controls the chat session display and interaction with optional initial messaging.
 */
function clearMsgQueryParamFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("msg")) return;
  url.searchParams.delete("msg");
  window.history.replaceState({}, "", url.pathname + (url.search || ""));
}

interface ChatUIProps {
  /** Unique identifier for the active chat session. */
  chatId: string;

  /** Pre-fetched chat data from server for immediate rendering before store hydration. */
  initialChat?: Chat;

  /** Optional message to send on component mount. Typically from query parameters. */
  initialMessage?: string;

  /** Callback invoked after the initial message is successfully sent. */
  onInitialMessageSent?: () => void;
}

/**
 * Main chat interface component rendering messages, input, and artifacts.
 * Orchestrates message reconstruction, streaming, artifact management, and
 * branch navigation via extracted sub-components and hooks.
 *
 * @param props - Configuration for the chat session ID and optional auto-messaging.
 * @returns Chat UI with ScrollArea, MessageThread, StreamingSection, ChatInput, and ArtifactPanel.
 * @see MessageThread for message list rendering.
 * @see StreamingSection for live streaming state display.
 * @see AssistantBar for the current assistant header.
 * @see useStreamResponse for AI response streaming.
 * @see useInitialModel for model resolution.
 * @see useInitialTools for tool/server configuration merging.
 * @see ArtifactPanel for artifact display.
 */
function checkShouldShowReopen(
  isArtifactOpen: boolean,
  artifactsLength: number,
): boolean {
  return !isArtifactOpen && artifactsLength > 0;
}

function updateChatKnowledgebase(
  chatId: string,
  kbIds: string[],
  setKnowledgebaseDb: (chatId: string, kbId: string | null) => void,
): void {
  setKnowledgebaseDb(chatId, kbIds[0] ?? null);
}

function checkCanMentionAssistant(
  threadLength: number,
  assistantId?: string | null,
): boolean {
  return threadLength === 0 && !assistantId;
}

function filterEnabledMcpServers<T extends { enabled: boolean }>(
  servers: T[],
): T[] {
  return servers.filter((s) => s.enabled);
}

function useChatInitialSelections(
  thread: Message[],
  currentProject: Project | undefined,
  currentAssistant: Assistant | undefined,
  userSettings: UserSettingsRow | null,
  chat: Chat | undefined,
) {
  return useMemo(
    () =>
      resolveInitialChatConfig(
        thread,
        currentProject,
        currentAssistant,
        userSettings,
        chat,
      ),
    [thread, currentProject, currentAssistant, userSettings, chat],
  );
}

function resolveThread(
  messages: Record<string, Message> | undefined,
  currentLeafId: string | null | undefined,
): Message[] {
  if (!messages || !currentLeafId) return [];
  return reconstructThread(messages, currentLeafId);
}

function navigateToSiblingLeaf(
  chat: Chat | undefined,
  chatId: string,
  siblingId: string,
  setCurrentLeafDb: (chatId: string, leafId: string) => void,
): void {
  if (!chat) return;
  setCurrentLeafDb(chatId, getDeepestLeaf(chat.messages, siblingId));
}

function useEnsureMcpServersLoaded(
  mcpServers: { length: number },
  loadMcpServers: () => Promise<unknown>,
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: Load MCP servers once on mount
  useEffect(() => {
    if (mcpServers.length === 0) {
      loadMcpServers().catch(() => {});
    }
  }, []);
}

function useChatScrollToBottom() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    scrollElementToBottom(scrollRef.current);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  return scrollRef;
}

function useChatStore(chatId: string) {
  const storeChat = useAppStore((state) => state.chats[chatId]);
  const deleteMessageDb = useAppStore((state) => state.deleteMessageDb);
  const setCurrentLeafDb = useAppStore((state) => state.setCurrentLeafDb);
  const setKnowledgebaseDb = useAppStore((state) => state.setKnowledgebaseDb);
  const mcpServers = useAppStore((state) => state.mcpServers);
  const loadMcpServers = useAppStore((state) => state.loadMcpServers);
  const assistants = useAppStore((state) => state.assistants);
  const userSettings = useAppStore((state) => state.userSettings);
  const projects = useAppStore((state) => state.projects);
  const updateMessageMetadataDb = useAppStore(
    (state) => state.updateMessageMetadataDb,
  );
  return {
    storeChat,
    deleteMessageDb,
    setCurrentLeafDb,
    setKnowledgebaseDb,
    mcpServers,
    loadMcpServers,
    assistants,
    userSettings,
    projects,
    updateMessageMetadataDb,
  };
}

export function ChatUI({
  chatId,
  initialChat,
  initialMessage,
  onInitialMessageSent,
}: ChatUIProps) {
  const {
    storeChat,
    deleteMessageDb,
    setCurrentLeafDb,
    setKnowledgebaseDb,
    mcpServers,
    loadMcpServers,
    assistants,
    userSettings,
    projects,
    updateMessageMetadataDb,
  } = useChatStore(chatId);
  const chat = resolveActiveChat(storeChat, initialChat, chatId);

  // Hydrate essential resources
  useResourceHydration([
    "mcpServers",
    "publicMcpServers",
    "assistants",
    "projects",
    "prompts",
    "skills",
    "mcpPrompts",
    "userSettings",
  ]);

  const currentAssistant = findAssistant(assistants, chat?.assistantId);
  const currentProject = findProject(projects, chat?.projectId);

  const thread = useMemo(
    () => resolveThread(chat?.messages, chat?.currentLeafId),
    [chat?.currentLeafId, chat?.messages],
  );

  const {
    initialModelId,
    initialSubagentsEnabled,
    initialSubagentModelId,
    initialServerIds,
    initialSelectedTools,
    initialKbIds,
    initialSkillIds,
  } = useChatInitialSelections(
    thread,
    currentProject,
    currentAssistant,
    userSettings,
    chat,
  );

  const allEnabledServers = useMemo(
    () => filterEnabledMcpServers(mcpServers),
    [mcpServers],
  );

  // Streaming state
  const {
    isLoading,
    streamingContent,
    streamingReasoning,
    isStreamingReasoning,
    activeToolCalls,
    assistantMessageId,
    streamResponse,
    stopStream,
  } = useStreamResponse(chatId);

  const streamingCitations = useMemo(
    () => extractActiveStreamingCitations(activeToolCalls),
    [activeToolCalls],
  );

  const {
    artifactIndex,
    setArtifactIndex,
    isArtifactOpen,
    setIsArtifactOpen,
    allArtifacts,
    activeArtifact,
    handleToggleArtifact,
    handleUpdateArtifact,
    handleReopen,
  } = useChatArtifactPanel(
    chatId,
    chat,
    thread,
    activeToolCalls,
    streamingContent,
    updateMessageMetadataDb,
  );

  const handleKbChange = useCallback(
    (kbIds: string[]) => {
      updateChatKnowledgebase(chatId, kbIds, setKnowledgebaseDb);
    },
    [chatId, setKnowledgebaseDb],
  );

  const {
    handleSend,
    handleEdit,
    handleRegenerate,
    handleDelete,
    handleNavigateBranch,
  } = useChatMessageActions({
    chatId,
    chat,
    streamResponse,
    deleteMessageDb,
    setCurrentLeafDb,
  });

  const scrollRef = useChatScrollToBottom();
  useEnsureMcpServersLoaded(mcpServers, loadMcpServers);

  useInitialChatAutoSend(
    chat,
    initialMessage,
    onInitialMessageSent,
    handleSend,
    initialModelId,
    initialServerIds,
    initialSelectedTools,
    initialKbIds,
  );

  if (!chat) {
    return (
      <div className="flex h-full items-center justify-center">
        Chat not found.
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      <div className="relative flex h-full min-w-0 flex-1 flex-col">
        <AssistantBar assistantName={currentAssistant?.name} />

        <ScrollArea className="min-h-0 flex-1" ref={scrollRef}>
          <div className="px-4 py-6 md:px-8">
            <div className="mx-auto max-w-4xl space-y-6 pb-12">
              <MessageThread
                thread={thread}
                chat={chat}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onRegenerate={handleRegenerate}
                onNavigateBranch={handleNavigateBranch}
                onToggleArtifact={handleToggleArtifact}
                activeArtifactId={activeArtifact?.id}
                isCanvasOpen={isArtifactOpen}
              />

              <StreamingSection
                isLoading={isLoading}
                streamingContent={streamingContent}
                streamingReasoning={streamingReasoning}
                isStreamingReasoning={isStreamingReasoning}
                activeToolCalls={activeToolCalls}
                streamingCitations={streamingCitations}
                onToggleArtifact={handleToggleArtifact}
                activeArtifactId={activeArtifact?.id}
                isCanvasOpen={isArtifactOpen}
                chatId={chatId}
                assistantMessageId={assistantMessageId}
              />
            </div>
          </div>
        </ScrollArea>

        <div className="bg-background/80 shrink-0 px-4 pb-2 backdrop-blur-sm md:px-8 md:pb-4">
          <div className="mx-auto max-w-4xl">
            <ChatInput
              key={chatId}
              onSend={handleSend}
              isLoading={isLoading}
              onStop={stopStream}
              servers={allEnabledServers}
              activeChatAssistantId={chat?.assistantId}
              canMentionAssistant={checkCanMentionAssistant(
                thread.length,
                chat?.assistantId,
              )}
              initialSelectedServerIds={initialServerIds}
              initialSelectedTools={initialSelectedTools}
              initialSelectedKbs={initialKbIds}
              initialSelectedSkillIds={initialSkillIds}
              initialModelId={initialModelId}
              initialSubagentsEnabled={initialSubagentsEnabled}
              initialSubagentModelId={initialSubagentModelId}
              onKnowledgebaseChange={handleKbChange}
              thread={thread}
            />
          </div>
        </div>
      </div>

      {checkShouldShowReopen(isArtifactOpen, allArtifacts.length) && (
        <CanvasReopenButton onReopen={handleReopen} />
      )}

      <ArtifactPanel
        isOpen={isArtifactOpen}
        artifact={activeArtifact}
        onClose={() => setIsArtifactOpen(false)}
        artifacts={allArtifacts}
        currentIndex={artifactIndex}
        onNavigate={(idx) => setArtifactIndex(idx)}
        onUpdate={handleUpdateArtifact}
      />
    </div>
  );
}
