"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useStreamResponse } from "@/hooks/chat/use-stream-response";
import { getDeepestLeaf } from "@/lib/chat/get-deepest-leaf";
import { reconstructThread } from "@/lib/chat/reconstruct-thread";
import { useAppStore } from "@/lib/store";
import type { Attachment } from "@/types/attachment/attachment";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { ArtifactPanel } from "./artifact-panel";
import { ChatInput } from "./chat-input";
import { MessageBubble } from "./message-bubble";
import { useArtifactPanel } from "@/hooks/chat/use-artifact-panel";
import { useResourceHydration } from "@/hooks/use-resource-hydration";
import {
  parseMessageMetadata,
  extractCitations,
} from "@/lib/store/mappers/message-mapper";

import { Bot } from "lucide-react";
import { StreamingPlaceholder } from "./message/streaming-placeholder";

/**
 * Props for the ChatUI component.
 * Controls the chat session display and interaction with optional initial messaging.
 */
interface ChatUIProps {
  /** Unique identifier for the active chat session. */
  chatId: string;

  /** Optional message to send on component mount. Typically from query parameters. */
  initialMessage?: string;

  /** Callback invoked after the initial message is successfully sent. */
  onInitialMessageSent?: () => void;
}

/**
 * Main chat interface component rendering messages, input, and artifacts.
 * Handles message reconstruction from the branching tree, artifact collection,
 * streaming response integration, and branch navigation via sibling arrows.
 * Automatically detects and displays artifacts (Mermaid, Markdown, HTML, Spreadsheet)
 * from manage_artifact tool calls or mermaid code blocks.
 *
 * @param props - Configuration for the chat session ID and optional auto-messaging.
 * @returns Chat UI with ScrollArea, MessageBubbles, ChatInput, and ArtifactPanel.
 * @see MessageBubble for individual message rendering.
 * @see useStreamResponse for handling AI responses.
 * @see ArtifactPanel for artifact display.
 * @author Maruf Bepary
 */
