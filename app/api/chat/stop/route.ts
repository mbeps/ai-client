import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { abortChatStream } from "@/lib/chat/abort-chat-stream";
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

  const abortedLocally = await abortChatStream(chatId, userId);

  log.info(
    "Stop processed (chatId: {chatId}, abortedLocally: {abortedLocally})",
    {
      chatId,
      abortedLocally,
    },
  );

  return Response.json({ success: true, aborted: abortedLocally });
}
