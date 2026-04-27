"use client";

import { uploadAttachment } from "@/lib/actions/attachments";
import { persistMessage } from "@/lib/actions/chats/persist-message";
import { reconstructThread } from "@/lib/chat/tree-utils";
import { useAppStore } from "@/lib/store";
import { DEFAULT_MODEL } from "@/models";
import type { Attachment } from "@/types/attachment";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface ToolCallState {
  toolCallId: string;
  toolName: string;
  args: unknown;
  result?: unknown;
  status: "calling" | "complete";
}

export interface ArtifactData {
  type: "markdown" | "spreadsheet" | "html" | "mermaid";
  title: string;
  content: string;
  messageId?: string;
}

export function useStreamResponse(
  chatId: string,
  options?: {
    onDone?: (content: string) => void;
    onArtifact?: (artifact: ArtifactData) => void;
  },
) {
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

  const streamResponse = async (
    userMsgId: string,
    content: string,
    parentId: string | null,
    attachments: Attachment[] = [],
    model = DEFAULT_MODEL,
    selectedServerIds: string[] = [],
    selectedTools: string[] = [],
    selectedResources: string[] = [],
    selectedPromptId?: string,
  ) => {
    setIsLoading(true);
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let fullContent = content;
    let userMsgMetadata: string | null = null;

    if (selectedPromptId) {
      const prompts = useAppStore.getState().prompts;
      const selectedPrompt = prompts.find((p) => p.id === selectedPromptId);
      if (selectedPrompt) {
        fullContent = selectedPrompt.content + "\n\n" + content;
        userMsgMetadata = JSON.stringify({
          promptId: selectedPromptId,
          userContent: content,
        });
      }
    }

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
      } catch {
        // Upload failed silently
      }
    }

    if (uploadedAttachments.length > 0) {
      updateMessageAttachments(chatId, userMsgId, uploadedAttachments);
    }

    const latestChat = useAppStore.getState().chats[chatId];
    const latestThread = latestChat?.currentLeafId
      ? reconstructThread(latestChat.messages, latestChat.currentLeafId)
      : [];

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
          selectedResources,
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
        throw new Error(errorData.error || "Stream request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          try {
            const event = JSON.parse(trimmed.slice(6));

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
              if (event.toolName === "manage_artifact" && event.args) {
                try {
                  const parsedArgs =
                    typeof event.args === "string"
                      ? JSON.parse(event.args)
                      : event.args || {};

                  // Fallbacks for poor model compliance
                  const VALID_TYPES = [
                    "markdown",
                    "spreadsheet",
                    "html",
                    "mermaid",
                  ];
                  const artifactType = VALID_TYPES.includes(parsedArgs.type)
                    ? parsedArgs.type
                    : "markdown";
                  const artifactTitle =
                    parsedArgs.title || "Generated Artifact";
                  const artifactContent =
                    parsedArgs.content || parsedArgs.text || "";

                  if (artifactContent || artifactType) {
                    options?.onArtifact?.({
                      type: artifactType,
                      title: artifactTitle,
                      content: artifactContent,
                    } as ArtifactData);
                  }
                } catch (e) {
                  console.error("Failed to parse manage_artifact args", e);
                }
              }
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
            } else if (event.type === "file-modified" && event.attachmentId) {
              pendingNewAttachments.push({
                id: event.attachmentId,
                type: "spreadsheet" as const,
                name: event.name ?? "modified_file",
                mimeType: event.mimeType ?? "application/octet-stream",
                sizeBytes: event.size ?? 0,
                dataUrl: "",
              });
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
                updateMessageAttachments(
                  chatId,
                  event.id,
                  pendingNewAttachments,
                );
              }

              options?.onDone?.(accumulated);
              return accumulated; // Return the full content for any post-processing
            } else if (event.type === "error") {
              setStreamingContent(null);
              setActiveToolCalls([]);
              toast.error(
                event.message || "An error occurred during generation",
              );
              addMessage(
                chatId,
                "assistant",
                event.message ||
                  "Sorry, I couldn't generate a response. Please try again.",
                userMsgId,
              );
            }
          } catch (e) {
            console.error("Failed to parse event:", e, trimmed);
          }
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
        toast.error(err.message || "Failed to generate response");
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
