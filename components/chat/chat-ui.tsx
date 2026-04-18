"use client";

import { useAppStore } from "@/lib/store";
import { reconstructThread, getDeepestLeaf } from "@/lib/chat/tree-utils";
import { useEffect, useRef, useState } from "react";
import { MessageBubble } from "./message-bubble";
import { ChatInput } from "./chat-input";
import { SideView } from "./side-view";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * Props for the ChatUI component.
 *
 * @author Maruf Bepary
 */
interface ChatUIProps {
  /** The ID of the chat to display; used to look up the chat from the Zustand store. */
  chatId: string;
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
export function ChatUI({ chatId }: ChatUIProps) {
  const chat = useAppStore((state) => state.chats[chatId]);
  const addMessage = useAppStore((state) => state.addMessage);
  const deleteMessage = useAppStore((state) => state.deleteMessage);
  const setCurrentLeaf = useAppStore((state) => state.setCurrentLeaf);

  const [sideViewContent, setSideViewContent] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
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

  /**
   * Adds a user message to the store and triggers a mocked AI response after 1 s.
   * Detects "diagram"/"mermaid" and "math" keywords to produce special AI responses
   * and opens the SideView panel for Mermaid content.
   *
   * @param content - The raw text entered by the user.
   */
  const handleSend = (content: string) => {
    // 1. Add user message
    addMessage(chatId, "user", content, chat.currentLeafId);

    // 2. Mock AI response after a short delay
    setTimeout(() => {
      // Very basic mock to show side view capability if asked
      let aiResponse = "I'm a mocked AI response.";

      if (
        content.toLowerCase().includes("diagram") ||
        content.toLowerCase().includes("mermaid")
      ) {
        aiResponse =
          "Here is a diagram representing your request:\n\n```mermaid\ngraph TD;\n    A-->B;\n    A-->C;\n    B-->D;\n    C-->D;\n```\nI have generated the diagram.";
      } else if (content.toLowerCase().includes("math")) {
        aiResponse =
          "Here is the formula:\n\n$$\ne^{i\\pi} + 1 = 0\n$$\n\nThis is Euler's identity.";
      }

      // Check if we should open side view
      if (aiResponse.includes("```mermaid")) {
        setSideViewContent(
          aiResponse.match(/```mermaid[\s\S]*?```/)?.[0] || "",
        );
      }

      // Get the newly added user message ID (it will be the new current leaf)
      // Since addMessage is synchronous in Zustand, we can grab the latest state
      const state = useAppStore.getState();
      const newLeafId = state.chats[chatId].currentLeafId;
      addMessage(chatId, "assistant", aiResponse, newLeafId);
    }, 1000);
  };

  /**
   * Deletes a message node from the conversation tree.
   *
   * @param id - The ID of the message to delete.
   */
  const handleDelete = (id: string) => {
    deleteMessage(chatId, id);
  };

  /**
   * Simulates editing a message by branching from the original message's parent.
   * Adds a new user message at the same tree level and appends a mocked assistant
   * response, leaving the original branch intact for navigation.
   *
   * @param id - The ID of the message being replaced.
   * @param newContent - The replacement text for the message.
   */
  const handleEdit = (id: string, newContent: string) => {
    // In a real app, editing a message creates a NEW message node connected to the original parent
    // For this mock, we just add it to the parent and set it as the new leaf to simulate branching
    const msg = chat.messages[id];
    if (msg) {
      addMessage(chatId, "user", newContent, msg.parentId);
      // Wait for state update to add AI response mock
      setTimeout(() => {
        const state = useAppStore.getState();
        const newLeafId = state.chats[chatId].currentLeafId;
        addMessage(chatId, "assistant", "Edited response.", newLeafId);
      }, 500);
    }
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
          </div>
        </ScrollArea>

        <div className="px-4 md:px-8 pb-4">
          <ChatInput onSend={handleSend} />
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
