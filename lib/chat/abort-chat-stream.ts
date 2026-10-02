import { chatAbortRegistry } from "@/lib/chat/chat-abort-registry";
import { chatChannel } from "@/lib/inngest/channels";
import { inngest } from "@/lib/inngest/client";
import { getLogger } from "@/lib/logger";

const log = getLogger(["chat", "abort"]);

/**
 * Aborts an active chat generation stream immediately and broadcasts cancellation.
 * 1. Aborts in-memory AbortController in Node.js (< 1ms).
 * 2. Emits finish event over Inngest Realtime so all connected browsers close streaming UI.
 * 3. Sends `chat/response.cancel` event to Inngest to trigger durable function cancellation.
 *
 * @param chatId Chat identifier being aborted.
 * @param userId User identifier for scoped cancellation.
 * @returns Whether an active stream was aborted locally in memory.
 * @author Maruf Bepary
 */
export async function abortChatStream(
  chatId: string,
  userId: string,
): Promise<boolean> {
  // 1. Immediately abort the active stream in Node.js (< 1ms)
  const abortedLocally = chatAbortRegistry.abort(chatId);

  // 2. Publish finish event to Realtime so all connected browsers close the stream immediately
  try {
    await inngest.realtime.publish(chatChannel({ chatId }).stream, {
      type: "finish",
      finishReason: "stop",
    });
  } catch (realtimeErr) {
    log.warn("Failed to publish stop to Realtime: {err}", {
      err:
        realtimeErr instanceof Error
          ? realtimeErr.message
          : String(realtimeErr),
    });
  }

  // 3. Send Inngest cancel event for dashboard status bookkeeping
  try {
    await inngest.send({
      name: "chat/response.cancel",
      data: { chatId, userId },
    });
  } catch (inngestErr) {
    log.warn("Failed to send cancel event to Inngest: {err}", {
      err:
        inngestErr instanceof Error ? inngestErr.message : String(inngestErr),
    });
  }

  return abortedLocally;
}
