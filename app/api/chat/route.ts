import { auth } from "@/lib/auth/auth";
import { env } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { streamText, isStepCount } from "ai";
import { chatRequestSchema } from "@/schemas/chat/chat";
import { registerMcpTools } from "@/lib/chat/register-mcp-tools";
import { registerFileUrlTool } from "@/lib/chat/register-file-url-tool";
import { getUserSettings } from "@/lib/actions/user-settings/get-user-settings";
import { resolveDefaultChatProvider } from "@/lib/chat/resolve-default-chat-provider";
import { resolveProvider } from "@/lib/chat/resolve-provider";
import { logger } from "@/lib/logger";
import {
  VisionNotSupportedError,
  ToolsNotSupportedError,
} from "@/constants/errors";
import {
  loadChatContext,
  ChatNotFoundError,
} from "@/lib/chat/load-chat-context";
import { checkVisionSupport } from "@/lib/chat/vision-guard";
import { buildProviderErrorResponse } from "@/lib/chat/build-provider-error";
import { classifyProviderError } from "@/lib/error/classify-provider-error";
import { loadThreadFromDb } from "@/lib/chat/load-thread-from-db";
import { prepareChatMessages } from "@/lib/chat/prepare-chat-messages";
import { buildSystemPrompt } from "@/lib/chat/build-system-prompt";
import { createChatStream, type FinishRef } from "@/lib/chat/chat-stream";

export const maxDuration = 60;

