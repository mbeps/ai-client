"use client";

import { useAppStore, type Attachment } from "@/lib/store";
import { reconstructThread, getDeepestLeaf } from "@/lib/chat/tree-utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageBubble } from "./message-bubble";
import { ChatInput } from "./chat-input";
import { SideView } from "./side-view";
import { ScrollArea } from "@/components/ui/scroll-area";
import { v4 as uuidv4 } from "uuid";
import { persistMessage } from "@/lib/actions/chats/persist-message";
import { toast } from "sonner";
import { DEFAULT_MODEL } from "@/models";

/**
 * Props for the ChatUI component.
 *
 * @author Maruf Bepary
 */
interface ChatUIProps {
  /** The ID of the chat to display; used to look up the chat from the Zustand store. */
  chatId: string;
  /** Optional message to send automatically when the chat first loads (e.g. from dashboard). */
  initialMessage?: string;
  /** Called after the initial message has been sent, so the caller can clear it. */
  onInitialMessageSent?: () => void;
}

/**
 * Main chat view for a single conversation thread.
 * Reads the chat tree from the Zustand store, reconstructs the active thread via
 * `reconstructThread()`, and handles sending, editing, and deleting messages.
 * Opens the SideView panel when an AI response contains a Mermaid diagram block.
 *
 * @param props.chatId - The ID of the chat to display.
 * @author Maruf Bepary
 */
