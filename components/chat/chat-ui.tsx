"use client";

import { PanelRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DEFAULT_ENABLED_TOOLS } from "@/config/tools";
import { useStreamResponse } from "@/hooks/chat/use-stream-response";
import { useResourceHydration } from "@/hooks/use-resource-hydration";
import { extractCitations } from "@/lib/chat/extract-citations";
import { extractMessageArtifacts } from "@/lib/chat/extract-message-artifacts";
import { getDeepestLeaf } from "@/lib/chat/get-deepest-leaf";
import { parseMessageMetadata } from "@/lib/chat/parse-message-metadata";
import { reconstructThread } from "@/lib/chat/reconstruct-thread";
import { logger } from "@/lib/logger";
import { useAppStore } from "@/lib/store";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { Assistant } from "@/types/assistant/assistant";
import type { Attachment } from "@/types/attachment/attachment";
import type { Chat } from "@/types/chat/chat";
import type { Message } from "@/types/message/message";
import type { Project } from "@/types/project/project";
import type { UserSettingsRow } from "@/types/user/user-settings-row";
import { ArtifactPanel } from "./artifact-panel";
import { AssistantBar } from "./assistant-bar";
import { ChatInput } from "./chat-input";
import { MessageThread } from "./message-thread";
import { StreamingSection } from "./streaming-section";

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

function parseArtifactResultPayload(raw: unknown): {
  parsed: any;
  isString: boolean;
} {
  if (typeof raw === "string") {
    try {
      return { parsed: JSON.parse(raw), isString: true };
    } catch {
      return { parsed: null, isString: true };
    }
  }
  return { parsed: raw, isString: false };
}

function applyArtifactContent(tr: any, parsed: any, isString: boolean): void {
  if (isString) {
    tr.result = JSON.stringify(parsed);
  } else if (tr.result !== undefined) {
    tr.result = parsed;
  } else {
    tr.output = parsed;
  }
}

function updateToolResultArtifact(
  tr: any,
  artifactId: string,
  newContent: string,
): boolean {
  if (tr?.toolName !== "manage_artifact") return false;

  const raw = tr.result ?? tr.output;
  const { parsed, isString } = parseArtifactResultPayload(raw);
  if (!parsed || typeof parsed !== "object") return false;

  const target = parsed.artifact || parsed;
  if (!target || target.id !== artifactId) return false;

  target.content = newContent;
  applyArtifactContent(tr, parsed, isString);
  return true;
}

function mutateArtifactContentInMetadata(
  rawMetadata: string,
  artifactId: string,
  newContent: string,
): string | null {
  try {
    const meta = JSON.parse(rawMetadata);
    if (!meta || !Array.isArray(meta.toolResults)) return null;

    let updated = false;
    for (const tr of meta.toolResults) {
      if (updateToolResultArtifact(tr, artifactId, newContent)) {
        updated = true;
      }
    }
    return updated ? JSON.stringify(meta) : null;
  } catch (e) {
    logger.error("Failed to update artifact metadata", e);
    return null;
  }
}

function checkCanUpdateArtifact(
  allArtifactsLength: number,
  artifactIndex: number,
  activeArtifact: ArtifactData | null,
): activeArtifact is ArtifactData & { messageId: string; id: string } {
  if (allArtifactsLength > 1 && artifactIndex !== allArtifactsLength - 1) {
    return false;
  }
  return Boolean(activeArtifact?.messageId && activeArtifact?.id);
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
    subagentExcludedTools: meta.subagentExcludedTools,
  };
}

