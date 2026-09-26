"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import type { Attachment } from "@/types/attachment/attachment";
import type { Chat } from "@/types/chat/chat";
import type { Message } from "@/types/message/message";
import { ArtifactPanel } from "./artifact-panel";
import { AssistantBar } from "./assistant-bar";
import { ChatInput } from "./chat-input";
import { MessageThread } from "./message-thread";
import { StreamingSection } from "./streaming-section";

/**
 * Props for the ChatUI component.
 * Controls the chat session display and interaction with optional initial messaging.
 */
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

  // -- Initial Model Resolution (Inlined) --
  const initialModelId = useMemo(() => {
    // 1. Existing chat: get model from the last user message
    const lastUserMessage = [...thread]
      .reverse()
      .find((m) => m.role === "user");
    if (lastUserMessage?.metadata) {
      const { modelId } = parseMessageMetadata(lastUserMessage.metadata);
      if (modelId) return modelId;
    }

    // 2. New chat: prioritize Project > Assistant > User Settings
    if ((currentProject as any)?.defaultChatModelId) {
      return (currentProject as any).defaultChatModelId;
    }
    if ((currentAssistant as any)?.defaultChatModelId) {
      return (currentAssistant as any).defaultChatModelId;
    }

    // 3. Application-wide default
    return userSettings?.defaultChatModelId || undefined;
  }, [thread, currentProject, currentAssistant, userSettings]);

  // -- Initial Tools Resolution (Inlined) --
  const { initialServerIds, initialSelectedTools } = useMemo(() => {
    const projectTools = currentProject?.tools;
    const assistantTools = currentAssistant?.tools;

    const combined = new Set<string>();
    if (projectTools) {
      projectTools.forEach((t) => {
        combined.add(t);
      });
    }
    if (assistantTools) {
      assistantTools.forEach((t) => {
        combined.add(t);
      });
    }
    const combinedArray = Array.from(combined);

    const serverIds = new Set<string>();
    combinedArray.forEach((t) => {
      const serverId = t.split(":")[0];
      if (serverId) serverIds.add(serverId);
    });

    const selectedTools = combinedArray.filter((t) => t.includes(":tool:"));

    return {
      initialServerIds: Array.from(serverIds),
      initialSelectedTools: selectedTools,
    };
  }, [currentProject?.tools, currentAssistant?.tools]);

  const initialKbIds = useMemo(() => {
    const kbId = chat?.knowledgebaseId ?? currentProject?.knowledgebaseId;
    return kbId ? [kbId] : [];
  }, [chat?.knowledgebaseId, currentProject?.knowledgebaseId]);

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
    streamResponse,
    stopStream,
  } = useStreamResponse(chatId);

  const streamingCitations = useMemo(() => {
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
  }, [activeToolCalls]);

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

  const allArtifacts = useMemo(() => {
    const artifacts: ArtifactData[] = [];
    const seenIds = new Set<string>();

    for (const msg of thread) {
      const msgArtifacts = extractMessageArtifacts(msg);
      for (const art of msgArtifacts) {
        const id = art.id || `${msg.id}-art-${artifacts.length}`;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          artifacts.push({ ...art, id });
        }
      }
    }

    if (activeToolCalls && activeToolCalls.length > 0) {
      const streamingMsg: Message = {
        id: "streaming",
        role: "assistant",
        content: streamingContent ?? "",
        createdAt: new Date(),
        parentId: null,
        childrenIds: [],
        metadata: null,
      };
      const streamingArtifacts = extractMessageArtifacts(
        streamingMsg,
        activeToolCalls,
      );
      for (const art of streamingArtifacts) {
        const id = art.id || `streaming-art-${artifacts.length}`;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          artifacts.push({ ...art, id });
        }
      }
    }

    return artifacts;
  }, [thread, activeToolCalls, streamingContent]);

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
      const isLatest =
        allArtifacts.length <= 1 || artifactIndex === allArtifacts.length - 1;
      if (!isLatest) return;

      if (!activeArtifact?.messageId) return;

      const msg = chat?.messages[activeArtifact.messageId];
      if (!msg?.metadata) return;

      try {
        const meta = JSON.parse(msg.metadata);
        let updated = false;

        if (Array.isArray(meta.toolResults)) {
          meta.toolResults.forEach((tr: any) => {
            if (tr.toolName === "manage_artifact") {
              const raw = tr.result ?? tr.output;
              const isString = typeof raw === "string";
              let parsed = raw;
              if (isString) {
                try {
                  parsed = JSON.parse(raw);
                } catch {
                  parsed = null;
                }
              }
              if (parsed && typeof parsed === "object") {
                const target = parsed.artifact ?? parsed;
                if (target?.id === activeArtifact.id) {
                  target.content = newContent;
                  if (isString) {
                    tr.result = JSON.stringify(parsed);
                  } else if (tr.result !== undefined) {
                    tr.result = parsed;
                  } else {
                    tr.output = parsed;
                  }
                  updated = true;
                }
              }
            }
          });
        }

        if (updated) {
          updateMessageMetadataDb(chatId, msg.id, JSON.stringify(meta));
        }
      } catch (e) {
        logger.error("Failed to update artifact metadata", e);
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
      selectedPromptId?: string,
      selectedAssistantId?: string,
      selectedKbIds: string[] = [],
      selectedSkillIds: string[] = [],
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

      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (url.searchParams.has("msg")) {
          url.searchParams.delete("msg");
          window.history.replaceState(
            {},
            "",
            url.pathname + (url.search ? url.search : ""),
          );
        }
      }

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
    promptId?: string,
    assistantId?: string,
    selectedKbIds?: string[],
    selectedSkillIds?: string[],
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
    );
  };

  const handleRegenerate = async (id: string) => {
    const msg = chat?.messages[id];
    if (msg?.role !== "assistant" || !msg.parentId) return;

    const parentMsg = chat?.messages[msg.parentId];
    if (!parentMsg) return;

    let promptId: string | undefined;
    let assistantId: string | undefined;
    let model: string = "";
    let serverIds: string[] = [];
    let toolIds: string[] = [];
    let selectedKbIds: string[] = [];
    let selectedSkillIds: string[] = [];
    let userContent = parentMsg.content;

    if (parentMsg.metadata) {
      try {
        const meta = JSON.parse(parentMsg.metadata);
        if (meta.promptId) {
          promptId = meta.promptId;
          userContent = meta.userContent || parentMsg.content;
        }
        if (meta.assistantId) {
          assistantId = meta.assistantId;
        }
        if (meta.model) {
          model = meta.model;
        }
        if (Array.isArray(meta.selectedServerIds)) {
          serverIds = meta.selectedServerIds;
        }
        if (Array.isArray(meta.selectedTools)) {
          toolIds = meta.selectedTools;
        }
        if (Array.isArray(meta.selectedKbIds)) {
          selectedKbIds = meta.selectedKbIds;
        }
        if (Array.isArray(meta.selectedSkillIds)) {
          selectedSkillIds = meta.selectedSkillIds;
        }
      } catch {}
    }

    await streamResponse(
      crypto.randomUUID(),
      userContent,
      parentMsg.parentId,
      parentMsg.attachments,
      model,
      serverIds,
      toolIds,
      promptId,
      assistantId,
      selectedKbIds,
      selectedSkillIds,
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
    <div className="flex h-full w-full overflow-hidden">
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
              initialModelId={initialModelId}
              onKnowledgebaseChange={handleKbChange}
              thread={thread}
            />
          </div>
        </div>
      </div>

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
