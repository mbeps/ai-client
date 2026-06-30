"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useStreamResponse } from "@/hooks/chat/use-stream-response";
import { getDeepestLeaf } from "@/lib/chat/get-deepest-leaf";
import { reconstructThread } from "@/lib/chat/reconstruct-thread";
import { useAppStore } from "@/lib/store";
import { extractCitations } from "@/lib/store/mappers/message-mapper";
import type { Attachment } from "@/types/attachment/attachment";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { ArtifactPanel } from "./artifact-panel";
import { ChatInput } from "./chat-input";
import { AssistantBar } from "./assistant-bar";
import { MessageThread } from "./message-thread";
import { StreamingSection } from "./streaming-section";
import { AttachmentBubble } from "@/components/chat/input/attachment-bubble";
import { parseMessageMetadata } from "@/lib/store/mappers/message-mapper";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import { useState } from "react";
import { useResourceHydration } from "@/hooks/use-resource-hydration";

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
      projectTools.forEach((t) => combined.add(t));
    }
    if (assistantTools) {
      assistantTools.forEach((t) => combined.add(t));
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

  const initialKbIds = useMemo(
    () => (chat?.knowledgebaseId ? [chat.knowledgebaseId] : []),
    [chat?.knowledgebaseId],
  );

  const allEnabledServers = useMemo(() => {
    const personalEnabled = mcpServers.filter((s) => s.enabled);
    const publicEnabled = publicMcpServers.filter((s) => s.enabled);
    return [...personalEnabled, ...publicEnabled];
  }, [mcpServers, publicMcpServers]);

  // -- Artifact Panel Logic (Inlined) --
  const updateMessageMetadataDb = useAppStore(
    (state) => state.updateMessageMetadataDb,
  );

  const [artifactIndex, setArtifactIndex] = useState<number>(-1);
  const [isArtifactOpen, setIsArtifactOpen] = useState(false);
  const [prevArtifactsLength, setPrevArtifactsLength] = useState(0);

  const allArtifacts = useMemo(() => {
    const artifacts: ArtifactData[] = [];
    thread.forEach((msg) => {
      if (msg.metadata) {
        try {
          const meta = JSON.parse(msg.metadata);
          if (Array.isArray(meta.toolResults)) {
            meta.toolResults.forEach((tr: any) => {
              if (tr.toolName === "manage_artifact" && tr.result?.artifact) {
                artifacts.push({ ...tr.result.artifact, messageId: msg.id });
              }
            });
          }
        } catch {}
      }
      const mermaidMatch = msg.content.match(/```mermaid\n([\s\S]*?)```/);
      if (mermaidMatch) {
        artifacts.push({
          type: "mermaid",
          title: "Mermaid Diagram",
          content: mermaidMatch[1].trim(),
          messageId: msg.id,
        });
      }
    });
    return artifacts;
  }, [thread]);

  const activeArtifact =
    artifactIndex >= 0 ? allArtifacts[artifactIndex] : null;

  // Auto-open when artifacts appear
  if (allArtifacts.length !== prevArtifactsLength) {
    setPrevArtifactsLength(allArtifacts.length);
    if (allArtifacts.length > 0 && !isArtifactOpen && artifactIndex === -1) {
      setArtifactIndex(allArtifacts.length - 1);
      setIsArtifactOpen(true);
    } else if (allArtifacts.length > 0 && artifactIndex === -1) {
      setArtifactIndex(allArtifacts.length - 1);
    }
  }

  const handleShowArtifact = useCallback(
    (msgId: string) => {
      let foundIndex = -1;
      let artifactCounter = 0;

      for (const msg of thread) {
        let msgArtifactsCount = 0;
        if (msg.metadata) {
          try {
            const meta = JSON.parse(msg.metadata);
            if (Array.isArray(meta.toolResults)) {
              msgArtifactsCount = meta.toolResults.filter(
                (tr: any) => tr.toolName === "manage_artifact",
              ).length;
            }
          } catch {}
        }
        if (msgArtifactsCount === 0 && msg.content.includes("```mermaid")) {
          msgArtifactsCount = 1;
        }

        if (msg.id === msgId) {
          foundIndex = artifactCounter;
          break;
        }
        artifactCounter += msgArtifactsCount;
      }

      if (foundIndex >= 0) {
        setArtifactIndex(foundIndex);
        setIsArtifactOpen(true);
      }
    },
    [thread],
  );

  const handleUpdateArtifact = useCallback(
    (newContent: string) => {
      if (!activeArtifact || !activeArtifact.messageId) return;

      const msg = chat?.messages[activeArtifact.messageId];
      if (!msg || !msg.metadata) return;

      try {
        const meta = JSON.parse(msg.metadata);
        let updated = false;

        if (Array.isArray(meta.toolResults)) {
          meta.toolResults.forEach((tr: any) => {
            if (
              tr.toolName === "manage_artifact" &&
              tr.result?.artifact?.content === activeArtifact.content
            ) {
              tr.result.artifact.content = newContent;
              updated = true;
            }
          });
        }

        if (updated) {
          updateMessageMetadataDb(chatId, msg.id, JSON.stringify(meta));
        }
      } catch (e) {
        console.error("Failed to update artifact metadata", e);
      }
    },
    [activeArtifact, chat, chatId, updateMessageMetadataDb],
  );

  const handleKbChange = useCallback(
    (kbIds: string[]) => {
      const kbId = kbIds[0] ?? null;
      setKnowledgebase(chatId, kbId);
    },
    [chatId, setKnowledgebase],
  );

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
    );
  };

  const handleRegenerate = async (id: string) => {
    const msg = chat?.messages[id];
    if (!msg || msg.role !== "assistant" || !msg.parentId) return;

    const parentMsg = chat?.messages[msg.parentId];
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
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        <AssistantBar assistantName={currentAssistant?.name} />

        <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
          <div className="px-4 md:px-8 py-6">
            <div className="max-w-4xl mx-auto space-y-6 pb-12">
              <MessageThread
                thread={thread}
                chat={chat}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onRegenerate={handleRegenerate}
                onNavigateBranch={handleNavigateBranch}
                onShowArtifact={handleShowArtifact}
              />

              <StreamingSection
                isLoading={isLoading}
                streamingContent={streamingContent}
                streamingReasoning={streamingReasoning}
                isStreamingReasoning={isStreamingReasoning}
                activeToolCalls={activeToolCalls}
                streamingCitations={streamingCitations}
              />
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