function collectMessageArtifacts(thread: Message[]): {
  artifacts: ArtifactData[];
  seenIds: Set<string>;
} {
  const artifacts: ArtifactData[] = [];
  const seenIds = new Set<string>();

  for (const msg of thread) {
    for (const art of extractMessageArtifacts(msg)) {
      const id = art.id || `${msg.id}-art-${artifacts.length}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        artifacts.push({ ...art, id });
      }
    }
  }
  return { artifacts, seenIds };
}

function collectStreamingArtifacts(
  activeToolCalls: any[] | undefined,
  streamingContent: string | null,
  artifacts: ArtifactData[],
  seenIds: Set<string>,
) {
  if (!activeToolCalls || activeToolCalls.length === 0) return;

  const streamingMsg: Message = {
    id: "streaming",
    role: "assistant",
    content: streamingContent ?? "",
    createdAt: new Date(),
    parentId: null,
    childrenIds: [],
    metadata: null,
  };
  for (const art of extractMessageArtifacts(streamingMsg, activeToolCalls)) {
    const id = art.id || `streaming-art-${artifacts.length}`;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      artifacts.push({ ...art, id });
    }
  }
}

function extractThreadArtifacts(
  thread: Message[],
  activeToolCalls: any[],
  streamingContent: string | null,
): ArtifactData[] {
  const { artifacts, seenIds } = collectMessageArtifacts(thread);
  collectStreamingArtifacts(
    activeToolCalls,
    streamingContent,
    artifacts,
    seenIds,
  );
  return artifacts;
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
export function ChatUI({
  chatId,
  initialChat,
  initialMessage,
  onInitialMessageSent,
}: ChatUIProps) {
  const storeChat = useAppStore((state) => state.chats[chatId]);
  const chat =
    storeChat && Object.keys(storeChat.messages).length > 0
      ? storeChat
      : initialChat?.id === chatId
        ? initialChat
        : storeChat;
  const deleteMessageDb = useAppStore((state) => state.deleteMessageDb);
  const setCurrentLeafDb = useAppStore((state) => state.setCurrentLeafDb);
  const setKnowledgebaseDb = useAppStore((state) => state.setKnowledgebaseDb);
  const mcpServers = useAppStore((state) => state.mcpServers);
  const loadMcpServers = useAppStore((state) => state.loadMcpServers);
  const assistants = useAppStore((state) => state.assistants);
  const userSettings = useAppStore((state) => state.userSettings);

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

  const currentAssistant = chat?.assistantId
    ? assistants.find((a) => a.id === chat.assistantId)
    : undefined;
  const projects = useAppStore((state) => state.projects);
  const currentProject = chat?.projectId
    ? projects.find((p) => p.id === chat.projectId)
    : undefined;

  const thread = useMemo(
    () =>
      chat?.currentLeafId
        ? reconstructThread(chat.messages, chat.currentLeafId)
        : [],
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
  } = useMemo(
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

  const allEnabledServers = useMemo(() => {
    return mcpServers.filter((s) => s.enabled);
  }, [mcpServers]);

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

  // -- Artifact Panel Logic (Inlined) --
  const updateMessageMetadataDb = useAppStore(
    (state) => state.updateMessageMetadataDb,
  );

  const [artifactIndex, setArtifactIndex] = useState<number>(-1);
  const [isArtifactOpen, setIsArtifactOpen] = useState(false);
  const [prevArtifactsLength, setPrevArtifactsLength] = useState(0);
  const [prevChatId, setPrevChatId] = useState(chatId);

  // Reset artifact states on chat switch
  if (chatId !== prevChatId) {
    setPrevChatId(chatId);
    setPrevArtifactsLength(0);
    setArtifactIndex(-1);
    setIsArtifactOpen(false);
  }

  const allArtifacts = useMemo(
    () => extractThreadArtifacts(thread, activeToolCalls, streamingContent),
    [thread, activeToolCalls, streamingContent],
  );

  const activeArtifact =
    artifactIndex >= 0 && artifactIndex < allArtifacts.length
      ? allArtifacts[artifactIndex]
      : null;

  // Auto-open when artifacts appear / increase and clamp active index
  if (allArtifacts.length !== prevArtifactsLength) {
    const isIncrease = allArtifacts.length > prevArtifactsLength;
    setPrevArtifactsLength(allArtifacts.length);

    if (isIncrease) {
      setArtifactIndex(allArtifacts.length - 1);
      setIsArtifactOpen(true);
    } else if (allArtifacts.length === 0) {
      setArtifactIndex(-1);
      setIsArtifactOpen(false);
    } else if (artifactIndex >= allArtifacts.length) {
      setArtifactIndex(allArtifacts.length - 1);
    }
  }

  const handleToggleArtifact = useCallback(
    (artifact: ArtifactData) => {
      // Find index of targeted artifact in allArtifacts
      const targetIdx = allArtifacts.findIndex(
        (a) =>
          a.id === artifact.id ||
          (a.messageId === artifact.messageId && a.title === artifact.title),
      );

      if (isArtifactOpen && artifactIndex === targetIdx) {
        // Already showing this artifact -> toggle closed
        setIsArtifactOpen(false);
      } else if (targetIdx >= 0) {
        // Switch to this artifact and open panel
        setArtifactIndex(targetIdx);
        setIsArtifactOpen(true);
      } else {
        // Fallback (e.g. streaming artifact not yet in thread)
        setIsArtifactOpen(true);
      }
    },
    [allArtifacts, isArtifactOpen, artifactIndex],
  );

  const handleUpdateArtifact = useCallback(
    (newContent: string) => {
      if (
        !checkCanUpdateArtifact(
          allArtifacts.length,
          artifactIndex,
          activeArtifact,
        )
      ) {
        return;
      }

      const msg = chat?.messages[activeArtifact.messageId];
      if (!msg?.metadata) return;

      const updatedMeta = mutateArtifactContentInMetadata(
        msg.metadata,
        activeArtifact.id,
        newContent,
      );
      if (updatedMeta) {
        updateMessageMetadataDb(chatId, msg.id, updatedMeta);
      }
    },
    [
      activeArtifact,
      allArtifacts.length,
      artifactIndex,
      chat,
      chatId,
      updateMessageMetadataDb,
    ],
  );

  const handleKbChange = useCallback(
    (kbIds: string[]) => {
      const kbId = kbIds[0] ?? null;
      setKnowledgebaseDb(chatId, kbId);
    },
    [chatId, setKnowledgebaseDb],
  );

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
      subagentExcludedTools?: string[],
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
        subagentExcludedTools,
      );
    },
    [chat?.currentLeafId, streamResponse],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Load MCP servers once on mount
  useEffect(() => {
    if (mcpServers.length === 0) {
      loadMcpServers().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (initialMessage && chat && !sentInitial.current) {
      sentInitial.current = true;
      onInitialMessageSent?.();

      clearMsgQueryParamFromUrl();

      if (Object.keys(chat.messages).length > 0) {
        return;
      }

      handleSend(
        initialMessage,
        [],
        initialModelId || "",
        initialServerIds,
        initialSelectedTools,
        undefined,
        chat.assistantId || undefined,
        initialKbIds,
        [],
      );
    }
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

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      } else {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  const handleDelete = (id: string) => {
    deleteMessageDb(chatId, id);
  };

  const handleEdit = async (
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
    subagentExcludedTools?: string[],
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
      subagentExcludedTools,
    );
  };

  const handleRegenerate = async (id: string) => {
    const msg = chat?.messages[id];
    if (msg?.role !== "assistant" || !msg.parentId) return;

    const parentMsg = chat?.messages[msg.parentId];
    if (!parentMsg) return;

    const payload = extractRegeneratePayload(parentMsg);

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
      payload.subagentExcludedTools,
    );
  };

  const handleNavigateBranch = useCallback(
    (siblingId: string) => {
      if (!chat) return;
      setCurrentLeafDb(chatId, getDeepestLeaf(chat.messages, siblingId));
    },
    [chatId, chat, setCurrentLeafDb],
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

        <div className="shrink-0 bg-background/80 px-4 pb-2 backdrop-blur-sm md:px-8 md:pb-4">
          <div className="mx-auto max-w-4xl">
            <ChatInput
              key={chatId}
              onSend={handleSend}
              isLoading={isLoading}
              onStop={stopStream}
              servers={allEnabledServers}
              activeChatAssistantId={chat?.assistantId}
              canMentionAssistant={thread.length === 0 && !chat?.assistantId}
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

      {!isArtifactOpen && allArtifacts.length > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="absolute top-3 right-3 z-30 size-7 cursor-pointer rounded-md bg-background/80 shadow-xs backdrop-blur-xs transition-colors hover:bg-accent"
                onClick={() => {
                  if (artifactIndex < 0 && allArtifacts.length > 0) {
                    setArtifactIndex(allArtifacts.length - 1);
                  }
                  setIsArtifactOpen(true);
                }}
                aria-label="Open canvas"
              >
                <PanelRight className="size-4 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Open canvas</TooltipContent>
          </Tooltip>
        </TooltipProvider>
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
