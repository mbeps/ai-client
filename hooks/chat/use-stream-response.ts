"use client";

import { uploadAttachment } from "@/lib/actions/attachments/upload-attachment";
import { persistMessage } from "@/lib/actions/chats/persist-message";
import { reconstructThread } from "@/lib/chat/reconstruct-thread";
import { parseSseStream } from "@/lib/chat/parse-sse-stream";
import { useAppStore } from "@/lib/store";
import type { Attachment } from "@/types/attachment/attachment";
import type { ToolCallState } from "@/types/tool/tool-call";
import { PROMPTS } from "@/constants/prompts";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useApiError } from "@/hooks/use-api-error";

/**
 * Manages AI response streaming with tool integration and artifact generation.
 * Handles message persistence, attachment uploads, AI stream parsing (SSE protocol),
 * tool call tracking, reasoning token collection, and artifact detection.
 * Automatically creates message tree nodes and updates store optimistically.
 * Supports abort via stopStream() and integrates with useAppStore for state sync.
 *
 * @param chatId - Target chat session ID for message persistence.
 * @param options - Optional callbacks for completion and artifact discovery.
 * @returns Object with loading state, streaming content, tool calls, and streamResponse function.
 * @see ToolCallState for tool invocation tracking.
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

  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [streamingReasoning, setStreamingReasoning] = useState<string | null>(
    null,
  );
  const [isStreamingReasoning, setIsStreamingReasoning] = useState(false);
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCallState[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStream = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

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
   * @author Maruf Bepary
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
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let fullContent = content;
    const metadataObj: any = {
      model,
      selectedServerIds,
      selectedTools,
    };

    if (selectedAssistantId) {
      metadataObj.assistantId = selectedAssistantId;
    }

    if (selectedKbIds.length > 0) {
      metadataObj.selectedKbIds = selectedKbIds;
    }

    if (selectedPromptId) {
      if (selectedPromptId.startsWith("mcp:")) {
        const parts = selectedPromptId.split(":");
        const serverId = parts[1];
        const promptName = parts.slice(2).join(":");

        try {
          const { getMcpPrompt } =
            await import("@/lib/actions/mcp/get-mcp-prompt");
          const mcpPromptResult = await getMcpPrompt(serverId, promptName);
          const mcpContent = (mcpPromptResult as any).messages
            .map((m: any) => {
              if (typeof m.content === "string") return m.content;
              if (m.content?.type === "text") return m.content.text;
              if (m.content?.text) return m.content.text;
              return "";
            })
            .join("\n\n");

          fullContent =
            mcpContent + PROMPTS.COMPOSITION.SLASH_PROMPT_SEPARATOR + content;
          metadataObj.promptId = selectedPromptId;
          metadataObj.userContent = content;
        } catch (err) {
          console.error("Failed to load MCP prompt:", err);
          toast.error("Failed to load MCP prompt. Sending message without it.");
        }
      } else {
        const prompts = useAppStore.getState().prompts;
        const selectedPrompt = prompts.find((p) => p.id === selectedPromptId);
        if (selectedPrompt) {
          fullContent =
            selectedPrompt.content +
            PROMPTS.COMPOSITION.SLASH_PROMPT_SEPARATOR +
            content;
          metadataObj.promptId = selectedPromptId;
          metadataObj.userContent = content;
        }
      }
    }

    const userMsgMetadata = JSON.stringify(metadataObj);

    addMessage(
      chatId,
      "user",
      fullContent,
      parentId,
      userMsgId,
      userMsgMetadata,
      attachments,
    );

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

    // Upload attachments to server
    const uploadedAttachments: Attachment[] = [];
    for (const att of attachments) {
      try {
        const formData = new FormData();
        let blob: Blob;
        if (att.rawFile) {
          blob = att.rawFile;
        } else {
          const response = await fetch(att.dataUrl);
          blob = await response.blob();
        }
        const file = new File([blob], att.name, { type: att.mimeType });
        formData.append("file", file);
        formData.append("messageId", userMsgId);
        formData.append("attachmentId", att.id);

        const data = await uploadAttachment(formData);
        // Keep the original client-side att.id so it matches the store entry.
        uploadedAttachments.push({ ...att, key: data.key });
      } catch (err) {
        console.error("[Chat] Attachment upload failed:", err);
        toast.error(
          `Failed to upload "${att.name}". It will not be sent to the AI.`,
        );
      }
    }

    if (uploadedAttachments.length > 0) {
      updateMessageAttachments(chatId, userMsgId, uploadedAttachments);
    }

    const latestChat = useAppStore.getState().chats[chatId];
    let latestThread = latestChat?.currentLeafId
      ? reconstructThread(latestChat.messages, latestChat.currentLeafId)
      : [];

    // Fallback logic: Ensure the current user message is included in the history.
    // This handles the race condition where addMessage hasn't fully updated the leaf ID
    // or when starting a brand new chat.
    if (!latestThread.some((m) => m.id === userMsgId)) {
      const currentMsg = latestChat?.messages[userMsgId] || {
        id: userMsgId,
        role: "user" as const,
        content: fullContent,
        metadata: userMsgMetadata,
        attachments: attachments,
      };
      // For a new chat, latestThread might be empty. For an edit/branch, it might have prefix history.
      latestThread = [...latestThread, currentMsg as any];
    }

    const history = latestThread.map((m) => ({
      role: m.role,
      content: m.content,
      attachments: m.attachments?.map((att) => ({
        id: att.id,
        type: att.type,
        dataUrl: att.dataUrl,
        name: att.name,
        mimeType: att.mimeType,
        extractedText: att.extractedText,
        key: att.key,
      })),
      metadata: m.metadata,
    }));

    let accumulated = "";
    let accumulatedReasoning = "";
    const pendingNewAttachments: Attachment[] = [];

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          userMessageId: userMsgId,
          messages: history,
          model,
          selectedServerIds,
          selectedTools,
          selectedAssistantId,
          selectedKbIds,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        if (response.status === 429) {
          toast.error("Too many requests. Please try again later.");
          throw new Error("Rate limit exceeded");
        }
        if (response.status === 401) {
          toast.error("Your session has expired. Please log in again.");
          throw new Error("Unauthorized");
        }
        const errorData = await response.json().catch(() => ({}));
        const err = new Error(
          errorData.error || "Stream request failed",
        ) as any;
        err.code = errorData.code;
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

          if (pendingNewAttachments.length > 0) {
            updateMessageAttachments(chatId, event.id, pendingNewAttachments);
          }

          options?.onDone?.(accumulated);
          return accumulated; // Return the full content for any post-processing
        } else if (event.type === "error") {
          setStreamingContent(null);
          setActiveToolCalls([]);

          if (!handleApiError(event)) {
            toast.error(event.message || "An error occurred during generation");
          }

          addMessage(
            chatId,
            "assistant",
            event.message ||
              "Sorry, I couldn't generate a response. Please try again.",
            userMsgId,
          );
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
