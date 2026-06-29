"use client";

import { persistMessage } from "@/lib/actions/chats/persist-message";
import { reconstructThread } from "@/lib/chat/reconstruct-thread";
import { parseSseStream } from "@/lib/chat/parse-sse-stream";
import { buildStreamRequestBody } from "@/lib/chat/build-stream-request-body";
import {
  resolveMcpPrompt,
  resolveSlashPrompt,
} from "@/lib/chat/resolve-stream-prompts";
import { processAttachments } from "@/lib/chat/upload-attachments";
import { useAppStore } from "@/lib/store";
import type { Attachment } from "@/types/attachment/attachment";
import type { ToolCallState } from "@/types/tool/tool-call";
import { PROMPTS } from "@/constants/prompts";
import { useCallback, useRef, useEffect, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useApiError } from "@/hooks/use-api-error";
import {
  RATE_LIMIT_ERROR_CODE,
  UNAUTHORIZED_ERROR_CODE,
} from "@/lib/constants/errors";

/**
 * Orchestrates AI response streaming with message persistence, tool integration, and artifact detection.
 * Handles SSE (Server-Sent Events) parsing, attachment uploads, message tree creation, and store updates.
 * Tracks tool call state (calling -> completed/failed) and reasoning token collection.
 * Manages AbortController for stream cancellation; deduplicates tool calls by ID.
 *
 * Side effects: Persists messages to database, uploads attachments to storage, updates Zustand store,
 * calls onDone callback on stream completion, handles API errors via useApiError.
 * Use case: Chat input submission, AI response generation with tool use and reasoning.
 * Constraint: AbortController cleaned up on unmount; stopStream() must be called for graceful cancellation.
 *
 * @param chatId - Target chat session ID for message persistence.
 * @param options - Optional callbacks: onDone invoked with final content string on stream completion.
 * @returns Object with isLoading state, streamingContent, activeToolCalls, streamResponse function for submission.
 * @throws Errors from API are handled via handleApiError toast; stopStream() prevents recovery.
 * @see useApiError for error handling and navigation on auth failures.
 * @see buildStreamRequestBody for request body construction.
 * @see parseSseStream for SSE parsing implementation.
 * @author Maruf Bepary
 */
