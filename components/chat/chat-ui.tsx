"use client";

import { useAppStore } from "@/lib/store";
import type { Message } from "@/types/message";
import type { Attachment } from "@/types/attachment";
import { reconstructThread, getDeepestLeaf } from "@/lib/chat/tree-utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageBubble } from "./message-bubble";
import { ChatInput } from "./chat-input";
import { SideView } from "./side-view";
import { ScrollArea } from "@/components/ui/scroll-area";
import { v4 as uuidv4 } from "uuid";
import { useStreamResponse } from "@/hooks/chat/use-stream-response";
import { DEFAULT_MODEL } from "@/models";
import { Bot } from "lucide-react";

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
  const assistants = useAppStore((state) => state.assistants);
  const currentAssistant = chat?.assistantId
    ? assistants.find((a) => a.id === chat.assistantId)
    : undefined;

  const [sideViewContent, setSideViewContent] = useState<string | null>(null);

  const {
    isLoading,
    streamingContent,
    streamingReasoning,
    isStreamingReasoning,
    activeToolCalls,
    streamResponse,
    stopStream,
  } = useStreamResponse(chatId, {
    onDone: (content) => {
      const mermaidMatch = content.match(/```mermaid\n([\s\S]*?)```/);
      if (mermaidMatch) {
        setSideViewContent(mermaidMatch[0]);
      }
    },
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);

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

  if (!chat)
    return (
      <div className="flex h-full items-center justify-center">
        Chat not found.
      </div>
    );

  const thread = chat.currentLeafId
    ? reconstructThread(chat.messages, chat.currentLeafId)
    : [];

  const handleSend = async (
    content: string,
    attachments: Attachment[] = [],
    model = DEFAULT_MODEL,
    selectedServerIds: string[] = [],
    selectedPromptId?: string,
  ) => {
    await streamResponse(
      uuidv4(),
      content,
      chat.currentLeafId,
      attachments,
      model,
      selectedServerIds,
      selectedPromptId,
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
    await streamResponse(uuidv4(), newContent, msg.parentId, []);
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        {currentAssistant && (
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30 text-sm text-muted-foreground">
            <Bot className="h-4 w-4" />
            <span>
              Chatting with <strong>{currentAssistant.name}</strong>
            </span>
          </div>
        )}
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
              onStop={stopStream}
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