/**
 * Streams AI chat responses with server-side history reconstruction, model
 * context, system prompts, MCP tool integration, and message persistence.
 *
 * The client sends only identifiers (`chatId`, `userMessageId`, selections) —
 * never message history. The server reconstructs the active branch from the
 * database (trust boundary: clients cannot inject `role:"system"` messages or
 * unowned attachment keys) and streams via an AI SDK UI message stream.
 *
 * **HTTP Method:** POST
 *
 * **Request Format:** JSON with chatId, userMessageId, model?, selectedServerIds?,
 * selectedTools?, selectedAssistantId?, selectedKbIds?
 *
 * **Response Format:** AI SDK UI message stream (start chunk carries the
 * server-assigned assistant message id; assistant response persisted to DB on
 * stream finish)
 *
 * **Authentication:** Required (Better Auth session)
 *
 * @author Maruf Bepary
 * @see {@link lib/chat/load-thread-from-db} for server-side history reconstruction
 * @see {@link lib/chat/chat-stream} for UI message stream wrapping
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    logger.warn(
      "[Chat API] Invalid request:",
      JSON.stringify(parsed.error.format(), null, 2),
    );
    return Response.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    chatId,
    userMessageId,
    model: requestedModel,
    selectedServerIds,
    selectedTools,
    selectedAssistantId,
    selectedKbIds,
  } = parsed.data;

  // Ensure model is undefined if empty or whitespace-only
  const model =
    requestedModel && requestedModel.trim() !== "" ? requestedModel : undefined;
  const userId = session.user.id;

  const rateLimit = checkRateLimit(`chat:${userId}`, env.RATE_LIMIT_CHAT_RPM);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  let mcpCleanup: () => Promise<void> = async () => {};

  try {
    // Independent I/O — run concurrently (ARCH-02)
    const [userSettings, resolved, ctx, thread] = await Promise.all([
      getUserSettings().catch(() => null),
      model
        ? resolveProvider(userId, model)
        : resolveDefaultChatProvider(userId),
      loadChatContext(
        chatId,
        userId,
        selectedServerIds,
        selectedKbIds,
        selectedAssistantId,
      ),
      loadThreadFromDb(chatId, userMessageId, userId),
    ]);

    const globalSystemPrompt = userSettings?.globalSystemPrompt;
    const resolvedModelRow = {
      capVision: resolved.modelRow.capVision,
      capTools: resolved.modelRow.capTools,
    };
    const resolvedModelId = resolved.modelId;

    logger.info(
      "[Chat API] Request initialized",
      { chatId, userMessageId, model, selectedServerIds, selectedAssistantId },
      userId,
    );

    // --- Register MCP tools (depends on ctx) ---
    const isArtifactToolSelected = selectedTools?.includes(
      "internal:tool:manage_artifact",
    );

    const { mcpTools, mcpCleanup: registeredCleanup } = await registerMcpTools(
      ctx.servers as any,
      selectedTools,
      !!isArtifactToolSelected,
      ctx.activeKbId,
      ctx.kbIsReady,
      userId,
    );
    mcpCleanup = registeredCleanup;

    const hasMcpTools = Object.keys(mcpTools).length > 0;

    // --- Verify model capabilities against the DB-reconstructed thread ---
    if (!checkVisionSupport(thread as any, !!resolvedModelRow?.capVision)) {
      throw new VisionNotSupportedError();
    }

    // File attachments are resolved on demand via the get_file_url tool —
    // presigned URLs are no longer embedded in the system prompt (ATT-06).
    const fileAttachments = thread
      .flatMap((m) => m.attachments ?? [])
      .map((a) => ({ name: a.name, key: a.key, type: a.type }))
      .filter((a) => a.key);
    const hasFileAttachments = fileAttachments.length > 0;

    const finalMessages = prepareChatMessages({ history: thread });

    const isToolCallingModel = !!resolvedModelRow?.capTools;
    if (!isToolCallingModel && hasMcpTools) {
      throw new ToolsNotSupportedError();
    }

    // --- Stream AI response ---
    const finishRef: FinishRef = { current: null };
    const result = streamText({
      model: resolved.sdkProvider.chat(resolvedModelId),
      // System prompt passed natively — never spoofable via messages[]
      instructions: buildSystemPrompt(
        globalSystemPrompt,
        ctx.projectRow?.globalPrompt,
        ctx.assistantRow?.prompt,
        ctx.kbIsReady,
        hasFileAttachments,
      ),
      messages: finalMessages,
      tools:
        isToolCallingModel && (hasMcpTools || hasFileAttachments)
          ? {
              ...(hasFileAttachments
                ? registerFileUrlTool(fileAttachments)
                : {}),
              ...(hasMcpTools ? mcpTools : {}),
            }
          : undefined,
      stopWhen:
        isToolCallingModel && (hasMcpTools || hasFileAttachments)
          ? isStepCount(env.CHAT_MAX_STEPS)
          : undefined,
      abortSignal: req.signal,
      // Client aborts don't reliably fire onFinish — capture partial content
      // into finishRef so the shared persistence path can save what was
      // generated before the abort.
      onAbort: ({ steps }) => {
        const text = steps.map((s) => s.text).join("");
        if (!text && !finishRef.current) return;
        finishRef.current = {
          ...(finishRef.current ?? {}),
          text: text || finishRef.current?.text,
          finishReason: "abort",
        };
      },
      onEnd: (finish) => {
        // SDK v6 may deliver reasoning as parts — normalise to a string
        const rawReasoning = finish.reasoning;
        const reasoning =
          typeof rawReasoning === "string"
            ? rawReasoning
            : Array.isArray(rawReasoning)
              ? rawReasoning.map((p) => (p as any).text ?? "").join("")
              : "";
        // In AI SDK v7, finish.toolCalls and finish.toolResults aggregate across all steps.
        finishRef.current = {
          text: finish.text,
          reasoning,
          toolCalls: (finish.toolCalls as unknown[]) ?? [],
          toolResults: (finish.toolResults as unknown[]) ?? [],
          finishReason: finish.finishReason,
        };
      },
    });

    return createChatStream({
      result,
      chatId,
      userId,
      userMessageId,
      resolvedModelId,
      mcpCleanup,
      finishRef,
      abortSignal: req.signal,
    });
  } catch (error: unknown) {
    await mcpCleanup();

    // Known application errors → structured responses
    const knownResponse = buildProviderErrorResponse(error);
    if (knownResponse) return knownResponse;

    // Duck-type raw provider errors (context window, content filter, API key)
    // into classified classes so users get actionable statuses, not a 500.
    const classified = classifyProviderError(error);
    const classifiedResponse = classified
      ? buildProviderErrorResponse(classified)
      : null;
    if (classifiedResponse) return classifiedResponse;

    if (error instanceof ChatNotFoundError) {
      return new Response("Not Found", { status: 404 });
    }

    // Unclassified errors are server faults: log everything, expose nothing.
    logger.error(
      "[Chat API] Request failed",
      error instanceof Error ? error : new Error(String(error)),
      { chatId },
      userId,
    );
    return Response.json(
      { error: "An internal error occurred." },
      { status: 500 },
    );
  }
}
