import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearInflightState,
  restoreCachedStreamState,
  saveInflightState,
} from "@/hooks/chat/stream/use-stream-inflight-state";

describe("use-stream-inflight-state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it("throttles sessionStorage writes to at most once per 250ms and coalesces rapid updates", () => {
    const chatId = "chat-throttle-1";
    saveInflightState(chatId, {
      text: "hello",
      reasoning: "thinking 1",
      toolCalls: [],
      assistantMessageId: "a1",
    });

    // Should not write synchronously
    expect(sessionStorage.getItem(`chat_inflight_${chatId}`)).toBeNull();

    // Another update before 250ms
    vi.advanceTimersByTime(100);
    saveInflightState(chatId, {
      text: "hello world",
      reasoning: "thinking 2",
      toolCalls: [],
      assistantMessageId: "a1",
    });

    expect(sessionStorage.getItem(`chat_inflight_${chatId}`)).toBeNull();

    // Advance remaining time
    vi.advanceTimersByTime(150);

    const stored = JSON.parse(
      sessionStorage.getItem(`chat_inflight_${chatId}`) || "{}",
    );
    expect(stored).toEqual({
      text: "hello world",
      reasoning: "thinking 2",
      toolCalls: [],
      assistantMessageId: "a1",
    });
  });

  it("clearInflightState cancels pending timer and removes the item", () => {
    const chatId = "chat-throttle-2";
    saveInflightState(chatId, {
      text: "pending text",
      reasoning: "",
      toolCalls: [],
      assistantMessageId: null,
    });

    // Clear before timer fires
    clearInflightState(chatId);

    // Timer expires
    vi.advanceTimersByTime(300);

    expect(sessionStorage.getItem(`chat_inflight_${chatId}`)).toBeNull();
  });

  it("restores cached stream state into refs and setters", () => {
    const chatId = "chat-restore-1";
    sessionStorage.setItem(
      `chat_inflight_${chatId}`,
      JSON.stringify({
        text: "restored content",
        reasoning: "restored reasoning",
        toolCalls: [
          {
            toolCallId: "tc-1",
            toolName: "search",
            status: "calling",
          },
        ],
        assistantMessageId: "asst-123",
      }),
    );

    const refs = {
      accumulatedTextRef: { current: "" },
      accumulatedReasoningRef: { current: "" },
      activeToolCallsRef: { current: [] as any[] },
      assistantMessageIdRef: { current: null as string | null },
    };

    const setters = {
      setStreamingContent: vi.fn(),
      setStreamingReasoning: vi.fn(),
      setActiveToolCalls: vi.fn(),
      setAssistantMessageId: vi.fn(),
    };

    restoreCachedStreamState(chatId, refs, setters);

    expect(refs.accumulatedTextRef.current).toBe("restored content");
    expect(setters.setStreamingContent).toHaveBeenCalledWith("restored content");
    expect(refs.accumulatedReasoningRef.current).toBe("restored reasoning");
    expect(setters.setStreamingReasoning).toHaveBeenCalledWith("restored reasoning");
    expect(refs.activeToolCallsRef.current).toHaveLength(1);
    expect(setters.setActiveToolCalls).toHaveBeenCalledWith(refs.activeToolCallsRef.current);
    expect(refs.assistantMessageIdRef.current).toBe("asst-123");
    expect(setters.setAssistantMessageId).toHaveBeenCalledWith("asst-123");
  });

  it("handles storage exceptions gracefully when saving and loading", () => {
    const chatId = "chat-error-1";
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceeded");
      });

    saveInflightState(chatId, {
      text: "error text",
      reasoning: "",
      toolCalls: [],
      assistantMessageId: null,
    });
    vi.advanceTimersByTime(250);

    setItemSpy.mockRestore();

    // Corrupted JSON in storage
    sessionStorage.setItem(`chat_inflight_${chatId}`, "not-valid-json{{{");
    const refs = {
      accumulatedTextRef: { current: "" },
      accumulatedReasoningRef: { current: "" },
      activeToolCallsRef: { current: [] as any[] },
      assistantMessageIdRef: { current: null },
    };
    const setters = {
      setStreamingContent: vi.fn(),
      setStreamingReasoning: vi.fn(),
      setActiveToolCalls: vi.fn(),
      setAssistantMessageId: vi.fn(),
    };

    expect(() =>
      restoreCachedStreamState(chatId, refs, setters),
    ).not.toThrow();
  });

  it("does not write to sessionStorage when the throttle timer fires with no pending payload", () => {
    const chatId = "chat-empty-flush";
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    // ponytail: white-box guard test — the only external way to reach the
    // "timer fired but payload already gone" branch is a payload-less save.
    saveInflightState(chatId, undefined as any);

    vi.advanceTimersByTime(250);

    expect(setItemSpy).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(`chat_inflight_${chatId}`)).toBeNull();
    setItemSpy.mockRestore();
  });

  it("clearInflightState is safe to call when no timer or payload exists", () => {
    const chatId = "chat-clear-noop";

    expect(() => clearInflightState(chatId)).not.toThrow();
    expect(sessionStorage.getItem(`chat_inflight_${chatId}`)).toBeNull();
  });

  it("returns early when restoring a chat with nothing cached", () => {
    const refs = {
      accumulatedTextRef: { current: "keep" },
      accumulatedReasoningRef: { current: "keep" },
      activeToolCallsRef: { current: [{ toolCallId: "existing" }] as any[] },
      assistantMessageIdRef: { current: "keep-id" },
    };
    const setters = {
      setStreamingContent: vi.fn(),
      setStreamingReasoning: vi.fn(),
      setActiveToolCalls: vi.fn(),
      setAssistantMessageId: vi.fn(),
    };

    restoreCachedStreamState("chat-never-saved", refs, setters);

    expect(refs.accumulatedTextRef.current).toBe("keep");
    expect(refs.accumulatedReasoningRef.current).toBe("keep");
    expect(refs.activeToolCallsRef.current).toEqual([{ toolCallId: "existing" }]);
    expect(refs.assistantMessageIdRef.current).toBe("keep-id");
    expect(setters.setStreamingContent).not.toHaveBeenCalled();
    expect(setters.setStreamingReasoning).not.toHaveBeenCalled();
    expect(setters.setActiveToolCalls).not.toHaveBeenCalled();
    expect(setters.setAssistantMessageId).not.toHaveBeenCalled();
  });

  it("skips restoring individual fields that are empty or invalid", () => {
    const chatId = "chat-partial-restore";
    sessionStorage.setItem(
      `chat_inflight_${chatId}`,
      JSON.stringify({
        text: "",
        reasoning: "",
        toolCalls: [],
        assistantMessageId: null,
      }),
    );

    const refs = {
      accumulatedTextRef: { current: "keep-text" },
      accumulatedReasoningRef: { current: "keep-reasoning" },
      activeToolCallsRef: { current: [{ toolCallId: "keep-tool" }] as any[] },
      assistantMessageIdRef: { current: "keep-id" },
    };
    const setters = {
      setStreamingContent: vi.fn(),
      setStreamingReasoning: vi.fn(),
      setActiveToolCalls: vi.fn(),
      setAssistantMessageId: vi.fn(),
    };

    restoreCachedStreamState(chatId, refs, setters);

    expect(refs.accumulatedTextRef.current).toBe("keep-text");
    expect(refs.accumulatedReasoningRef.current).toBe("keep-reasoning");
    expect(refs.activeToolCallsRef.current).toEqual([{ toolCallId: "keep-tool" }]);
    expect(refs.assistantMessageIdRef.current).toBe("keep-id");
    expect(setters.setStreamingContent).not.toHaveBeenCalled();
    expect(setters.setStreamingReasoning).not.toHaveBeenCalled();
    expect(setters.setActiveToolCalls).not.toHaveBeenCalled();
    expect(setters.setAssistantMessageId).not.toHaveBeenCalled();
  });

  it("skips restoring tool calls when the cached value is not an array", () => {
    const chatId = "chat-bad-toolcalls";
    sessionStorage.setItem(
      `chat_inflight_${chatId}`,
      JSON.stringify({
        text: "restored text",
        reasoning: "restored reasoning",
        toolCalls: "not-an-array",
        assistantMessageId: "asst-partial",
      }),
    );

    const refs = {
      accumulatedTextRef: { current: "" },
      accumulatedReasoningRef: { current: "" },
      activeToolCallsRef: { current: [{ toolCallId: "keep-tool" }] as any[] },
      assistantMessageIdRef: { current: null as string | null },
    };
    const setters = {
      setStreamingContent: vi.fn(),
      setStreamingReasoning: vi.fn(),
      setActiveToolCalls: vi.fn(),
      setAssistantMessageId: vi.fn(),
    };

    restoreCachedStreamState(chatId, refs, setters);

    expect(refs.accumulatedTextRef.current).toBe("restored text");
    expect(setters.setStreamingContent).toHaveBeenCalledWith("restored text");
    expect(refs.accumulatedReasoningRef.current).toBe("restored reasoning");
    expect(setters.setStreamingReasoning).toHaveBeenCalledWith("restored reasoning");
    expect(refs.activeToolCallsRef.current).toEqual([{ toolCallId: "keep-tool" }]);
    expect(setters.setActiveToolCalls).not.toHaveBeenCalled();
    expect(refs.assistantMessageIdRef.current).toBe("asst-partial");
    expect(setters.setAssistantMessageId).toHaveBeenCalledWith("asst-partial");
  });
});

