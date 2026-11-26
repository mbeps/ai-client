"use client";

import { AlertCircle, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getChat } from "@/actions/chats/get-chat";
import {
  getOrCreateWorkflowChat,
  resetWorkflowChat,
} from "@/actions/workflows/get-or-create-workflow-chat";
import { ChatInput, type ChatInputProps } from "@/components/chat/chat-input";
import { resolveThread } from "@/components/chat/chat-ui-helpers";
import { MessageThread } from "@/components/chat/message-thread";
import { StreamingSection } from "@/components/chat/streaming-section";
import { ToolApprovalDialog } from "@/components/chat/tool-approval-dialog";
import { useChatStore } from "@/components/chat/use-chat-ui-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStreamResponse } from "@/hooks/chat/use-stream-response";
import { useApiError } from "@/hooks/use-api-error";
import { useUserModels } from "@/hooks/use-user-models";
import { buildChatFromRows } from "@/lib/chat/message-tree-utils";
import { useAppStore } from "@/lib/store/use-app-store";

/** Props for {@link WorkflowBuilderChat}. */
export interface WorkflowBuilderChatProps {
  workflowId: string;
  isNew?: boolean;
  onCreateDraft?: () => Promise<void> | void;
  onBeforeSend?: () => Promise<boolean> | boolean;
  onWorkflowMutated?: () => Promise<void> | void;
}

/**
 * Scoped AI Builder side chat for creating and editing the open workflow.
 * Reuses MessageThread, StreamingSection, ToolApprovalDialog, and ChatInput (minimalMode).
 */
export function WorkflowBuilderChat({
  workflowId,
  isNew = false,
  onCreateDraft,
  onBeforeSend,
  onWorkflowMutated,
}: WorkflowBuilderChatProps) {
  const { handleApiError } = useApiError();
  const [chatId, setChatId] = useState<string | null>(null);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const creatingDraftRef = useRef(false);
  const { storeChat } = useChatStore(chatId ?? "");
  const [isLoadingChat, setIsLoadingChat] = useState(!isNew);
  const [isResetting, setIsResetting] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(
    undefined,
  );
  const { models } = useUserModels("chat");
  const selectedModel = selectedModelId
    ? models.find((m) => m.id === selectedModelId)
    : undefined;
  const isNonToolModel = selectedModel?.capTools === false;

  const loadChatSession = useCallback(
    async (id: string) => {
      const res = await getChat(id);
      if (!res.ok) {
        handleApiError(res.error, "Failed to load workflow builder chat");
        return;
      }
      useAppStore.getState().upsertChat(buildChatFromRows(res.value));
    },
    [handleApiError],
  );

  useEffect(() => {
    if (isNew) {
      setIsLoadingChat(false);
      return;
    }

    let cancelled = false;
    setIsLoadingChat(true);
    getOrCreateWorkflowChat(workflowId)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          handleApiError(res.error, "Failed to load workflow builder chat");
          return;
        }
        setChatId(res.value.id);
        await loadChatSession(res.value.id);
      })
      .catch((err) => {
        if (!cancelled) {
          handleApiError(err, "Failed to load workflow builder chat");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingChat(false);
      });

    return () => {
      cancelled = true;
    };
    // only reload when workflowId or isNew changes
  }, [workflowId, isNew, loadChatSession, handleApiError]);

  const {
    isLoading: isStreaming,
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
  } = useStreamResponse(chatId ?? "", {
    onDone: () => {
      void onWorkflowMutated?.();
    },
  });

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const res = await resetWorkflowChat(workflowId);
      if (!res.ok) {
        handleApiError(res.error, "Failed to reset builder chat");
        return;
      }
      setChatId(res.value.id);
      await loadChatSession(res.value.id);
    } finally {
      setIsResetting(false);
    }
  };

  const handleSend: ChatInputProps["onSend"] = async (
    content,
    _attachments,
    model,
    _selectedServerIds,
    _selectedTools,
    _selectedPromptId,
    _selectedAssistantId,
    _selectedKnowledgebases,
    _selectedSkillIds,
    _subagentsEnabled,
    _canvasMode,
    reasoningEffort,
    _selectedProviderId,
    approvalMode,
  ) => {
    if (!chatId) return;
    if (onBeforeSend) {
      const okToSend = await onBeforeSend();
      if (!okToSend) return;
    }

    await streamResponse(
      crypto.randomUUID(),
      content,
      storeChat?.currentLeafId ?? null,
      [],
      model,
      [],
      [],
      undefined,
      undefined,
      [],
      [],
      false,
      undefined,
      reasoningEffort,
      [],
      approvalMode,
    );
  };

  const handleCreateDraftClick = async () => {
    if (!onCreateDraft || creatingDraftRef.current) return;
    creatingDraftRef.current = true;
    setIsCreatingDraft(true);
    try {
      await onCreateDraft();
    } finally {
      creatingDraftRef.current = false;
      setIsCreatingDraft(false);
    }
  };

  if (isNew) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <Sparkles className="text-muted-foreground h-8 w-8" />
        <div className="space-y-1">
          <p className="text-sm font-medium">AI Workflow Builder</p>
          <p className="text-muted-foreground text-xs">
            Save this draft first to build and edit nodes with AI.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={isCreatingDraft}
          onClick={() => void handleCreateDraftClick()}
        >
          {isCreatingDraft && (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          )}
          {isCreatingDraft
            ? "Creating Draft..."
            : "Create Draft & Start AI Builder"}
        </Button>
      </div>
    );
  }

  if (isLoadingChat || !chatId) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-6 text-xs">
        Loading builder chat...
      </div>
    );
  }

  const thread = resolveThread(storeChat?.messages, storeChat?.currentLeafId);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium">AI Workflow Builder</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          disabled={isResetting || isStreaming}
          onClick={handleReset}
        >
          <RotateCcw className="h-3 w-3" />
          New chat
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-3 py-2">
        {storeChat && (
          <MessageThread
            thread={thread}
            chat={storeChat}
            onEdit={() => {}}
            onDelete={() => {}}
            onRegenerate={() => {}}
            onNavigateBranch={() => {}}
          />
        )}
        <StreamingSection
          isLoading={isStreaming}
          streamingContent={streamingContent}
          streamingReasoning={streamingReasoning}
          isStreamingReasoning={isStreamingReasoning}
          activeToolCalls={activeToolCalls}
          streamingCitations={[]}
          chatId={chatId}
          assistantMessageId={assistantMessageId}
        />
      </ScrollArea>

      <ToolApprovalDialog
        pendingApprovals={pendingApprovals}
        onSubmit={(decisions) => {
          if (assistantMessageId) {
            void submitToolApprovals(assistantMessageId, decisions);
          }
        }}
        disabled={Boolean(approvalsDisabled)}
      />

      {isNonToolModel && (
        <div
          role="status"
          className="mx-2 mb-1 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-300"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>
            Selected model does not support tool calling. Choose a tool-capable
            model to edit the workflow.
          </span>
        </div>
      )}

      <div className="border-t p-2">
        <ChatInput
          key={chatId}
          chatId={chatId}
          minimalMode={true}
          isLoading={isStreaming}
          onStop={stopStream}
          onSend={handleSend}
          onSelectionsChange={(selections) =>
            setSelectedModelId(selections.modelId)
          }
          servers={[]}
        />
      </div>
    </div>
  );
}
