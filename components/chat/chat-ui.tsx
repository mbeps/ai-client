"use client";

import { Loader2 } from "lucide-react";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { AgentBar } from "@/components/chat/agent-bar";
import { ArtifactPanel } from "@/components/chat/artifact-panel";
import { CanvasReopenButton } from "@/components/chat/canvas-reopen-button";
import {
  type ChatComposerSelections,
  ChatInput,
} from "@/components/chat/chat-input";
import {
  checkCanMentionAssistant,
  checkShouldShowReopen,
  filterEnabledMcpServers,
  resolveThread,
  updateChatKnowledgebase,
  useChatInitialSelections,
  useChatScrollToBottom,
} from "@/components/chat/chat-ui-helpers";
import { GenerativeUIProvider } from "@/components/chat/generative-ui/generative-ui-context";
import { MessageThread } from "@/components/chat/message-thread";
import { StreamingSection } from "@/components/chat/streaming-section";
import { ToolApprovalDialog } from "@/components/chat/tool-approval-dialog";
import { useChatArtifactPanel } from "@/components/chat/use-chat-artifact-panel";
import {
  findAssistant,
  findProject,
  resolveActiveChat,
} from "@/components/chat/use-chat-initial-state";
import {
  extractActiveStreamingCitations,
  useChatMessageActions,
  useInitialChatAutoSend,
} from "@/components/chat/use-chat-message-actions";
import { useChatStore } from "@/components/chat/use-chat-ui-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ROUTES } from "@/config/routes";
import { useCompactChat } from "@/hooks/chat/use-compact-chat";
import { useStreamResponse } from "@/hooks/chat/use-stream-response";
import { useResourceHydration } from "@/hooks/use-resource-hydration";
import { extractServerIdsFromTools } from "@/lib/chat/extract-server-ids-from-tools";
import { parseMessageMetadata } from "@/lib/chat/parse-message-metadata";
import { hydratedResources } from "@/lib/store/hydrated-resources";
import {
  NEW_CHAT_TOOLS_KEY,
  useChatToolsStore,
} from "@/lib/store/use-chat-tools-store";
import type { Chat } from "@/types/chat/chat";
import type { ApprovalDecision } from "@/types/tool/approval";

export { resolveActiveChat } from "@/components/chat/use-chat-initial-state";

/**
 * Represents chat uiprops.
 *
 * @author Maruf Bepary
 */
interface ChatUIProps {
  /** Unique identifier for the active chat session; omitted on `/` until first send. */
  chatId?: string;
  /** Pre-fetched chat data from server for immediate rendering before store hydration. */
  initialChat?: Chat;
  /** Optional message to send on component mount. Typically from query parameters. */
  initialMessage?: string;
  /** Callback invoked after the initial message is successfully sent. */
  onInitialMessageSent?: () => void;
  /** Optional empty-state content rendered when the thread has no messages yet. */
  emptyState?: React.ReactNode;
}

/**
 * Main chat interface component rendering messages, input, and artifacts.
 *
 * @param props - Configuration for the chat session ID and optional auto-messaging.
 * @returns Chat UI with ScrollArea, MessageThread, StreamingSection, ChatInput, and ArtifactPanel.
 * @author Maruf Bepary
 */
