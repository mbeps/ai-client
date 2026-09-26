import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { chatAbortRegistry } from "@/lib/chat/chat-abort-registry";
import { chatChannel } from "@/lib/inngest/channels";
import { inngest } from "@/lib/inngest/client";
import { getLogger } from "@/lib/logger";
import { stopChatRequestSchema } from "@/schemas/chat/chat";

const log = getLogger(["app", "api", "chat", "stop"]);

/**
 * Cancels an in-progress AI chat response generation.
 * Immediately aborts the active stream via ChatAbortRegistry, publishes
 * a finish event to Inngest Realtime to close connected clients, and sends
 * a `chat/response.cancel` event to Inngest for dashboard bookkeeping.
 *
 * **HTTP Method:** DELETE
 *
 * **Request Format:** JSON with chatId
 *
 * **Response Format:** JSON { success: true, aborted: boolean }
 *
 * **Authentication:** Required (Better Auth session)
 *
 * @author Maruf Bepary
 */
export async function DELETE(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const parsed = stopChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { chatId } = parsed.data;
  const userId = session.user.id;

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

  log.info(
    "Stop processed (chatId: {chatId}, abortedLocally: {abortedLocally})",
    {
      chatId,
      abortedLocally,
    },
  );

  return Response.json({ success: true, aborted: abortedLocally });
}
