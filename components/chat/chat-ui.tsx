"use client";

import { Loader2 } from "lucide-react";

import { useCallback, useMemo } from "react";
import { AgentBar } from "@/components/chat/agent-bar";
import { ArtifactPanel } from "@/components/chat/artifact-panel";
import { CanvasReopenButton } from "@/components/chat/canvas-reopen-button";
import { ChatInput } from "@/components/chat/chat-input";
import {
  checkCanMentionAssistant,
  checkShouldShowReopen,
  filterEnabledMcpServers,
  resolveThread,
  updateChatKnowledgebase,
  useChatInitialSelections,
  useChatScrollToBottom,
} from "@/components/chat/chat-ui-helpers";
import { MessageThread } from "@/components/chat/message-thread";
import { StreamingSection } from "@/components/chat/streaming-section";
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
import { hydratedResources } from "@/lib/store/hydrated-resources";
import type { Chat } from "@/types/chat/chat";

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

  useInitialChatAutoSend(
    chat,
    initialMessage,
    onInitialMessageSent,
    handleSend,
    initialModelId,
    initialServerIds,
    initialSelectedTools,
    initialKbIds,
    initialSkillIds,
    initialSubagentsEnabled,
    initialSubagentModelId,
    initialSubagentIds,
    isInitialContextReady,
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
              initialSelectedServerIds={initialServerIds}
              initialSelectedTools={initialSelectedTools}
              initialSelectedKbs={initialKbIds}
              initialSelectedSkillIds={initialSkillIds}
              initialModelId={initialModelId}
              initialSubagentsEnabled={initialSubagentsEnabled}
              initialSubagentModelId={initialSubagentModelId}
              initialSubagentIds={initialSubagentIds}
              initialReasoningEffort={initialReasoningEffort}
              onKnowledgebaseChange={handleKbChange}
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
              skillIds={currentProject?.skillIds || currentAssistant?.skillIds}
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
  );
}
