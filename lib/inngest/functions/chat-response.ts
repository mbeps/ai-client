import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { message } from "@/drizzle/schema";
import { buildApprovalResumeMessages } from "@/lib/chat/build-approval-resume";
import { chatAbortRegistry } from "@/lib/chat/chat-abort-registry";
import { parseMessageMetadata } from "@/lib/chat/parse-message-metadata";
import {
  persistAssistantResponse,
  updateAssistantResponse,
} from "@/lib/chat/persist-response";
import { runChatGeneration } from "@/lib/chat/run-chat-generation";
import { classifyProviderError } from "@/lib/error/classify-provider-error";
import { NotFoundError } from "@/lib/errors";
import { type ChatStreamEvent, chatChannel } from "@/lib/inngest/channels";
import { inngest } from "@/lib/inngest/client";
import { getLogger } from "@/lib/logger";
import type { ApprovalDecision, ApprovalMode } from "@/types/tool/approval";

const log = getLogger(["inngest", "chat", "response"]);

/** Generation starts either from a new message or from an approval verdict. */
const GENERATE_EVENT = "chat/response.generate";
const APPROVAL_EVENT = "chat/approval.respond";

/** Both events carry the same identity fields; only the extras differ. */
interface ChatRoundEventData {
  chatId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userMessageId: string;
  model?: string;
  approvalMode?: ApprovalMode;
  selectedServerIds?: string[];
  selectedTools?: string[];
  selectedAssistantId?: string;
  selectedSkillIds?: string[];
  selectedKbIds?: string[];
  assistantMessageId?: string;
  decisions?: ApprovalDecision[];
}

/**
 * Inngest durable function generating AI chat responses in the background.
 *
 * One body serves both triggers. `chat/response.generate` starts a fresh
 * round; `chat/approval.respond` resumes a round that parked on a tool
 * approval gate, rewriting the assistant row that round wrote so the thread
 * gains no second message.
 *
 * @author Maruf Bepary
 */
export const generateChatResponse = inngest.createFunction(
  {
    id: "generate-chat-response",
    retries: 0,
    triggers: [{ event: GENERATE_EVENT }, { event: APPROVAL_EVENT }],
    cancelOn: [
      {
        event: "chat/response.cancel",
        if: "async.data.chatId == event.data.chatId && async.data.userId == event.data.userId",
      },
    ],
  },
  async ({ event }) => {
    const data = event.data as ChatRoundEventData;
    const {
      chatId,
      userId,
      userName,
      userEmail,
      userMessageId,
      model,
      approvalMode,
      selectedServerIds,
      selectedTools,
      selectedAssistantId,
      selectedSkillIds,
      selectedKbIds,
    } = data;

    const isResume = event.name === APPROVAL_EVENT;
    const abortController = chatAbortRegistry.register(chatId);
    const ch = chatChannel({ chatId });

    const emit = async (streamEvent: ChatStreamEvent) => {
      if (abortController.signal.aborted) return;
      try {
        await inngest.realtime.publish(ch.stream, streamEvent);
      } catch (err) {
        log.warn("Failed to publish chat stream event to Inngest Realtime", {
          error: err instanceof Error ? err.message : String(err),
          type: streamEvent.type,
        });
      }
    };

    try {
      let assistantMessageId: string;
      let outcome: Awaited<ReturnType<typeof runChatGeneration>>;

      if (isResume) {
        assistantMessageId = data.assistantMessageId as string;
        const parked = await readParkedApproval(assistantMessageId, chatId);
        // The resume path reloads the tool selection from the user message
        // that started the turn. Without it no tool is registered, so the SDK
        // cannot execute the approval being answered.
        const selection = await readUserSelection(
          parked.parentUserMessageId,
          chatId,
        );
        // `start` is not emitted because the client already has the message.
        outcome = await runChatGeneration({
          userId,
          userName,
          userEmail,
          chatId,
          userMessageId: parked.parentUserMessageId,
          // The turn was started under the mode the user chose. Hardcoding
          // "ask" would re-gate every tool the user had already auto-approved.
          approvalMode: selection.approvalMode,
          model: selection.model,
          selectedServerIds: selection.selectedServerIds,
          selectedTools: selection.selectedTools,
          selectedSkillIds: selection.selectedSkillIds,
          selectedKbIds: selection.selectedKbIds,
          resumeMessages: buildApprovalResumeMessages(
            parked.pendingApprovals,
            data.decisions ?? [],
          ),
          previousRound: parked.approvalRound,
          abortSignal: abortController.signal,
          emit,
        });
      } else {
        assistantMessageId = crypto.randomUUID();
        await emit({ type: "start", messageId: assistantMessageId });
        outcome = await runChatGeneration({
          userId,
          userName,
          userEmail,
          chatId,
          userMessageId,
          model,
          // Fail closed: an absent mode must not mean "no gate".
          approvalMode: approvalMode ?? "ask",
          selectedServerIds,
          selectedTools,
          selectedAssistantId,
          selectedSkillIds,
          selectedKbIds,
          previousRound: 0,
          abortSignal: abortController.signal,
          emit,
        });
      }

      // Held as the narrowed value, not a boolean, so the parked fields type-check.
      const parked = outcome.kind === "awaiting-approval" ? outcome : null;
      // `model` is the raw request field and may be undefined. runChatGeneration
      // resolved the actual id and returned it, so persisted metadata names the
      // model that ran.
      const metadata = JSON.stringify({
        model: outcome.modelId,
        reasoning: outcome.reasoning,
        toolCalls: outcome.toolCalls,
        toolResults: outcome.toolResults,
        usage: outcome.usage,
        finishReason: outcome.finishReason,
        pendingApprovals: parked?.approvals ?? [],
        ...(parked
          ? { approvalRound: parked.round, parentUserMessageId: userMessageId }
          : {}),
      });

      // A resume rewrites the row the parked round wrote; a fresh round inserts.
      if (isResume) {
        await updateAssistantResponse({
          messageId: assistantMessageId,
          chatId,
          content: outcome.content,
          metadata,
        });
      } else {
        await persistAssistantResponse({
          chatId,
          assistantMessageId,
          content: outcome.content,
          parentId: userMessageId,
          metadata,
        });
      }

      if (parked) {
        log.info(
          "Chat paused for tool approval (chatId: {chatId}, round: {round})",
          { chatId, round: parked.round },
        );
        return;
      }

      await emit({
        type: "finish",
        finishReason: outcome.finishReason,
        usage: outcome.usage,
      });

      log.info(
        "Chat response successfully generated and persisted (chatId: {chatId}, messageId: {assistantMessageId})",
        { chatId, assistantMessageId },
      );
    } catch (error: unknown) {
      if (
        abortController.signal.aborted ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        log.info("Chat generation cleanly aborted by user (chatId: {chatId})", {
          chatId,
        });
        return;
      }
      const classified = classifyProviderError(error);
      const effectiveError = classified ?? error;
      const errorMsg =
        effectiveError instanceof Error
          ? effectiveError.message
          : "Generation failed";
      const errorCode = (effectiveError as unknown as { code?: string })?.code;
      log.error(
        "Chat generation failed in Inngest (chatId: {chatId}): {error}",
        { chatId, error: errorMsg },
      );
      await emit({ type: "error", message: errorMsg, code: errorCode });
      // Rethrown so Inngest records the run as failed rather than successful.
      throw error;
    } finally {
      chatAbortRegistry.delete(chatId);
    }
  },
);

