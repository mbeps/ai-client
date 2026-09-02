"use client";

import type { UIMessage } from "@ai-sdk/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PROMPTS } from "@/constants/prompts";
import { useApiError } from "@/hooks/use-api-error";
import { persistMessage } from "@/lib/actions/chats/persist-message";
import { processAttachments } from "@/lib/chat/attachments/process-attachments";
import { resolveMcpPrompt } from "@/lib/chat/resolve-mcp-prompt";
import { resolveSlashPrompt } from "@/lib/chat/resolve-slash-prompt";
import { useAppStore } from "@/lib/store";
import type { Attachment } from "@/types/attachment/attachment";
import type { ToolCallState } from "@/types/tool/tool-call";

/**
 * Extracts concatenated text of a given part type from a UI message.
 * @author Maruf Bepary
 */
function partsText(message: UIMessage | undefined, type: string): string {
  if (!message) return "";
  return message.parts
    .filter((p): p is any => p.type === type)
    .map((p) => (p as any).text ?? "")
    .join("");
}

/**
 * Maps streaming tool parts to the ToolCallState shape the rendering tree uses.
 * @author Maruf Bepary
 */
function activeToolCallsFrom(message: UIMessage | undefined): ToolCallState[] {
  if (!message) return [];
  return message.parts.flatMap((p) => {
    const part = p as any;
    if (
      part.type !== "dynamic-tool" &&
      !part.type?.startsWith?.("tool-") &&
      part.type !== "tool-invocation"
    ) {
      return [];
    }
    const invocation = part.toolInvocation ?? part;
    const toolCallId = invocation.toolCallId ?? part.toolCallId;
    const toolName =
      invocation.toolName ??
      part.toolName ??
      (typeof part.type === "string" && part.type.startsWith("tool-")
        ? part.type.slice(5)
        : "");
    const args = invocation.args ?? invocation.input ?? part.args ?? part.input;
    const result =
      invocation.result ?? invocation.output ?? part.result ?? part.output;
    const hasResult = result !== undefined;
    const state =
      part.state ??
      invocation.state ??
      (hasResult ? "output-available" : "input-available");
    const isComplete =
      state === "output-available" || state === "result" || hasResult;
    return [
      {
        toolCallId,
        toolName,
        args,
        status: isComplete ? "complete" : "calling",
        result,
      } as ToolCallState,
    ];
  });
}

/**
 * Builds the metadata object for the user message, tracking model, tools, and prompt info.
 * @author Maruf Bepary
 */
function buildMetadata(
  model: string,
  selectedServerIds: string[],
  selectedTools: string[],
  selectedAssistantId?: string,
  selectedKbIds?: string[],
  selectedSkillIds?: string[],
): Record<string, unknown> {
  const metadataObj: Record<string, unknown> = {
    model,
    selectedServerIds,
    selectedTools,
  };
  if (selectedAssistantId) metadataObj.assistantId = selectedAssistantId;
  if (selectedKbIds && selectedKbIds.length > 0) {
    metadataObj.selectedKbIds = selectedKbIds;
  }
  if (selectedSkillIds && selectedSkillIds.length > 0) {
    metadataObj.selectedSkillIds = selectedSkillIds;
  }
  return metadataObj;
}

/**
 * Resolves the final message content by handling MCP prompts and slash-command prompts.
 * @author Maruf Bepary
 */
async function resolveContent(
  content: string,
  selectedPromptId?: string,
  metadataObj?: Record<string, unknown>,
): Promise<{ fullContent: string }> {
  const meta = metadataObj ?? {};
  if (!selectedPromptId) return { fullContent: content };

  if (selectedPromptId.startsWith("mcp:")) {
    const parts = selectedPromptId.split(":");
    const serverId = parts[1];
    const promptName = parts.slice(2).join(":");

    try {
      const mcpContent = await resolveMcpPrompt(serverId, promptName);
      meta.promptId = selectedPromptId;
      meta.userContent = content;
      return {
        fullContent:
          mcpContent + PROMPTS.COMPOSITION.SLASH_PROMPT_SEPARATOR + content,
      };
    } catch (err) {
      console.error("Failed to load MCP prompt:", err);
      toast.error("Failed to load MCP prompt. Sending message without it.");
      return { fullContent: content };
    }
  }

  const prompts = useAppStore.getState().prompts;
  const { fullContent, metadata } = resolveSlashPrompt(
    selectedPromptId,
    content,
    prompts,
  );
  Object.assign(meta, metadata);
  return { fullContent };
}