export function ChatUI({
  chatId,
  initialMessage,
  onInitialMessageSent,
}: ChatUIProps) {
  const chat = useAppStore((state) => state.chats[chatId]);
  const deleteMessageDb = useAppStore((state) => state.deleteMessageDb);
  const setCurrentLeafDb = useAppStore((state) => state.setCurrentLeafDb);
  const setKnowledgebase = useAppStore((state) => state.setKnowledgebase);
  const mcpServers = useAppStore((state) => state.mcpServers);
  const publicMcpServers = useAppStore((state) => state.publicMcpServers);
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

  const thread = useMemo(() => {
    return chat?.currentLeafId
      ? reconstructThread(chat.messages, chat.currentLeafId)
      : [];
  }, [chat?.currentLeafId, chat?.messages]);

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
    // Note: Project and Assistant models currently follow a future schema expansion
    // but the logic is here for consistency with the plan.
    if ((currentProject as any)?.defaultChatModelId) {
      return (currentProject as any).defaultChatModelId;
    }
    if ((currentAssistant as any)?.defaultChatModelId) {
      return (currentAssistant as any).defaultChatModelId;
    }

    // 3. Application-wide default
    return userSettings?.defaultChatModelId || undefined;
  }, [thread, currentProject, currentAssistant, userSettings]);

  const initialToolsAndResources = useMemo(() => {
    const combined = new Set<string>();
    if (currentProject?.tools) {
      currentProject.tools.forEach((t) => combined.add(t));
    }
    if (currentAssistant?.tools) {
      currentAssistant.tools.forEach((t) => combined.add(t));
    }
    return Array.from(combined);
  }, [currentProject?.tools, currentAssistant?.tools]);

  const initialServerIds = useMemo(() => {
    const serverIds = new Set<string>();
    initialToolsAndResources.forEach((t) => {
      const serverId = t.split(":")[0];
      if (serverId) serverIds.add(serverId);
    });
    return Array.from(serverIds);
  }, [initialToolsAndResources]);

  const initialSelectedTools = useMemo(() => {
    return initialToolsAndResources.filter((t) => t.includes(":tool:"));
  }, [initialToolsAndResources]);

  const initialKbIds = useMemo(() => {
    return chat?.knowledgebaseId ? [chat.knowledgebaseId] : [];
  }, [chat?.knowledgebaseId]);

  const allEnabledServers = useMemo(() => {
    const personalEnabled = mcpServers.filter((s) => s.enabled);
    const publicEnabled = publicMcpServers.filter((s) => s.enabled);
    return [...personalEnabled, ...publicEnabled];
  }, [mcpServers, publicMcpServers]);

  const {
    allArtifacts,
    activeArtifact,
    artifactIndex,
    setArtifactIndex,
    isArtifactOpen,
    setIsArtifactOpen,
    handleShowArtifact,
    handleUpdateArtifact,
  } = useArtifactPanel(chatId, thread);

  const handleKbChange = useCallback(
    (kbIds: string[]) => {
      const kbId = kbIds[0] ?? null;
      setKnowledgebase(chatId, kbId);
    },
    [chatId, setKnowledgebase],
  );

  // Extract all artifacts from the thread
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

    // Map ActiveToolCalls to ToolResult-like objects for extractCitations
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
      );
    },
    [chat?.currentLeafId, streamResponse],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);

  useEffect(() => {
    if (mcpServers.length === 0) {
      loadMcpServers().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialMessage && chat && !sentInitial.current) {
      sentInitial.current = true;
      onInitialMessageSent?.();
      handleSend(
        initialMessage,
        [],
        "",
        initialServerIds,
        initialSelectedTools,
        undefined,
        chat.assistantId || undefined,
        initialKbIds,
      );
    }
  }, [
    chat,
    initialMessage,
    handleSend,
    onInitialMessageSent,
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
  }, [
    chat?.currentLeafId,
    streamingContent,
    activeToolCalls.length,
    scrollToBottom,
  ]);

  if (!chat)
    return (
      <div className="flex h-full items-center justify-center">
        Chat not found.
      </div>
    );

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
  ) => {
    const msg = chat.messages[id];
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
    );
  };

  const handleRegenerate = async (id: string) => {
    const msg = chat.messages[id];
    if (!msg || msg.role !== "assistant" || !msg.parentId) return;

    const parentMsg = chat.messages[msg.parentId];
    if (!parentMsg) return;

    let promptId: string | undefined;
    let assistantId: string | undefined;
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
      } catch {}
    }

    await streamResponse(
      crypto.randomUUID(),
      userContent,
      parentMsg.parentId,
      parentMsg.attachments,
      "",
      [],
      [],
      promptId,
      assistantId,
    );
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        {currentAssistant && (
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30 text-sm text-muted-foreground">
            <Bot className="h-4 w-4" />
            <span>
              Chatting with <strong>{currentAssistant.name}</strong>
            </span>
          </div>
        )}
        <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
          <div className="px-4 md:px-8 py-6">
            <div className="max-w-4xl mx-auto space-y-6 pb-12">
              {thread.length === 0 ? (
                <div className="h-[50vh] flex flex-col items-center justify-center text-center opacity-50">
                  <h2 className="text-2xl font-bold mb-2">
                    How can I help you today?
                  </h2>
                  <p>
                    Try asking for a diagram, math formula, or standard text.
                  </p>
                </div>
              ) : (
                thread.map((msg, index) => {
                  const parent = msg.parentId
                    ? chat.messages[msg.parentId]
                    : null;
                  const siblingsIds = parent
                    ? parent.childrenIds
                    : Object.values(chat.messages)
                        .filter((m) => !m.parentId)
                        .map((m) => m.id);
                  const siblings = siblingsIds
                    .map((id) => chat.messages[id])
                    .filter(Boolean);
                  const currentIndex = siblings.findIndex(
                    (s) => s.id === msg.id,
                  );

                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isLatest={index === thread.length - 1}
                      isFirst={index === 0}
                      assistantId={chat?.assistantId}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                      onRegenerate={handleRegenerate}
                      siblings={siblings}
                      currentSiblingIndex={currentIndex}
                      onNavigateBranch={(siblingId) => {
                        setCurrentLeafDb(
                          chatId,
                          getDeepestLeaf(chat.messages, siblingId),
                        );
                      }}
                      reasoning={msg.reasoning}
                      isStreamingReasoning={false}
                      onShowArtifact={() => handleShowArtifact(msg.id)}
                    />
                  );
                })
              )}
              {(isLoading ||
                streamingContent !== null ||
                activeToolCalls.length > 0 ||
                streamingReasoning !== null) && (
                <>
                  {isLoading &&
                    streamingContent === null &&
                    streamingReasoning === null &&
                    activeToolCalls.length === 0 && <StreamingPlaceholder />}
                  {activeToolCalls.length > 0 && (
                    <div className="text-muted-foreground text-sm space-y-1 ml-2">
                      {activeToolCalls.map((tc) => (
                        <div key={tc.toolCallId}>
                          {tc.status === "calling"
                            ? `🔧 Calling ${tc.toolName}…`
                            : `✅ ${tc.toolName} complete`}
                        </div>
                      ))}
                    </div>
                  )}
                  {(streamingContent !== null ||
                    streamingReasoning !== null ||
                    streamingCitations.length > 0) && (
                    <MessageBubble
                      message={{
                        id: "streaming",
                        role: "assistant",
                        content: streamingContent ?? "",
                        createdAt: new Date(),
                        parentId: null,
                        childrenIds: [],
                        metadata: null,
                      }}
                      isLatest={true}
                      onDelete={() => {}}
                      onEdit={() => {}}
                      siblings={[]}
                      currentSiblingIndex={0}
                      onNavigateBranch={() => {}}
                      reasoning={streamingReasoning ?? undefined}
                      isStreamingReasoning={isStreamingReasoning}
                      streamingCitations={streamingCitations}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="px-4 md:px-8 pb-2 md:pb-4 shrink-0 bg-background/80 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto">
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
