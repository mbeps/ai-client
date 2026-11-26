import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  extractActiveStreamingCitations,
  scrollElementToBottom,
  useChatMessageActions,
  useInitialChatAutoSend,
} from "@/components/chat/use-chat-message-actions";

describe("scrollElementToBottom", () => {
  it("handles null container, viewport child, and direct container", () => {
    scrollElementToBottom(null);

    const viewport = document.createElement("div");
    viewport.setAttribute("data-radix-scroll-area-viewport", "");
    Object.defineProperty(viewport, "scrollHeight", { value: 500 });
    const wrapper = document.createElement("div");
    wrapper.appendChild(viewport);
    scrollElementToBottom(wrapper);
    expect(viewport.scrollTop).toBe(500);

    const direct = document.createElement("div");
    Object.defineProperty(direct, "scrollHeight", { value: 300 });
    scrollElementToBottom(direct);
    expect(direct.scrollTop).toBe(300);
  });
});

describe("extractActiveStreamingCitations", () => {
  it("returns empty array when no active tool calls and extracts completed search_knowledge_base", () => {
    expect(extractActiveStreamingCitations([])).toEqual([]);
    const res = extractActiveStreamingCitations([
      {
        toolCallId: "tc-1",
        toolName: "search_knowledge_base",
        status: "complete",
        result: JSON.stringify({ citations: [] }),
      },
    ]);
    expect(Array.isArray(res)).toBe(true);
  });
});

describe("useChatMessageActions", () => {
  it("handles handleEdit, handleRegenerate, handleDelete, and handleNavigateBranch", async () => {
    const streamResponse = vi.fn().mockResolvedValue(undefined);
    const deleteMessageDb = vi.fn();
    const setCurrentLeafDb = vi.fn();
    const chat = {
      id: "c1",
      messages: {
        u1: { id: "u1", role: "user", content: "hi", parentId: null, childrenIds: ["a1"], attachments: [] },
        a1: {
          id: "a1",
          role: "assistant",
          content: "hello",
          parentId: "u1",
          childrenIds: [],
          metadata: JSON.stringify({ model: "m1" }),
        },
      },
    } as any;

    const { result, rerender } = renderHook(
      ({ c }) =>
        useChatMessageActions({
          chat: c,
          chatId: "c1",
          streamResponse,
          deleteMessageDb,
          setCurrentLeafDb,
        }),
      { initialProps: { c: chat } },
    );

    await act(async () => {
      await result.current.handleEdit("missing", "new");
      await result.current.handleEdit("u1", "edited");
      await result.current.handleRegenerate("missing");
      await result.current.handleRegenerate("a1");
    });

    expect(streamResponse).toHaveBeenCalledTimes(2);

    result.current.handleDelete("a1");
    expect(deleteMessageDb).toHaveBeenCalledWith("c1", "a1");

    result.current.handleNavigateBranch("u1");
    expect(setCurrentLeafDb).toHaveBeenCalledWith("c1", "a1");

    rerender({ c: undefined });
    result.current.handleNavigateBranch("u1");
  });
});

describe("useInitialChatAutoSend", () => {
  it("handles pendingLaunch, initialMessage, existing messages, and msg query param", () => {
    window.history.replaceState({}, "", "/chat/c1?msg=hello");
    const handleSend = vi.fn();
    const onInitialMessageSent = vi.fn();
    const onConsumePendingLaunch = vi.fn();

    renderHook(() =>
      useInitialChatAutoSend(
        { id: "c1", messages: {} } as any,
        undefined,
        onInitialMessageSent,
        handleSend,
        "m1",
        [],
        [],
        [],
        [],
        false,
        undefined,
        undefined,
        true,
        undefined,
        undefined,
        {
          content: "launch",
          attachments: [],
          model: "m1",
          selectedServerIds: [],
          selectedTools: [],
        } as any,
        onConsumePendingLaunch,
      ),
    );
    expect(handleSend).toHaveBeenCalled();
    expect(window.location.search).toBe("");

    // Existing messages -> early return
    const handleSend2 = vi.fn();
    renderHook(() =>
      useInitialChatAutoSend(
        { id: "c1", messages: { m1: { id: "m1" } } } as any,
        "hi",
        undefined,
        handleSend2,
      ),
    );
    expect(handleSend2).not.toHaveBeenCalled();

    // No initialMessage -> early return
    renderHook(() =>
      useInitialChatAutoSend(
        { id: "c1", messages: {} } as any,
        undefined,
        undefined,
        handleSend2,
      ),
    );
    expect(handleSend2).not.toHaveBeenCalled();
  });
});
