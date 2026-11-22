import { generateText } from "ai";
import { eq } from "drizzle-orm";
import { PROMPTS } from "@/config/prompts";
import { db } from "@/drizzle/db";
import { chat, message } from "@/drizzle/schemas/chat-schema";
import type { buildResolvedProvider } from "@/lib/chat/build-resolved-provider";
import { estimateTokens } from "@/lib/chat/estimate-tokens";
import type { ThreadMessage } from "@/lib/chat/load-thread-from-db";
import { parseMessageMetadata } from "@/lib/chat/parse-message-metadata";
import { sliceThreadFromLatestCompaction } from "@/lib/chat/slice-thread-from-compaction";
import { AppException } from "@/lib/error/app-exception";
import { ERROR_CODE } from "@/lib/error/error-code";

type ResolvedProvider = ReturnType<typeof buildResolvedProvider>;

const MAX_TOOL_OUTPUT_CHARS = 1500;
const TRANSCRIPT_CONTEXT_RATIO = 0.7;

/**
 * Formats a single thread message into a bounded, human-readable transcript block
 * for compaction summarization, stripping binary/base64 attachment payloads.
 *
 * @param msg - Thread message to format
 * @returns Formatted transcript string
 * @author Maruf Bepary
 */
function formatMessageForTranscript(msg: ThreadMessage): string {
  const roleLabel = msg.role.toUpperCase();
  const parts: string[] = [];

  if (msg.content.trim()) {
    parts.push(msg.content.trim());
  }

  if (msg.attachments && msg.attachments.length > 0) {
    const names = msg.attachments
      .map((a) => `[Attachment: ${a.name || a.type}]`)
      .join(" ");
    parts.push(names);
  }

  const meta = parseMessageMetadata(msg.metadata);
  if (meta.toolData?.toolCalls && meta.toolData.toolCalls.length > 0) {
    const toolSummary = meta.toolData.toolCalls
      .map((tc) => {
        const result = meta.toolData?.toolResults.find(
          (tr) => tr.toolCallId === tc.toolCallId,
        );
        const resultStr = result
          ? JSON.stringify(result.result ?? "").slice(0, MAX_TOOL_OUTPUT_CHARS)
          : "";
        return `[Tool ${tc.toolName}${resultStr ? `: ${resultStr}` : ""}]`;
      })
      .join("\n");
    parts.push(toolSummary);
  }

  return `${roleLabel}:\n${parts.join("\n")}`;
}

/**
 * Builds a transcript from messages, bounding total tokens within the model's
 * summarization budget by dropping oldest turns if needed.
 *
 * @param messages - Messages to compact
 * @param maxTokens - Maximum token budget for the transcript
 * @returns Bounded transcript string
 * @author Maruf Bepary
 */
function buildBoundedTranscript(
  messages: ThreadMessage[],
  maxTokens: number,
): string {
  const formatted = messages.map(formatMessageForTranscript);
  let totalTokens = 0;
  const kept: string[] = [];

  for (let i = formatted.length - 1; i >= 0; i--) {
    const tokens = estimateTokens(formatted[i]);
    if (kept.length > 0 && totalTokens + tokens > maxTokens) {
      break;
    }
    kept.unshift(formatted[i]);
    totalTokens += tokens;
  }

  return kept.join("\n\n---\n\n");
}

/**
 * Summarizes older conversation turns into a persisted `role: "system"`
 * compaction checkpoint node in the message tree.
 *
 * @param params - Compaction parameters
 * @returns Inserted checkpoint message row and token/count metrics
 * @author Maruf Bepary
 */
export async function compactChatThread(params: {
  chatId: string;
  userId: string;
  thread: ThreadMessage[];
  resolved: ResolvedProvider;
  auto?: boolean;
  reparentUserMessageId?: string;
  minMessagesToCompact?: number;
}) {
  const {
    chatId,
    thread,
    resolved,
    auto = false,
    reparentUserMessageId,
    minMessagesToCompact = 2,
  } = params;

  const { compactionSummary: previousSummary, activeMessages } =
    sliceThreadFromLatestCompaction(thread);

  const trailingMsg = reparentUserMessageId
    ? (activeMessages.find((m) => m.id === reparentUserMessageId) ??
      activeMessages.at(-1))
    : undefined;

  const messagesToCompact = reparentUserMessageId
    ? activeMessages.filter((m) => m.id !== reparentUserMessageId)
    : activeMessages;

  if (messagesToCompact.length < minMessagesToCompact) {
    throw new AppException({
      code: ERROR_CODE.INVALID_INPUT,
      message: "Not Enough Messages To Compact",
    });
  }

  const parentId = reparentUserMessageId
    ? (trailingMsg?.parentId ?? messagesToCompact.at(-1)?.id ?? null)
    : (messagesToCompact.at(-1)?.id ?? null);

  const contextWindow = resolved.modelRow?.contextWindow || 128_000;
  const maxTranscriptTokens = Math.floor(
    contextWindow * TRANSCRIPT_CONTEXT_RATIO,
  );
  const transcript = buildBoundedTranscript(
    messagesToCompact,
    maxTranscriptTokens,
  );
  const originalTokens =
    estimateTokens(transcript) +
    (previousSummary ? estimateTokens(previousSummary) : 0);

  const { text } = await generateText({
    model: resolved.sdkProvider.chat(resolved.modelId),
    system: PROMPTS.COMPACTION.SYSTEM,
    prompt: PROMPTS.COMPACTION.PROMPT(transcript, previousSummary),
  });

  const summary = text.trim();
  if (!summary) {
    throw new AppException({
      code: ERROR_CODE.UPSTREAM_HTTP,
      message: "Failed to generate compaction summary",
    });
  }

  const compactedTokens = estimateTokens(summary);
  const checkpointId = crypto.randomUUID();
  const metadata = JSON.stringify({
    compaction: {
      compactedCount: messagesToCompact.length,
      originalTokens,
      compactedTokens,
      model: resolved.modelId,
      auto,
    },
  });

  const inserted = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(message)
      .values({
        id: checkpointId,
        chatId,
        parentId,
        role: "system",
        content: summary,
        metadata,
      })
      .returning();

    if (reparentUserMessageId) {
      await tx
        .update(message)
        .set({ parentId: checkpointId })
        .where(eq(message.id, reparentUserMessageId));
    } else {
      await tx
        .update(chat)
        .set({ currentLeafId: checkpointId, updatedAt: new Date() })
        .where(eq(chat.id, chatId));
    }

    return row;
  });

  return {
    message: inserted,
    compactedCount: messagesToCompact.length,
    originalTokens,
    compactedTokens,
    summary,
  };
}
