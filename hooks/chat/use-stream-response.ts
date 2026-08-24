"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "@ai-sdk/react";
import { persistMessage } from "@/lib/actions/chats/persist-message";
import { resolveMcpPrompt } from "@/lib/chat/resolve-mcp-prompt";
import { resolveSlashPrompt } from "@/lib/chat/resolve-slash-prompt";
import { processAttachments } from "@/lib/chat/attachments/process-attachments";
import { useAppStore } from "@/lib/store";
import type { Attachment } from "@/types/attachment/attachment";
import type { ToolCallState } from "@/types/tool/tool-call";
import { PROMPTS } from "@/constants/prompts";
import { useCallback, useMemo, useRef, useEffect, useState } from "react";
import { toast } from "sonner";
import { useApiError } from "@/hooks/use-api-error";

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
function activeToolCallsFrom(
  message: UIMessage | undefined,
): ToolCallState[] {
  if (!message) return [];
  return message.parts.flatMap((p) => {
    const part = p as any;
    if (part.type !== "dynamic-tool" && !part.type?.startsWith?.("tool-")) {
      return [];
    }
    const state = part.state ?? "input-available";
    return [
      {
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        args: part.input,
        status: state === "output-available" ? "complete" : "calling",
        result: part.output,
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
    parentId: string | null;
    model: string;
  }>({ parentId: null, model: "" });

  // ponytail: @ai-sdk/react bundles its own copy of `ai` types, so strict
  // typing of the transport boundary fights duplicated type identity. The
  // transport's runtime behaviour is covered by tests instead. State-lazy
  // init keeps the transport identity stable without touching refs in render.
  const [transport] = useState<any>(() => new DefaultChatTransport({
    api: "/api/chat",
    // Identifier-only body — the server rebuilds history from the DB.
    prepareSendMessagesRequest: async ({ body }) => ({ body: body ?? {} }),
  }));

  const chat = useChat<UIMessage>({
    id: chatId,
    transport,
    onError: (error) => {
      console.error("Stream error:", error);
      toast.error(error.message || "Failed to generate response");
    },
    onFinish: async ({ message, isAbort, isError }) => {
      if (isError || isAbort) return;

      const text = partsText(message, "text");
      const reasoning = partsText(message, "reasoning");
      if (!text && !reasoning) return;

      const completedTools = activeToolCallsFrom(message).filter(
        (tc) => tc.status === "complete",
      );
      const metadata = JSON.stringify({
        model: pendingRef.current.model,
        reasoning,
        toolCalls: completedTools.map((tc) => ({
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          args: JSON.stringify(tc.args),
        })),
        toolResults: completedTools
          .filter((tc) => tc.result !== undefined)
          .map((tc) => ({
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            result: JSON.stringify(tc.result),
          })),
      });

      addMessage(
        chatId,
        "assistant",
        text,
        pendingRef.current.parentId,
        message.id,
        metadata,
        undefined,
        reasoning || undefined,
      );
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

  const isLoading = status === "submitted" || status === "streaming";
  const streamingReasoning =
    status === "ready" ? null : partsText(lastAssistant, "reasoning") || null;
  const streamingContent =
    status === "ready" ? null : partsText(lastAssistant, "text") || null;
  const isStreamingReasoning =
    status !== "ready" && !!streamingReasoning && !streamingContent;
  const activeToolCalls =
    status === "ready" ? [] : activeToolCallsFrom(lastAssistant);

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
  ): Promise<string> => {
    pendingRef.current = { parentId, model };

    // 1. Build metadata object
    const metadataObj = buildMetadata(
      model,
      selectedServerIds,
      selectedTools,
      selectedAssistantId,
      selectedKbIds,
    );

    // 2. Resolve prompt content (MCP / slash-command)
    const { fullContent } = await resolveContent(
      content,
      selectedPromptId,
      metadataObj,
    );
    const userMsgMetadata = JSON.stringify(metadataObj);

    // 3. Optimistic store insert
    addMessage(
      chatId,
      "user",
      fullContent,
      parentId,
      userMsgId,
      userMsgMetadata,
      attachments,
    );

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
      toast.error("Message may not have been saved. Please check your connection.");
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
