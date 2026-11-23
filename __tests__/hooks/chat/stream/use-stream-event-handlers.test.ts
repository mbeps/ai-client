import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockToast = vi.hoisted(() => ({
  loading: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  dismiss: vi.fn(),
}));

const mockGetChat = vi.hoisted(() => vi.fn());
const mockClearInflightState = vi.hoisted(() => vi.fn());
const mockSaveInflightState = vi.hoisted(() => vi.fn());
const mockExecuteRejoinFinish = vi.hoisted(() => vi.fn());
const mockExecuteStandardFinish = vi.hoisted(() => vi.fn());
const mockUpsertChat = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({ toast: mockToast }));

vi.mock("@/actions/chats/get-chat", () => ({
  getChat: mockGetChat,
}));

vi.mock("@/hooks/chat/stream/use-stream-inflight-state", () => ({
  clearInflightState: mockClearInflightState,
  saveInflightState: mockSaveInflightState,
}));

vi.mock("@/hooks/chat/stream/use-stream-db-sync", () => ({
  findMatchingAssistantMessage: vi.fn(),
  isAccessOrNotFoundError: vi.fn(),
}));

vi.mock("@/lib/chat/message-tree-utils", () => ({
  buildChatFromRows: vi.fn((v) => v),
}));

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: {
    getState: vi.fn(() => ({
      upsertChat: mockUpsertChat,
    })),
  },
}));

vi.mock("@/lib/logger", () => {
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { getLogger: vi.fn(() => log), logger: log };
});

import { useStreamEventHandlers } from "@/hooks/chat/stream/use-stream-event-handlers";

function createParams() {
  return {
    chatId: "chat-1",
    upsertChat: mockUpsertChat,
    addMessage: vi.fn(),
    handleApiError: vi.fn(() => false),
    resetStreamingState: vi.fn(),
    streamRefs: {
      stoppedRef: { current: false },
      rejoinedRef: { current: false },
      awaitingApprovalRef: { current: false },
      lastChunkTimeRef: { current: 0 },
      assistantMessageIdRef: { current: null },
      accumulatedTextRef: { current: "" },
      accumulatedReasoningRef: { current: "" },
      activeToolCallsRef: { current: [] },
      pendingRef: { current: { userMessageId: "u1", model: "gpt-4o" } },
    } as any,
    streamSetters: {
      setIsStreaming: vi.fn(),
      setStreamingContent: vi.fn(),
      setStreamingReasoning: vi.fn(),
      setActiveToolCalls: vi.fn(),
    } as any,
  };
}

describe("useStreamEventHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetChat.mockResolvedValue({ ok: true, value: { id: "chat-1" } });
    mockExecuteRejoinFinish.mockResolvedValue(undefined);
    mockExecuteStandardFinish.mockReturnValue(undefined);
  });

  it("keeps success toast intact when compacted arrives before finish", async () => {
    const params = createParams();
    const { result } = renderHook(() => useStreamEventHandlers(params));

    await act(async () => {
      await result.current.handleStreamEvent({ type: "compacting" });
    });
    expect(mockToast.loading).toHaveBeenCalledWith(
      "Compacting conversation...",
      { id: "auto-compact-chat-1" },
    );

    await act(async () => {
      await result.current.handleStreamEvent({ type: "compacted" });
    });
    expect(mockToast.success).toHaveBeenCalledWith("Conversation compacted", {
      id: "auto-compact-chat-1",
    });
    expect(mockUpsertChat).toHaveBeenCalledWith({ id: "chat-1" });

    await act(async () => {
      await result.current.handleStreamEvent({
        type: "finish",
        messageId: "a1",
        usage: {},
      } as any);
    });
    expect(mockToast.dismiss).not.toHaveBeenCalled();
  });

  it("dismisses compaction loading toast on finish when auto-compaction fell back to truncation", async () => {
    const params = createParams();
    const { result } = renderHook(() => useStreamEventHandlers(params));

    await act(async () => {
      await result.current.handleStreamEvent({ type: "compacting" });
      await result.current.handleStreamEvent({
        type: "finish",
        messageId: "a1",
        usage: {},
      } as any);
    });

    expect(mockToast.dismiss).toHaveBeenCalledWith("auto-compact-chat-1");
  });

  it("dismisses compaction loading toast on error when compaction was pending", async () => {
    const params = createParams();
    const { result } = renderHook(() => useStreamEventHandlers(params));

    await act(async () => {
      await result.current.handleStreamEvent({ type: "compacting" });
      await result.current.handleStreamEvent({
        type: "error",
        message: "Stream failed",
      } as any);
    });

    expect(mockToast.dismiss).toHaveBeenCalledWith("auto-compact-chat-1");
    expect(mockToast.error).toHaveBeenCalledWith("Stream failed");
  });

  it("ignores events when stoppedRef is true and handles text deltas + standard finish", async () => {
    const onDone = vi.fn();
    const params = createParams();
    params.options = { onDone };
    const { result } = renderHook(() => useStreamEventHandlers(params));

    params.streamRefs.stoppedRef.current = true;
    await act(async () => {
      await result.current.handleStreamEvent({ type: "compacting" });
    });
    expect(mockToast.loading).not.toHaveBeenCalled();

    params.streamRefs.stoppedRef.current = false;
    await act(async () => {
      await result.current.handleStreamEvent({
        type: "text-delta",
        text: "Hello",
      } as any);
      await result.current.handleStreamEvent({
        type: "finish",
        messageId: "a1",
        usage: {},
      } as any);
    });

    expect(mockSaveInflightState).toHaveBeenCalled();
    expect(params.addMessage).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith("Hello");
  });

  it("refetches chat on rejoin finish when userMessageId is null", async () => {
    const onDone = vi.fn();
    const params = createParams();
    params.options = { onDone };
    params.streamRefs.pendingRef.current.userMessageId = null;

    const { useAppStore } = await import("@/lib/store/use-app-store");
    vi.mocked(useAppStore.getState).mockReturnValue({
      upsertChat: mockUpsertChat,
      chats: { "chat-1": { id: "chat-1" } },
      loadSkills: vi.fn(),
    } as any);

    mockGetChat.mockResolvedValueOnce({
      ok: true,
      value: {
        id: "chat-1",
        messages: [{ id: "a1", role: "assistant", content: "Synced" }],
      },
    });

    const { result } = renderHook(() => useStreamEventHandlers(params));

    await act(async () => {
      await result.current.handleStreamEvent({
        type: "finish",
        messageId: "a1",
        usage: {},
      } as any);
    });

    expect(mockGetChat).toHaveBeenCalledWith("chat-1");
    expect(mockUpsertChat).toHaveBeenCalled();
  });

  it("handles compacted event when getChat fails without upserting", async () => {
    const params = createParams();
    mockGetChat.mockResolvedValueOnce({
      ok: false,
      error: { code: "NOT_FOUND", message: "Not found" },
    });

    const { result } = renderHook(() => useStreamEventHandlers(params));

    await act(async () => {
      await result.current.handleStreamEvent({
        type: "compacted",
      } as any);
    });

    expect(mockGetChat).toHaveBeenCalledWith("chat-1");
    expect(mockUpsertChat).not.toHaveBeenCalled();
  });
});