export function ChatUI({
  chatId: chatIdProp,
  initialChat,
  initialMessage,
  onInitialMessageSent,
  emptyState,
}: ChatUIProps) {
  const [createdChatId, setCreatedChatId] = useState<string | null>(null);
  const [prevChatIdProp, setPrevChatIdProp] = useState(chatIdProp);
  if (chatIdProp !== prevChatIdProp) {
    setPrevChatIdProp(chatIdProp);
    setCreatedChatId(null);
  }

  const activeChatId = chatIdProp ?? createdChatId;
  const composerChatId = activeChatId ?? NEW_CHAT_TOOLS_KEY;
  const streamChatId = activeChatId ?? "";
  const storeKey = activeChatId ?? "";

  const {
    storeChat,
    createChatDb,
    deleteMessageDb,
    setCurrentLeafDb,
    setKnowledgebaseDb,
    mcpServers,
    agents,
    userSettings,
    projects,
    updateMessageMetadataDb,
  } = useChatStore(storeKey);
  const chat = resolveActiveChat(storeChat, initialChat, storeKey);

  const hydration = useResourceHydration([
    "mcpServers",
    "publicMcpServers",
    "agents",
    "projects",
    "prompts",
    "skills",
    "mcpPrompts",
    "userSettings",
  ]);

  const currentAssistant = findAssistant(
    agents,
    chat?.agentId ?? chat?.assistantId,
  );
  const currentProject = findProject(projects, chat?.projectId);

  const thread = useMemo(
    () => resolveThread(chat?.messages, chat?.currentLeafId),
    [chat?.currentLeafId, chat?.messages],
  );

  const persistedTools = useChatToolsStore(
    (s) => s.toolsByChat[composerChatId],
  );
  const persistedApprovalMode = useChatToolsStore(
    (s) => s.approvalModeByChat[composerChatId],
  );

  const {
    initialModelId,
    initialSubagentsEnabled,
    initialSubagentModelId,
    initialSubagentIds,
    initialReasoningEffort,
    initialServerIds,
    initialSelectedTools,
    initialKbIds,
    initialSkillIds,
    initialApprovalMode,
  } = useChatInitialSelections(
    thread,
    currentProject,
    currentAssistant,
    userSettings,
    chat,
  );

  const effectiveInitialServerIds = useMemo(() => {
    if (persistedTools !== undefined) {
      return extractServerIdsFromTools(persistedTools);
    }
    return initialServerIds;
  }, [persistedTools, initialServerIds]);
  const effectiveInitialSelectedTools = useMemo(() => {
    if (persistedTools !== undefined) return persistedTools;
    return initialSelectedTools;
  }, [persistedTools, initialSelectedTools]);
  const effectiveInitialApprovalMode =
    persistedApprovalMode ?? initialApprovalMode;

  const allEnabledServers = useMemo(
    () => filterEnabledMcpServers(mcpServers),
    [mcpServers],
  );

  const {
    isLoading,
    streamingContent,
    streamingReasoning,
    isStreamingReasoning,
    activeToolCalls,
    assistantMessageId,
    pendingApprovals,
    approvalsDisabled,
    submitToolApprovals,
    streamResponse,
    stopStream,
  } = useStreamResponse(streamChatId);

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
    streamChatId,
    chat,
    thread,
    activeToolCalls,
    streamingContent,
    updateMessageMetadataDb,
  );

  const handleKbChange = useCallback(
    (kbIds: string[]) => {
      if (!activeChatId) return;
      updateChatKnowledgebase(activeChatId, kbIds, setKnowledgebaseDb);
    },
    [activeChatId, setKnowledgebaseDb],
  );

  const ensureChatId = useCallback(
    async (
      content: string,
      selectedKbIds: string[],
      selectedPromptId?: string | string[],
    ): Promise<string | null> => {
      if (activeChatId) return activeChatId;
      const hasPrompt = Array.isArray(selectedPromptId)
        ? selectedPromptId.length > 0
        : Boolean(selectedPromptId);
      if (!content.trim() && !hasPrompt) {
        toast.error("Please enter a message before sending.");
        return null;
      }
      try {
        const title = content.trim().slice(0, 60) || "New Chat";
        const newChatId = await createChatDb(title);
        if (selectedKbIds.length > 0) {
          await setKnowledgebaseDb(newChatId, selectedKbIds[0]);
        }
        useChatToolsStore
          .getState()
          .transferChatTools(NEW_CHAT_TOOLS_KEY, newChatId);
        setCreatedChatId(newChatId);
        if (typeof window !== "undefined") {
          window.history.pushState(null, "", ROUTES.CHATS.detail(newChatId));
        }
        return newChatId;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to start chat",
        );
        return null;
      }
    },
    [activeChatId, createChatDb, setKnowledgebaseDb],
  );

  const {
    handleSend,
    handleEdit,
    handleRegenerate,
    handleDelete,
    handleNavigateBranch,
  } = useChatMessageActions({
    chatId: streamChatId,
    chat,
    streamResponse,
    deleteMessageDb,
    setCurrentLeafDb,
    ensureChatId,
  });

  const scrollRef = useChatScrollToBottom();
  const { isCompacting, handleCompact } = useCompactChat(streamChatId);

  const chatAgentId = chat?.agentId ?? chat?.assistantId;
  const isAgentsReady =
    !chatAgentId ||
    Boolean(currentAssistant) ||
    hydratedResources.has("agents");
  const isProjectsReady =
    !chat?.projectId ||
    Boolean(currentProject) ||
    hydratedResources.has("projects");
  const isInitialContextReady =
    !hydration?.isLoading && isAgentsReady && isProjectsReady;

  useInitialChatAutoSend(
    chat,
    initialMessage,
    onInitialMessageSent,
    handleSend,
    initialModelId,
    effectiveInitialServerIds,
    effectiveInitialSelectedTools,
    initialKbIds,
    initialSkillIds,
    initialSubagentsEnabled,
    initialSubagentModelId,
    initialSubagentIds,
    isInitialContextReady,
    initialReasoningEffort,
    effectiveInitialApprovalMode,
  );

  const parkedPending = useMemo(() => {
    for (let i = thread.length - 1; i >= 0; i--) {
      const msg = thread[i];
      if (msg.role !== "assistant") continue;
      const meta = parseMessageMetadata(msg.metadata);
      if (meta.pendingApprovals.length > 0) {
        return {
          messageId: msg.id,
          approvals: meta.pendingApprovals,
        };
      }
      break;
    }
    return null;
  }, [thread]);

  const effectivePendingApprovals =
    pendingApprovals && pendingApprovals.length > 0
      ? pendingApprovals
      : (parkedPending?.approvals ?? []);
  const effectiveApprovalMessageId =
    pendingApprovals && pendingApprovals.length > 0
      ? (assistantMessageId ?? parkedPending?.messageId ?? null)
      : (parkedPending?.messageId ?? null);

  const handleSubmitApprovals = useCallback(
    async (decisions: ApprovalDecision[]): Promise<boolean> => {
      if (!effectiveApprovalMessageId || !submitToolApprovals) return false;
      return submitToolApprovals(effectiveApprovalMessageId, decisions);
    },
    [effectiveApprovalMessageId, submitToolApprovals],
  );

  const [composerSelectionsState, setComposerSelectionsState] = useState<{
    chatId: string;
    selections: ChatComposerSelections;
  } | null>(null);

  const handleComposerSelectionsChange = useCallback(
    (selections: ChatComposerSelections) => {
      setComposerSelectionsState({ chatId: composerChatId, selections });
    },
    [composerChatId],
  );

  const composerSelections =
    composerSelectionsState?.chatId === composerChatId
      ? composerSelectionsState.selections
      : null;

  const handleWidgetSend = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || isLoading) return;
      await handleSend(
        trimmed,
        [],
        composerSelections?.modelId ?? initialModelId,
        composerSelections?.serverIds ?? effectiveInitialServerIds,
        composerSelections?.selectedTools ?? effectiveInitialSelectedTools,
        undefined,
        chat?.agentId ?? chat?.assistantId ?? undefined,
        composerSelections?.kbIds ?? initialKbIds,
        composerSelections?.skillIds ?? initialSkillIds,
        composerSelections?.subagentsEnabled ?? initialSubagentsEnabled,
        composerSelections?.subagentModelId ?? initialSubagentModelId,
        composerSelections?.reasoningEffort ?? initialReasoningEffort,
        composerSelections?.subagentIds ?? initialSubagentIds,
        composerSelections?.approvalMode ?? effectiveInitialApprovalMode,
      );
    },
    [
      isLoading,
      handleSend,
      composerSelections,
      initialModelId,
      effectiveInitialServerIds,
      effectiveInitialSelectedTools,
      chat?.agentId,
      chat?.assistantId,
      initialKbIds,
      initialSkillIds,
      initialSubagentsEnabled,
      initialSubagentModelId,
      initialReasoningEffort,
      initialSubagentIds,
      effectiveInitialApprovalMode,
    ],
  );

  if (activeChatId && !chat) {
    return (
      <div className="flex h-full items-center justify-center">
        Chat not found.
      </div>
    );
  }

  const chatAssistantId = chat?.agentId ?? chat?.assistantId;
  const activeArtifactId = activeArtifact?.id;
  const assistantName = currentAssistant?.name;
  const assistantPrompt = currentAssistant?.prompt ?? undefined;
  const canMentionAssistant = checkCanMentionAssistant(
    thread.length,
    chatAssistantId,
  );
  const shouldShowReopen = checkShouldShowReopen(
    isArtifactOpen,
    allArtifacts.length,
  );

  return (
    <GenerativeUIProvider
      sendMessage={handleWidgetSend}
      isStreaming={isLoading}
    >
      <div className="relative flex h-full w-full overflow-hidden">
        <div className="relative flex h-full min-w-0 flex-1 flex-col">
          <AgentBar agentName={assistantName} />

          <ScrollArea className="min-h-0 flex-1" ref={scrollRef}>
            <div className="px-4 py-6 md:px-8">
              <div className="mx-auto max-w-4xl space-y-6 pb-12">
                {thread.length === 0 && !isLoading && emptyState}

                {chat && (
                  <MessageThread
                    thread={thread}
                    chat={chat}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onRegenerate={handleRegenerate}
                    onNavigateBranch={handleNavigateBranch}
                    onToggleArtifact={handleToggleArtifact}
                    activeArtifactId={activeArtifactId}
                    isCanvasOpen={isArtifactOpen}
                    servers={allEnabledServers}
                  />
                )}

                <StreamingSection
                  isLoading={isLoading}
                  streamingContent={streamingContent}
                  streamingReasoning={streamingReasoning}
                  isStreamingReasoning={isStreamingReasoning}
                  activeToolCalls={activeToolCalls}
                  streamingCitations={streamingCitations}
                  onToggleArtifact={handleToggleArtifact}
                  activeArtifactId={activeArtifactId}
                  isCanvasOpen={isArtifactOpen}
                  chatId={streamChatId}
                  assistantMessageId={assistantMessageId}
                  assistantName={assistantName}
                />
              </div>
            </div>
          </ScrollArea>

          <div className="bg-background/80 shrink-0 px-4 pb-2 backdrop-blur-sm md:px-8 md:pb-4">
            <div className="mx-auto max-w-4xl">
              {isCompacting && (
                <div className="mb-2 flex items-center justify-center">
                  <div className="bg-muted/70 text-muted-foreground border-border/60 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Compacting conversation...</span>
                  </div>
                </div>
              )}
              <ToolApprovalDialog
                pendingApprovals={effectivePendingApprovals}
                onSubmit={handleSubmitApprovals}
                disabled={Boolean(approvalsDisabled)}
              />
              <ChatInput
                key={chatIdProp ?? "draft"}
                chatId={composerChatId}
                onSend={handleSend}
                onCompact={activeChatId ? handleCompact : undefined}
                isCompacting={isCompacting}
                isLoading={isLoading}
                onStop={stopStream}
                servers={allEnabledServers}
                activeChatAssistantId={chatAssistantId}
                systemPrompt={assistantPrompt}
                canMentionAssistant={canMentionAssistant}
                initialSelectedServerIds={effectiveInitialServerIds}
                initialSelectedTools={effectiveInitialSelectedTools}
                initialSelectedKbs={initialKbIds}
                initialSelectedSkillIds={initialSkillIds}
                initialModelId={initialModelId}
                initialSubagentsEnabled={initialSubagentsEnabled}
                initialSubagentModelId={initialSubagentModelId}
                initialSubagentIds={initialSubagentIds}
                initialReasoningEffort={initialReasoningEffort}
                initialApprovalMode={effectiveInitialApprovalMode}
                onKnowledgebaseChange={
                  activeChatId ? handleKbChange : undefined
                }
                onSelectionsChange={handleComposerSelectionsChange}
                thread={thread}
                projectId={chat?.projectId}
                assistantId={chatAssistantId}
                promptMode={
                  currentProject?.promptMode || currentAssistant?.promptMode
                }
                promptIds={
                  currentProject?.promptIds || currentAssistant?.promptIds
                }
                skillMode={
                  currentProject?.skillMode || currentAssistant?.skillMode
                }
                skillIds={
                  currentProject?.skillIds || currentAssistant?.skillIds
                }
              />
            </div>
          </div>
        </div>

        {shouldShowReopen && <CanvasReopenButton onReopen={handleReopen} />}

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
    </GenerativeUIProvider>
  );
}
