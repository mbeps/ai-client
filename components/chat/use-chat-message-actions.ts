import { useCallback, useEffect, useRef } from "react";
import type { useStreamResponse } from "@/hooks/chat/use-stream-response";
import { extractCitations } from "@/lib/chat/extract-citations";
import { resolveRegeneratePayload } from "@/lib/chat/extract-regenerate-payload";
import { getDeepestLeaf } from "@/lib/chat/get-deepest-leaf";
import type { Attachment } from "@/types/attachment/attachment";
import type { Chat } from "@/types/chat/chat";

export function scrollElementToBottom(container: HTMLElement | null): void {
  if (!container) return;
  const viewport = container.querySelector("[data-radix-scroll-area-viewport]");
  if (viewport) {
    viewport.scrollTop = viewport.scrollHeight;
  } else {
    container.scrollTop = container.scrollHeight;
  }
}

function clearMsgQueryParamFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("msg")) return;
  url.searchParams.delete("msg");
  window.history.replaceState({}, "", url.pathname + (url.search || ""));
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

type StreamResponseFn = ReturnType<typeof useStreamResponse>["streamResponse"];

interface UseChatMessageActionsParams {
  chatId: string;
  chat?: Chat;
  streamResponse: StreamResponseFn;
  deleteMessageDb: (chatId: string, id: string) => void;
  setCurrentLeafDb: (chatId: string, leafId: string) => void;
}

export function useChatMessageActions({
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

export function useInitialChatAutoSend(
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

export function extractActiveStreamingCitations(activeToolCalls: any[]) {
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