interface StreamRequestOptions {
  chatId: string;
  userMessageId: string;
  model?: string;
  selectedServerIds?: string[];
  selectedTools?: string[];
  selectedAssistantId?: string;
  selectedSkillIds?: string[];
  selectedKbIds?: string[];
}

/**
 * Orchestrates AI response streaming over the AI SDK `useChat` hook.
 *
 * The server reconstructs history from the database, so only identifiers are
 * sent (`chatId`, `userMessageId`, selections) — never message content.
 * Sequencing contract: the optimistic Zustand insert happens immediately, but
 * the API call waits for `persistMessage` so `userMessageId` always refers to
 * a committed DB row. On stream finish, the assistant message is synced into
 * the store using the server-assigned id carried by the `start` chunk.
 *
 * @param chatId - Target chat session ID for message persistence.
 * @param options - Optional callbacks: onDone invoked with final content string on stream completion.
 * @returns isLoading, streaming content/reasoning/tool-call state, streamResponse, stopStream.
 * @see ChatUI for the primary consumer.
 * @author Maruf Bepary
 */
export function useStreamResponse(
  chatId: string,
  options?: {
    onDone?: (content: string) => void;
  },
) {
  const { handleApiError } = useApiError();
  const addMessage = useAppStore((state) => state.addMessage);
  const updateMessageAttachments = useAppStore(
    (state) => state.updateMessageAttachments,
  );

  // Mutable per-request context read by onFinish without re-creating the
  // transport — keeps the useChat instance stable across renders.
  const pendingRef = useRef<{
    userMessageId: string | null;
    model: string;
    startTime: number;
  }>({ userMessageId: null, model: "", startTime: 0 });

  // ponytail: @ai-sdk/react bundles its own copy of `ai` types, so strict
  // typing of the transport boundary fights duplicated type identity. The
  // transport's runtime behaviour is covered by tests instead. State-lazy
  // init keeps the transport identity stable without touching refs in render.
  const [transport] = useState<any>(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        // Identifier-only body — the server rebuilds history from the DB.
        prepareSendMessagesRequest: async ({ body }) => ({ body: body ?? {} }),
      }),
  );

  const chat = useChat<UIMessage>({
    id: chatId,
    transport,
    onError: (error) => {
      console.error("Stream error:", error);
      toast.error(error.message || "Failed to generate response");
    },
    // useChat's chat-level callback is still `onFinish` in @ai-sdk/react 4.x
    // (only streamText/generateText renamed to onEnd).
    onFinish: async ({ message, isError, finishReason }) => {
      if (isError) return;

      const text = partsText(message, "text");
      const reasoning = partsText(message, "reasoning");
      const completedTools = activeToolCallsFrom(message).filter(
        (tc) => tc.status === "complete",
      );

      // On abort or normal finish, persist if there is text, reasoning, or completed tools
      if (!text && !reasoning && completedTools.length === 0) return;

      const msgMeta = (message as any).metadata;
      const usage = msgMeta?.usage;
      const resolvedFinishReason = finishReason ?? msgMeta?.finishReason;
      const durationMs =
        pendingRef.current.startTime > 0
          ? Date.now() - pendingRef.current.startTime
          : undefined;

      const metadata = JSON.stringify({
        model: pendingRef.current.model,
        reasoning,
        toolCalls: completedTools.map((tc) => ({
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          args: tc.args,
        })),
        toolResults: completedTools
          .filter((tc) => tc.result !== undefined)
          .map((tc) => ({
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            result: tc.result,
          })),
        usage,
        finishReason: resolvedFinishReason,
        durationMs,
      });

      addMessage(chatId, {
        role: "assistant",
        content: text,
        parentId: pendingRef.current.userMessageId,
        id: message.id,
        metadata,
        reasoning: reasoning || undefined,
      });
      options?.onDone?.(text);
    },
  });

  const { messages, status, sendMessage, stop } = chat;

  // Streaming view-state derived from the SDK hook (no duplicate local state).
  const lastAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i];
    }
    return undefined;
  }, [messages]);

  const isStreaming = status === "submitted" || status === "streaming";
  const isLoading = isStreaming;
  const streamingReasoning = isStreaming
    ? partsText(lastAssistant, "reasoning") || null
    : null;
  const streamingContent = isStreaming
    ? partsText(lastAssistant, "text") || null
    : null;
  const isStreamingReasoning =
    isStreaming && !!streamingReasoning && !streamingContent;
  const activeToolCalls = isStreaming ? activeToolCallsFrom(lastAssistant) : [];

  const stopStream = useCallback(() => stop(), [stop]);

  // Abort in-flight requests on unmount.
  useEffect(() => () => void stop(), [stop]);

  /**
   * Streams an AI response for a given user message and persists it to the store and database.
   *
   * @param userMsgId - UUID of the user message triggering this stream.
   * @param content - User's message content (plain text).
   * @param parentId - Optional parent message ID for branching conversations.
   * @param attachments - Optional array of file attachments.
   * @param model - AI model to use (backend falls back to provider default when empty).
   * @param selectedServerIds - Optional array of MCP server IDs to enable for tools.
   * @param selectedTools - Optional array of tool identifiers to make available to the AI.
   * @param selectedPromptId - Optional slash-command prompt ID to prepend to content.
   * @returns The complete accumulated AI response text on success, or "" on failure/abort.
   * @see processAttachments for file upload details.
   */
  const streamResponse = async (
    userMsgId: string,
    content: string,
    parentId: string | null,
    attachments: Attachment[] = [],
    model = "",
    selectedServerIds: string[] = [],
    selectedTools: string[] = [],
    selectedPromptId?: string,
    selectedAssistantId?: string,
    selectedKbIds: string[] = [],
    selectedSkillIds: string[] = [],
  ): Promise<string> => {
    pendingRef.current = {
      userMessageId: userMsgId,
      model,
      startTime: Date.now(),
    };

    // 1. Build metadata object
    const metadataObj = buildMetadata(
      model,
      selectedServerIds,
      selectedTools,
      selectedAssistantId,
      selectedKbIds,
      selectedSkillIds,
    );

    // 2. Resolve prompt content (MCP / slash-command)
    const { fullContent } = await resolveContent(
      content,
      selectedPromptId,
      metadataObj,
    );
    const userMsgMetadata = JSON.stringify(metadataObj);

    // 3. Optimistic store insert
    addMessage(chatId, {
      role: "user",
      content: fullContent,
      parentId,
      id: userMsgId,
      metadata: userMsgMetadata,
      attachments,
    });

    // 4. Persist BEFORE the API call — the server reads this row to rebuild
    //    the thread; a missing row would silently truncate context.
    try {
      await persistMessage(chatId, {
        id: userMsgId,
        role: "user",
        content: fullContent,
        parentId,
        metadata: userMsgMetadata ?? undefined,
      });
    } catch (err) {
      console.error("Failed to persist message:", err);
      toast.error(
        "Message may not have been saved. Please check your connection.",
      );
    }

    // 5. Upload attachments
    const uploadedAttachments = await processAttachments(
      attachments,
      userMsgId,
    );
    if (uploadedAttachments.length > 0) {
      updateMessageAttachments(chatId, userMsgId, uploadedAttachments);
    }

    // 6. Trigger the SDK request with an identifier-only body
    try {
      await sendMessage(
        { text: fullContent },
        {
          body: {
            chatId,
            userMessageId: userMsgId,
            model,
            selectedServerIds,
            selectedTools,
            selectedAssistantId,
            selectedSkillIds,
            selectedKbIds,
          } satisfies StreamRequestOptions,
        },
      );
    } catch (err: any) {
      if (!handleApiError(err)) {
        toast.error(err.message || "Failed to generate response");
      }
    }

    // ponytail: the closure's `messages` is stale at this point (sendMessage
    // resolves before the next render). No caller uses the return value today;
    // upgrade path: expose a live selector from the SDK state.
    return "";
  };

  return {
    isLoading,
    streamingContent,
    streamingReasoning,
    isStreamingReasoning,
    activeToolCalls,
    streamResponse,
    stopStream,
  };
}