export function useStreamResponse(
  chatId: string,
  options?: {
    onDone?: (content: string) => void;
  },
) {
  const router = useRouter();
  const { handleApiError } = useApiError();
  const addMessage = useAppStore((state) => state.addMessage);
  const updateMessageAttachments = useAppStore(
    (state) => state.updateMessageAttachments,
  );

  // Streaming state management (inlined from useStreamState)
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [streamingReasoning, setStreamingReasoning] = useState<string | null>(
    null,
  );
  const [isStreamingReasoning, setIsStreamingReasoning] = useState(false);

  // Tool call tracking (inlined from useToolCalls)
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCallState[]>([]);

  const addToolCall = useCallback(
    (toolCallId: string, toolName: string, args?: unknown) => {
      setActiveToolCalls((prev) => [
        ...prev,
        { toolCallId, toolName, args, status: "calling" },
      ]);
    },
    [],
  );

  const updateToolCall = useCallback(
    (
      toolCallId: string,
      updates: Partial<Pick<ToolCallState, "status" | "result">>,
    ) => {
      setActiveToolCalls((prev) =>
        prev.map((tc) =>
          tc.toolCallId === toolCallId ? { ...tc, ...updates } : tc,
        ),
      );
    },
    [],
  );

  const clearToolCalls = useCallback(() => {
    setActiveToolCalls([]);
  }, []);

  // AbortController management (inlined from useStreamAbort)
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStream = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const setAbortController = useCallback((controller: AbortController) => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = controller;
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  /**
   * Builds the metadata object for the user message, tracking model, tools, and prompt info.
   */
  const buildMetadata = (
    model: string,
    selectedServerIds: string[],
    selectedTools: string[],
    selectedAssistantId?: string,
    selectedKbIds?: string[],
    selectedPromptId?: string,
  ): Record<string, unknown> => {
    const metadataObj: Record<string, unknown> = {
      model,
      selectedServerIds,
      selectedTools,
    };

    if (selectedAssistantId) {
      metadataObj.assistantId = selectedAssistantId;
    }

    if (selectedKbIds && selectedKbIds.length > 0) {
      metadataObj.selectedKbIds = selectedKbIds;
    }

    return metadataObj;
  };

  /**
   * Resolves the final message content by handling MCP prompts and slash-command prompts.
   */
  const resolveContent = async (
    content: string,
    selectedPromptId?: string,
    metadataObj?: Record<string, unknown>,
  ): Promise<{ fullContent: string }> => {
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
  };

  /**
   * Assembles the conversation history for the AI request.
   * Uses store state with a fallback for race conditions (new chats, un-flushed leaf updates).
   */
  const assembleHistory = (
    userMsgId: string,
    fullContent: string,
    userMsgMetadata: string | null,
    attachments: Attachment[],
  ) => {
    const latestChat = useAppStore.getState().chats[chatId];
    let latestThread = latestChat?.currentLeafId
      ? reconstructThread(latestChat.messages, latestChat.currentLeafId)
      : [];

    // Fallback: ensure the current user message is included when the store
    // hasn't fully flushed the leaf ID update (new chat or race condition).
    if (!latestThread.some((m) => m.id === userMsgId)) {
      const currentMsg = latestChat?.messages[userMsgId] || {
        id: userMsgId,
        role: "user" as const,
        content: fullContent,
        metadata: userMsgMetadata,
        attachments,
      };
      latestThread = [...latestThread, currentMsg as any];
    }

    return latestThread.map((m) => ({
      role: m.role,
      content: m.content,
      attachments: m.attachments,
      metadata: m.metadata ?? undefined,
    }));
  };

  /**
   * Streams an AI response for a given user message and persists it to the store and database.
   * Uploads attachments, reconstructs conversation thread, and streams response with tool calls and artifacts.
   * Shows toast notifications for errors; catches and logs network and parsing errors gracefully.
   *
   * @param userMsgId - UUID of the user message triggering this stream.
   * @param content - User's message content (plain text).
   * @param parentId - Optional parent message ID for branching conversations.
   * @param attachments - Optional array of file attachments (images, documents, spreadsheets).
   * @param model - AI model to use (defaults to empty string, backend falls back to provider default).
   * @param selectedServerIds - Optional array of MCP server IDs to enable for tools.
   * @param selectedTools - Optional array of tool identifiers to make available to the AI.
   * @param selectedPromptId - Optional slash-command prompt ID to prepend to content.
   * @returns The complete accumulated AI response text on successful stream completion, or accumulated partial text if aborted.
   * @throws Error when fetch fails (rate limit 429, auth failure 401, or generic stream error) — shows toast and throws.
   * @throws Error when message persistence fails (shows warning toast but continues streaming).
   * @throws AbortError when stream is cancelled via stopStream() — returns accumulated content without error.
   * @see uploadAttachment for file upload details and size limits.
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
  ) => {
    setIsLoading(true);
    const controller = new AbortController();
    setAbortController(controller);

    // 1. Build metadata object
    const metadataObj = buildMetadata(
      model,
      selectedServerIds,
      selectedTools,
      selectedAssistantId,
      selectedKbIds,
      selectedPromptId,
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

    // 4. Persist message (non-blocking for stream)
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

    // 6. Assemble conversation history
    const history = assembleHistory(
      userMsgId,
      fullContent,
      userMsgMetadata,
      attachments,
    );

    // 7. Stream the AI response
    let accumulated = "";
    let accumulatedReasoning = "";

    try {
      const requestBody = buildStreamRequestBody({
        chatId,
        userMessageId: userMsgId,
        messages: history,
        model,
        selectedServerIds,
        selectedTools,
        selectedAssistantId,
        selectedKbIds,
      });

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => ({}));
        const err = new Error(
          errorData.message || errorData.error || "Stream request failed",
        ) as any;
        err.code =
          errorData.code ||
          (response.status === 401
            ? UNAUTHORIZED_ERROR_CODE
            : response.status === 429
              ? RATE_LIMIT_ERROR_CODE
              : undefined);
        err.status = response.status;
        throw err;
      }

      for await (const event of parseSseStream(response.body)) {
        if (event.type === "reasoning" && event.delta) {
          accumulatedReasoning += event.delta;
          setStreamingReasoning(accumulatedReasoning);
          setIsStreamingReasoning(true);
        } else if (event.type === "text" && event.delta) {
          setIsStreamingReasoning(false);
          accumulated += event.delta;
          setStreamingContent(accumulated);
        } else if (
          event.type === "tool-call" &&
          event.toolCallId &&
          event.toolName
        ) {
          setIsStreamingReasoning(false);
          setActiveToolCalls((prev) => [
            ...prev,
            {
              toolCallId: event.toolCallId!,
              toolName: event.toolName!,
              args: event.args,
              status: "calling",
            },
          ]);
        } else if (event.type === "tool-result" && event.toolCallId) {
          setActiveToolCalls((prev) =>
            prev.map((tc) =>
              tc.toolCallId === event.toolCallId
                ? {
                    ...tc,
                    status: "complete" as const,
                    result: event.result,
                  }
                : tc,
            ),
          );
        } else if (event.type === "done" && event.id) {
          const metadata = event.metadata
            ? JSON.stringify(event.metadata)
            : null;
          addMessage(
            chatId,
            "assistant",
            accumulated,
            userMsgId,
            event.id,
            metadata,
            undefined,
            accumulatedReasoning || undefined,
          );

          // Reset streaming states
          setStreamingContent(null);
          setStreamingReasoning(null);
          setIsStreamingReasoning(false);
          setActiveToolCalls([]);

          options?.onDone?.(accumulated);
          return accumulated;
        } else if (event.type === "error") {
          const err = new Error(
            event.message || "An error occurred during generation",
          ) as any;
          err.code = event.code;
          throw err;
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        toast.info("Generation stopped");
        if (accumulated.trim()) {
          addMessage(
            chatId,
            "assistant",
            accumulated,
            userMsgId,
            undefined,
            null,
            undefined,
            accumulatedReasoning || undefined,
          );
        }
      } else {
        console.error("Stream error:", err);
        if (!handleApiError(err)) {
          toast.error(err.message || "Failed to generate response");
        }

        addMessage(
          chatId,
          "assistant",
          err.message ||
            "Sorry, I couldn't generate a response. Please try again.",
          userMsgId,
        );
      }
    } finally {
      abortControllerRef.current = null;
      setStreamingContent(null);
      setStreamingReasoning(null);
      setIsStreamingReasoning(false);
      setActiveToolCalls([]);
      setIsLoading(false);
    }
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