/** Unresolved state a parked round needs in order to be resumed. */
interface ParkedApprovalState {
  pendingApprovals: ReturnType<typeof parseMessageMetadata>["pendingApprovals"];
  approvalRound: number;
  parentUserMessageId: string;
}

/**
 * Reads back the tool selection the parked round was started with.
 *
 * The resume event does not carry it, and `runChatGeneration` registers no
 * tools without it, so the SDK would have nothing to execute for the approval
 * being answered and the model would simply claim the tool ran. The selection
 * lives on the user message that started the turn.
 *
 * @param userMessageId - Row the parked round's parent must be.
 * @param chatId - Chat that row must belong to.
 * @returns The mode and selection fields, defaulting to nothing selected.
 */
async function readUserSelection(
  userMessageId: string,
  chatId: string,
): Promise<{
  model: string | undefined;
  approvalMode: ApprovalMode;
  selectedServerIds: string[];
  selectedTools: string[];
  selectedSkillIds: string[];
  selectedKbIds: string[];
}> {
  const [row] = await db
    .select({ metadata: message.metadata })
    .from(message)
    .where(and(eq(message.id, userMessageId), eq(message.chatId, chatId)));

  const meta = row ? parseMessageMetadata(row.metadata) : null;
  return {
    model: meta?.modelId ?? undefined,
    // Fail closed: a row predating the gate has no mode, and "ask" is the
    // safe default because it never grants an unapproved tool.
    approvalMode: meta?.approvalMode === "auto" ? "auto" : "ask",
    selectedServerIds: meta?.selectedServerIds ?? [],
    selectedTools: meta?.selectedTools ?? [],
    selectedSkillIds: meta?.selectedSkillIds ?? [],
    selectedKbIds: meta?.selectedKbIds ?? [],
  };
}

/**
 * Reads back the state the parked round persisted.
 *
 * @param assistantMessageId - Row the paused round wrote.
 * @param chatId - Chat that row must belong to.
 * @returns The pending approvals, the round consumed so far, and the parent id.
 * @throws {NotFoundError} When the row is gone, or when it has no parent user
 *   message. `runChatGeneration` loads the thread up to that id, so a missing
 *   one would truncate the thread and drop the approval pair being resumed.
 */
async function readParkedApproval(
  assistantMessageId: string,
  chatId: string,
): Promise<ParkedApprovalState> {
  const [row] = await db
    .select({ metadata: message.metadata })
    .from(message)
    .where(and(eq(message.id, assistantMessageId), eq(message.chatId, chatId)));

  if (!row) throw new NotFoundError("Message Not Found");

  const meta = parseMessageMetadata(row.metadata);
  if (!meta.parentUserMessageId) {
    throw new NotFoundError("Approval Context Not Found");
  }

  return {
    pendingApprovals: meta.pendingApprovals,
    approvalRound: meta.approvalRound,
    parentUserMessageId: meta.parentUserMessageId,
  };
}
