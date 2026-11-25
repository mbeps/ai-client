"use client";

import { Loader2 } from "lucide-react";

import { useCallback, useMemo, useState } from "react";
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
import { useCompactChat } from "@/hooks/chat/use-compact-chat";
import { useStreamResponse } from "@/hooks/chat/use-stream-response";
import { useResourceHydration } from "@/hooks/use-resource-hydration";
import { extractServerIdsFromTools } from "@/lib/chat/extract-server-ids-from-tools";
import { parseMessageMetadata } from "@/lib/chat/parse-message-metadata";
import { hydratedResources } from "@/lib/store/hydrated-resources";
import {
  type PendingChatLaunch,
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
 *
 * @param props - Configuration for the chat session ID and optional auto-messaging.
 * @returns Chat UI with ScrollArea, MessageThread, StreamingSection, ChatInput, and ArtifactPanel.
 * @author Maruf Bepary
 */
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
    agents,
    userSettings,
    projects,
    updateMessageMetadataDb,
  } = useChatStore(chatId);
  const chat = resolveActiveChat(storeChat, initialChat, chatId);

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

  const persistedTools = useChatToolsStore((s) => s.toolsByChat[chatId]);
  const persistedApprovalMode = useChatToolsStore(
    (s) => s.approvalModeByChat[chatId],
  );
  const storePendingLaunch = useChatToolsStore(
    (s) => s.pendingLaunchByChat[chatId],
  );
  const [capturedLaunchState, setCapturedLaunchState] = useState<{
    chatId: string;
    launch: PendingChatLaunch | undefined;
  }>(() => ({
    chatId,
    launch: useChatToolsStore.getState().pendingLaunchByChat[chatId],
  }));

  if (capturedLaunchState.chatId !== chatId) {
    setCapturedLaunchState({ chatId, launch: storePendingLaunch });
  } else if (!capturedLaunchState.launch && storePendingLaunch) {
    setCapturedLaunchState({ chatId, launch: storePendingLaunch });
  }

  const capturedPendingLaunch =
    capturedLaunchState.chatId === chatId
      ? capturedLaunchState.launch
      : undefined;

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

  const effectiveInitialModelId =
    capturedPendingLaunch?.model || initialModelId;
  const effectiveInitialServerIds = useMemo(() => {
    if (capturedPendingLaunch) return capturedPendingLaunch.selectedServerIds;
    if (persistedTools !== undefined) {
      return extractServerIdsFromTools(persistedTools);
    }
    return initialServerIds;
  }, [capturedPendingLaunch, persistedTools, initialServerIds]);
  const effectiveInitialSelectedTools = useMemo(() => {
    if (capturedPendingLaunch) return capturedPendingLaunch.selectedTools;
    if (persistedTools !== undefined) return persistedTools;
    return initialSelectedTools;
  }, [capturedPendingLaunch, persistedTools, initialSelectedTools]);
  const effectiveInitialKbIds =
    capturedPendingLaunch?.selectedKnowledgebases ?? initialKbIds;
  const effectiveInitialSubagentsEnabled =
    capturedPendingLaunch?.subagentsEnabled ?? initialSubagentsEnabled;
  const effectiveInitialSubagentModelId =
    capturedPendingLaunch?.subagentModelId ?? initialSubagentModelId;
  const effectiveInitialSubagentIds =
    capturedPendingLaunch?.subagentIds ?? initialSubagentIds;
  const effectiveInitialReasoningEffort =
    capturedPendingLaunch?.reasoningEffort ?? initialReasoningEffort;
  const effectiveInitialApprovalMode =
    capturedPendingLaunch?.approvalMode ??
    persistedApprovalMode ??
    initialApprovalMode;

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
  const { isCompacting, handleCompact } = useCompactChat(chatId);

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

  const consumePendingLaunch = useCallback(() => {
    useChatToolsStore.getState().clearPendingLaunch(chatId);
  }, [chatId]);

  useInitialChatAutoSend(
    chat,
    initialMessage,
    onInitialMessageSent,
    handleSend,
    effectiveInitialModelId,
    effectiveInitialServerIds,
    effectiveInitialSelectedTools,
    effectiveInitialKbIds,
    initialSkillIds,
    effectiveInitialSubagentsEnabled,
    effectiveInitialSubagentModelId,
    effectiveInitialSubagentIds,
    isInitialContextReady,
    effectiveInitialReasoningEffort,
    effectiveInitialApprovalMode,
    capturedPendingLaunch,
    consumePendingLaunch,
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
      setComposerSelectionsState({ chatId, selections });
    },
    [chatId],
  );

  const composerSelections =
    composerSelectionsState?.chatId === chatId
      ? composerSelectionsState.selections
      : null;

  const handleWidgetSend = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || isLoading) return;
      await handleSend(
        trimmed,
        [],
        composerSelections?.modelId ?? effectiveInitialModelId,
        composerSelections?.serverIds ?? effectiveInitialServerIds,
        composerSelections?.selectedTools ?? effectiveInitialSelectedTools,
        undefined,
        chat?.agentId ?? chat?.assistantId ?? undefined,
        composerSelections?.kbIds ?? effectiveInitialKbIds,
        composerSelections?.skillIds ?? initialSkillIds,
        composerSelections?.subagentsEnabled ??
          effectiveInitialSubagentsEnabled,
        composerSelections?.subagentModelId ?? effectiveInitialSubagentModelId,
        composerSelections?.reasoningEffort ?? effectiveInitialReasoningEffort,
        composerSelections?.subagentIds ?? effectiveInitialSubagentIds,
        composerSelections?.approvalMode ?? effectiveInitialApprovalMode,
      );
    },
    [
      isLoading,
      handleSend,
      composerSelections,
      effectiveInitialModelId,
      effectiveInitialServerIds,
      effectiveInitialSelectedTools,
      chat?.agentId,
      chat?.assistantId,
      effectiveInitialKbIds,
      initialSkillIds,
      effectiveInitialSubagentsEnabled,
      effectiveInitialSubagentModelId,
      effectiveInitialReasoningEffort,
      effectiveInitialSubagentIds,
      effectiveInitialApprovalMode,
    ],
  );

  if (!chat) {
    return (
      <div className="flex h-full items-center justify-center">
        Chat not found.
      </div>
    );
  }

  const chatAssistantId = chat.agentId ?? chat.assistantId;
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
                  chatId={chatId}
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
                key={chatId}
                chatId={chatId}
                onSend={handleSend}
                onCompact={handleCompact}
                isCompacting={isCompacting}
                isLoading={isLoading}
                onStop={stopStream}
                servers={allEnabledServers}
                activeChatAssistantId={chatAssistantId}
                systemPrompt={assistantPrompt}
                canMentionAssistant={canMentionAssistant}
                initialSelectedServerIds={effectiveInitialServerIds}
                initialSelectedTools={effectiveInitialSelectedTools}
                initialSelectedKbs={effectiveInitialKbIds}
                initialSelectedSkillIds={initialSkillIds}
                initialModelId={effectiveInitialModelId}
                initialSubagentsEnabled={effectiveInitialSubagentsEnabled}
                initialSubagentModelId={effectiveInitialSubagentModelId}
                initialSubagentIds={effectiveInitialSubagentIds}
                initialReasoningEffort={effectiveInitialReasoningEffort}
                initialApprovalMode={effectiveInitialApprovalMode}
                onKnowledgebaseChange={handleKbChange}
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