export function ChatUI({
  chatId,
  initialMessage,
  onInitialMessageSent,
}: ChatUIProps) {
  const chat = useAppStore((state) => state.chats[chatId]);
  const addMessage = useAppStore((state) => state.addMessage);
  const deleteMessageDb = useAppStore((state) => state.deleteMessageDb);
  const setCurrentLeafDb = useAppStore((state) => state.setCurrentLeafDb);
  const updateMessageAttachments = useAppStore(
    (state) => state.updateMessageAttachments,
  );
  const mcpServers = useAppStore((state) => state.mcpServers);
  const loadMcpServers = useAppStore((state) => state.loadMcpServers);

  const [sideViewContent, setSideViewContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [streamingReasoning, setStreamingReasoning] = useState<string | null>(
    null,
  );
  const [isStreamingReasoning, setIsStreamingReasoning] = useState(false);
  const [activeToolCalls, setActiveToolCalls] = useState<
    Array<{
      toolCallId: string;
      toolName: string;
      args: unknown;
      result?: unknown;
      status: "calling" | "complete";
    }>
  >([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (mcpServers.length === 0) {
      loadMcpServers().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-send the initial message once the chat is hydrated into Zustand
  useEffect(() => {
    if (initialMessage && chat && !sentInitial.current) {
      sentInitial.current = true;
      onInitialMessageSent?.();
      handleSend(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      } else {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [
    chat?.currentLeafId,
    streamingContent,
    activeToolCalls.length,
    scrollToBottom,
  ]);

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  if (!chat)
    return (
      <div className="flex h-full items-center justify-center">
        Chat not found.
      </div>
    );

  const thread = chat.currentLeafId
    ? reconstructThread(chat.messages, chat.currentLeafId)
    : [];

  const streamResponse = async (
    userMsgId: string,
    content: string,
    parentId: string | null,
    attachments: Attachment[] = [],
    model = DEFAULT_MODEL,
    selectedServerIds: string[] = [],
  ) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    addMessage(chatId, "user", content, parentId, userMsgId, null, attachments);

    try {
      await persistMessage(chatId, {
        id: userMsgId,
        role: "user",
        content,
        parentId,
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
        // Convert dataUrl back to File for upload
        const response = await fetch(att.dataUrl);
        const blob = await response.blob();
        const file = new File([blob], att.name, { type: att.mimeType });
        formData.append("file", file);
        formData.append("messageId", userMsgId);

        const uploadRes = await fetch("/api/attachments/upload", {
          method: "POST",
          body: formData,
        });

        if (uploadRes.ok) {
          const data = await uploadRes.json();
          uploadedAttachments.push({ ...att, id: data.id, key: data.key });
        }
      } catch {
        // Upload failed silently — attachment was already shown locally
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
    }));

    let accumulated = "";
    let accumulatedReasoning = "";

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
          const event = JSON.parse(trimmed.slice(6)) as {
            type: string;
            delta?: string;
            id?: string;
            message?: string;
            code?: string;
            toolCallId?: string;
            toolName?: string;
            args?: unknown;
            result?: unknown;
            metadata?: { toolCalls: unknown[]; toolResults: unknown[] };
          };

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
                  ? { ...tc, status: "complete" as const, result: event.result }
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
            const mermaidMatch = accumulated.match(/```mermaid\n([\s\S]*?)```/);
            if (mermaidMatch) {
              setSideViewContent(mermaidMatch[0]);
            }
            setStreamingContent(null);
            setStreamingReasoning(null);
            setIsStreamingReasoning(false);
            setActiveToolCalls([]);
          } else if (event.type === "error") {
            setStreamingContent(null);
            setActiveToolCalls([]);
            toast.error(event.message || "An error occurred during generation");
            addMessage(
              chatId,
              "assistant",
              event.message ||
                "Sorry, I couldn't generate a response. Please try again.",
              userMsgId,
            );
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

  const handleSend = async (
    content: string,
    attachments: Attachment[] = [],
    model = DEFAULT_MODEL,
    selectedServerIds: string[] = [],
  ) => {
    setIsLoading(true);
    await streamResponse(
      uuidv4(),
      content,
      chat.currentLeafId,
      attachments,
      model,
      selectedServerIds,
    );
  };

  /**
   * Deletes a message node from the conversation tree.
   *
   * @param id - The ID of the message to delete.
   */
  const handleDelete = (id: string) => {
    deleteMessageDb(chatId, id);
  };

  const handleEdit = async (id: string, newContent: string) => {
    const msg = chat.messages[id];
    if (!msg) return;
    setIsLoading(true);
    await streamResponse(uuidv4(), newContent, msg.parentId, []);
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 relative h-full">

        <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
          <div className="px-4 md:px-8 py-6">
            <div className="max-w-4xl mx-auto space-y-6 pb-12">
              {thread.length === 0 ? (
                <div className="h-[50vh] flex flex-col items-center justify-center text-center opacity-50">
                  <h2 className="text-2xl font-bold mb-2">
                    How can I help you today?
                  </h2>
                  <p>
                    Try asking for a diagram, math formula, or standard text.
                  </p>
                </div>
              ) : (
                thread.map((msg, index) => {
                  // Find siblings to support branching UI
                  const parent = msg.parentId
                    ? chat.messages[msg.parentId]
                    : null;
                  // Root messages (parentId null) are siblings of each other
                  const siblingsIds = parent
                    ? parent.childrenIds
                    : Object.values(chat.messages)
                        .filter((m) => !m.parentId)
                        .map((m) => m.id);
                  const siblings = siblingsIds
                    .map((id) => chat.messages[id])
                    .filter(Boolean);
                  const currentIndex = siblings.findIndex(
                    (s) => s.id === msg.id,
                  );

                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isLatest={index === thread.length - 1}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                      siblings={siblings}
                      currentSiblingIndex={currentIndex}
                      onNavigateBranch={(siblingId) => {
                        setCurrentLeafDb(
                          chatId,
                          getDeepestLeaf(chat.messages, siblingId),
                        );
                      }}
                      reasoning={msg.reasoning}
                      isStreamingReasoning={false}
                    />
                  );
                })
              )}
              {(streamingContent !== null ||
                activeToolCalls.length > 0 ||
                streamingReasoning !== null) && (
                <>
                  {activeToolCalls.length > 0 && (
                    <div className="text-muted-foreground text-sm space-y-1 ml-2">
                      {activeToolCalls.map((tc) => (
                        <div key={tc.toolCallId}>
                          {tc.status === "calling"
                            ? `🔧 Calling ${tc.toolName}…`
                            : `✅ ${tc.toolName} complete`}
                        </div>
                      ))}
                    </div>
                  )}
                  {(streamingContent !== null ||
                    streamingReasoning !== null) && (
                    <MessageBubble
                      message={{
                        id: "streaming",
                        role: "assistant",
                        content: streamingContent ?? "",
                        createdAt: new Date(),
                        parentId: null,
                        childrenIds: [],
                      }}
                      isLatest={true}
                      onDelete={() => {}}
                      onEdit={() => {}}
                      siblings={[]}
                      currentSiblingIndex={0}
                      onNavigateBranch={() => {}}
                      reasoning={streamingReasoning ?? undefined}
                      isStreamingReasoning={isStreamingReasoning}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="px-4 md:px-8 pb-4 shrink-0 bg-background/80 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto">
            <ChatInput
              onSend={handleSend}
              isLoading={isLoading}
              onStop={handleStop}
              servers={mcpServers.filter((s) => s.enabled)}
            />
          </div>
        </div>
      </div>

      <SideView
        isOpen={sideViewContent !== null}
        content={sideViewContent || ""}
        onClose={() => setSideViewContent(null)}
      />
    </div>
  );
}
