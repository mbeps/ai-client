"use client";

import { useAppStore } from "@/lib/store";
import { reconstructThread, getDeepestLeaf } from "@/lib/chat/tree-utils";
import { useEffect, useRef, useState } from "react";
import { MessageBubble } from "./message-bubble";
import { ChatInput } from "./chat-input";
import { SideView } from "./side-view";
import { ScrollArea } from "@/components/ui/scroll-area";
import { v4 as uuidv4 } from "uuid";
import { persistMessage } from "@/lib/actions/chats/persist-message";

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
  const deleteMessage = useAppStore((state) => state.deleteMessage);
  const setCurrentLeaf = useAppStore((state) => state.setCurrentLeaf);

  const [sideViewContent, setSideViewContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);

  // Auto-send the initial message once the chat is hydrated into Zustand
  useEffect(() => {
    if (initialMessage && chat && !sentInitial.current) {
      sentInitial.current = true;
      onInitialMessageSent?.();
      handleSend(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat]);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat?.currentLeafId]);

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
  ) => {
    addMessage(chatId, "user", content, parentId, userMsgId);

    persistMessage(chatId, {
      id: userMsgId,
      role: "user",
      content,
      parentId,
    }).catch(() => {});

    const latestChat = useAppStore.getState().chats[chatId];
    const latestThread = latestChat?.currentLeafId
      ? reconstructThread(latestChat.messages, latestChat.currentLeafId)
      : [];
    const history = latestThread.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          userMessageId: userMsgId,
          messages: history,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Stream request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6)) as {
            type: string;
            delta?: string;
            id?: string;
          };

          if (event.type === "text" && event.delta) {
            accumulated += event.delta;
            setStreamingContent(accumulated);
          } else if (event.type === "done" && event.id) {
            addMessage(chatId, "assistant", accumulated, userMsgId, event.id);
            setStreamingContent(null);
          } else if (event.type === "error") {
            setStreamingContent(null);
            addMessage(
              chatId,
              "assistant",
              "Sorry, I couldn't generate a response. Please try again.",
              userMsgId,
            );
          }
        }
      }
    } catch {
      setStreamingContent(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (content: string) => {
    setIsLoading(true);
    await streamResponse(uuidv4(), content, chat.currentLeafId);
  };

  /**
   * Deletes a message node from the conversation tree.
   *
   * @param id - The ID of the message to delete.
   */
  const handleDelete = (id: string) => {
    deleteMessage(chatId, id);
  };

  const handleEdit = async (id: string, newContent: string) => {
    const msg = chat.messages[id];
    if (!msg) return;
    setIsLoading(true);
    await streamResponse(uuidv4(), newContent, msg.parentId);
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0">
        <ScrollArea className="flex-1 px-4 md:px-8 py-6" ref={scrollRef}>
          <div className="max-w-4xl mx-auto space-y-6 pb-20">
            {thread.length === 0 ? (
              <div className="h-[50vh] flex flex-col items-center justify-center text-center opacity-50">
                <h2 className="text-2xl font-bold mb-2">
                  How can I help you today?
                </h2>
                <p>Try asking for a diagram, math formula, or standard text.</p>
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
                const currentIndex = siblings.findIndex((s) => s.id === msg.id);

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
                      setCurrentLeaf(
                        chatId,
                        getDeepestLeaf(chat.messages, siblingId),
                      );
                    }}
                  />
                );
              })
            )}
            {streamingContent !== null && (
              <MessageBubble
                message={{
                  id: "streaming",
                  role: "assistant",
                  content: streamingContent,
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
              />
            )}
          </div>
        </ScrollArea>

        <div className="px-4 md:px-8 pb-4">
          <ChatInput onSend={handleSend} isLoading={isLoading} />
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
