import { toast } from "sonner";
import { persistMessage } from "@/actions/chats/persist-message";
import { isAccessOrNotFoundError } from "@/hooks/chat/stream/use-stream-db-sync";
import {
  buildMetadata,
  resolveContent,
} from "@/hooks/chat/stream/use-stream-prompt-content";
import type {
  StreamRefsObject,
  StreamRequestOptions,
  StreamResponseExecutionParams,
} from "@/hooks/chat/stream/use-stream-types";
import { processAttachments } from "@/lib/chat/attachments/process-attachments";
import { logger } from "@/lib/logger";

/**
 * Extracts error message string safely from Error or Error-like objects.
 * @author Maruf Bepary
 */
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "";
}

/**
 * Dispatches stream generation request to /api/chat.
 * @author Maruf Bepary
 */
async function dispatchChatStreamRequest(
  body: StreamRequestOptions,
  handleApiError: (err: unknown) => boolean,
): Promise<boolean> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      if (!handleApiError(errorData)) {
        toast.error(errorData.error || "Failed to generate response");
      }
      return false;
    }
    return true;
  } catch (err: unknown) {
    if (!handleApiError(err)) {
      const message = extractErrorMessage(err);
      toast.error(message || "Failed to generate response");
    }
    return false;
  }
}

/**
 * Persists the user message to the database before initiating generation.
 * @author Maruf Bepary
 */
async function persistUserTurnMessage(
  chatId: string,
  userMsgId: string,
  fullContent: string,
  parentId: string | null,
  metadata: string,
): Promise<{ success: boolean; isNotFound: boolean }> {
  try {
    await persistMessage(chatId, {
      id: userMsgId,
      role: "user",
      content: fullContent,
      parentId,
      metadata,
    });
    return { success: true, isNotFound: false };
  } catch (err) {
    logger.error("Failed to persist message", err);
    return {
      success: false,
      isNotFound: isAccessOrNotFoundError(err),
    };
  }
}

/**
 * Halts execution and cleans up refs when message persistence fails.
 * @author Maruf Bepary
 */
function handlePersistFailure(
  refs: StreamRefsObject,
  resetStreamingState: () => void,
  setChatNotFound: (v: boolean) => void,
  isNotFound: boolean,
) {
  resetStreamingState();
  refs.lastChunkTimeRef.current = 0;
  refs.pendingRef.current = { userMessageId: null, model: "", startTime: 0 };
  refs.assistantMessageIdRef.current = null;
  refs.accumulatedTextRef.current = "";
  refs.accumulatedReasoningRef.current = "";

  if (isNotFound) {
    setChatNotFound(true);
    toast.error("Chat not found or has been deleted.");
  } else {
    toast.error("Failed to save message. Please check your connection.");
  }
}

/**
 * Initializes refs and state before dispatching generation request.
 * @author Maruf Bepary
 */
function setupStreamResponseStart(
  refs: StreamRefsObject,
  resetStreamingState: () => void,
  setIsStreaming: (is: boolean) => void,
  userMsgId: string,
  model: string,
) {
  refs.rejoinedRef.current = false;
  refs.pendingRef.current = {
    userMessageId: userMsgId,
    model,
    startTime: Date.now(),
  };
  refs.lastChunkTimeRef.current = Date.now();
  refs.stoppedRef.current = false;
  refs.assistantMessageIdRef.current = null;
  refs.accumulatedTextRef.current = "";
  refs.accumulatedReasoningRef.current = "";
  refs.activeToolCallsRef.current = [];
  resetStreamingState();
  setIsStreaming(true);
}

/**
 * Prepares user message, optimistically adds to store, and persists to DB.
 * @author Maruf Bepary
 */
async function prepareAndPersistUserMessage(
  params: StreamResponseExecutionParams,
): Promise<{
  userMsgMetadata: string;
  persisted: boolean;
  isNotFound: boolean;
}> {
  const metadataObj = buildMetadata(params);
  const { fullContent } = await resolveContent(
    params.content,
    params.selectedPromptIds,
    metadataObj,
  );
  const userMsgMetadata = JSON.stringify(metadataObj);

  params.addMessage(params.chatId, {
    role: "user",
    content: fullContent,
    parentId: params.parentId,
    id: params.userMsgId,
    metadata: userMsgMetadata,
    attachments: params.attachments,
  });

  const res = await persistUserTurnMessage(
    params.chatId,
    params.userMsgId,
    fullContent,
    params.parentId,
    userMsgMetadata,
  );

  return {
    userMsgMetadata,
    persisted: res.success,
    isNotFound: res.isNotFound,
  };
}

/**
 * Orchestrates full stream response dispatch flow: init -> persist -> process attachments -> fetch /api/chat.
 * @author Maruf Bepary
 */
export async function executeStreamResponse(
  params: StreamResponseExecutionParams,
): Promise<string> {
  setupStreamResponseStart(
    params.refs,
    params.resetStreamingState,
    params.setIsStreaming,
    params.userMsgId,
    params.model,
  );

  const { persisted, isNotFound } = await prepareAndPersistUserMessage(params);

  if (!persisted) {
    handlePersistFailure(
      params.refs,
      params.resetStreamingState,
      params.setChatNotFound,
      isNotFound,
    );
    return "";
  }

  const uploaded = await processAttachments(
    params.attachments,
    params.userMsgId,
  );
  if (uploaded.length > 0) {
    params.updateMessageAttachments(params.chatId, params.userMsgId, uploaded);
  }

  const dispatched = await dispatchChatStreamRequest(
    {
      chatId: params.chatId,
      userMessageId: params.userMsgId,
      model: params.model,
      selectedServerIds: params.selectedServerIds,
      selectedTools: params.selectedTools,
      selectedAssistantId: params.selectedAssistantId,
      selectedSkillIds: params.selectedSkillIds,
      selectedKbIds: params.selectedKbIds,
      subagentsEnabled: params.subagentsEnabled,
      subagentModelId: params.subagentModelId,
    },
    params.handleApiError,
  );

  if (!dispatched) {
    params.setIsStreaming(false);
  }

  return "";
}
