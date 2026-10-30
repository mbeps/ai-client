import { persistMessage } from "@/actions/chats/persist-message";
import { clearInflightState } from "@/hooks/chat/stream/use-stream-inflight-state";
import type { StreamRefsObject } from "@/hooks/chat/stream/use-stream-types";
import { buildAssistantFinishMetadata } from "@/lib/chat/stream/build-assistant-finish-metadata";
import { extractCompletedToolResults } from "@/lib/chat/stream/extract-completed-tool-results";
import { logger } from "@/lib/logger";
import { useAppStore } from "@/lib/store/use-app-store";

/**
 * Resolves the parent user message ID when stopping an in-flight stream.
 *
 * @param pendingUserMsgId - Currently tracked user message ID
 * @param currentChat - Chat model with active leaf pointer
 * @returns Resolved message ID or null
 * @author Maruf Bepary
 */
function resolveUserMessageIdForStop(
  pendingUserMsgId: string | null,
  currentChat?: {
    currentLeafId?: string | null;
    messages: Record<string, { role: string; parentId?: string | null }>;
  },
): string | null {
  if (pendingUserMsgId) return pendingUserMsgId;
  const leafId = currentChat?.currentLeafId;
  if (!leafId) return null;
  const leafMsg = currentChat.messages[leafId];
  if (leafMsg?.role === "user") {
    return leafId;
  }
  if (leafMsg?.role === "assistant" && leafMsg.parentId) {
    return leafMsg.parentId;
  }
  return null;
}

/**
 * Handles user cancellation of in-flight stream generation.
 *
 * @param chatId - Active chat ID
 * @param addMessage - Store callback to commit partial message
 * @param resetStreamingState - State reset callback
 * @param refs - Mutable stream refs bundle
 * @author Maruf Bepary
 */
export async function executeStopStream(
  chatId: string,
  addMessage: (chatId: string, msg: any) => void,
  resetStreamingState: () => void,
  refs: StreamRefsObject,
) {
  refs.stoppedRef.current = true;
  clearInflightState(chatId);

  const partialText = refs.accumulatedTextRef.current;
  const reasoning = refs.accumulatedReasoningRef.current;
  const messageId = refs.assistantMessageIdRef.current || crypto.randomUUID();
  const chat = useAppStore.getState().chats?.[chatId];
  const userMsgId = resolveUserMessageIdForStop(
    refs.pendingRef.current.userMessageId,
    chat,
  );

  const completedTools = refs.activeToolCallsRef.current.filter(
    (tc) => tc.status === "complete",
  );
  const toolResults = extractCompletedToolResults(completedTools);
  const hasPartial = Boolean(
    partialText || reasoning || refs.activeToolCallsRef.current.length > 0,
  );

  refs.lastChunkTimeRef.current = 0;
  resetStreamingState();

  try {
    await fetch("/api/chat/stop", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId }),
    });
  } catch (err) {
    logger.error("Failed to abort chat stream on server", err);
  }

  if (hasPartial && userMsgId) {
    const stopMetadata = buildAssistantFinishMetadata({
      model: refs.pendingRef.current.model,
      reasoning,
      completedTools,
      toolResults,
      finishReason: "stop",
      stopped: true,
    });
    addMessage(chatId, {
      role: "assistant",
      content: partialText,
      parentId: userMsgId,
      id: messageId,
      metadata: stopMetadata,
    });
    try {
      await persistMessage(chatId, {
        id: messageId,
        role: "assistant",
        content: partialText,
        parentId: userMsgId,
        metadata: stopMetadata,
      });
    } catch (err) {
      logger.error("Failed to persist stopped message", err);
    }
  }
}
