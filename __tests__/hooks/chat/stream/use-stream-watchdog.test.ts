import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStreamWatchdog } from "@/hooks/chat/stream/use-stream-watchdog";

const mockIsChatGenerating = vi.hoisted(() => vi.fn());
vi.mock("@/actions/chats/is-chat-generating", () => ({
  isChatGenerating: mockIsChatGenerating,
}));

const mockClearInflightState = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/chat/stream/use-stream-inflight-state", () => ({
  clearInflightState: mockClearInflightState,
}));

const mockToastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: { error: mockToastError },
}));

describe("useStreamWatchdog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockIsChatGenerating.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function createRefs(overrides?: Partial<any>) {
    return {
      lastChunkTimeRef: { current: Date.now() },
      pendingRef: { current: { startTime: Date.now() - 10000 } },
      activeToolCallsRef: { current: [] as any[] },
      rejoinedRef: { current: false },
      ...overrides,
    };
  }

  it("does not abort at 30-attempt threshold if isChatGenerating returns true", async () => {
    mockIsChatGenerating.mockResolvedValue(true);
    const syncFromDb = vi.fn().mockResolvedValue(false);
    const setIsStreaming = vi.fn();
    const refs = createRefs({
      lastChunkTimeRef: { current: Date.now() - 10000 },
    });

    renderHook(() =>
      useStreamWatchdog(
        "chat-active",
        true,
        false,
        "connected",
        null,
        syncFromDb,
        setIsStreaming,
        refs as any,
      ),
    );

    // Run 30 intervals (60s)
    for (let i = 0; i < 30; i++) {
      await vi.advanceTimersByTimeAsync(2000);
    }

    expect(mockIsChatGenerating).toHaveBeenCalledWith("chat-active");
    expect(setIsStreaming).not.toHaveBeenCalledWith(false);
    expect(mockClearInflightState).not.toHaveBeenCalled();
  });

  it("aborts at 30-attempt threshold when isChatGenerating returns false", async () => {
    mockIsChatGenerating.mockResolvedValue(false);
    const syncFromDb = vi.fn().mockResolvedValue(false);
    const setIsStreaming = vi.fn();
    const refs = createRefs({
      lastChunkTimeRef: { current: Date.now() - 10000 },
    });

    renderHook(() =>
      useStreamWatchdog(
        "chat-stalled",
        true,
        false,
        "connected",
        null,
        syncFromDb,
        setIsStreaming,
        refs as any,
      ),
    );

    for (let i = 0; i < 30; i++) {
      await vi.advanceTimersByTimeAsync(2000);
    }

    expect(mockIsChatGenerating).toHaveBeenCalledWith("chat-stalled");
    expect(setIsStreaming).toHaveBeenCalledWith(false);
    expect(mockClearInflightState).toHaveBeenCalledWith("chat-stalled");
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("aborts on connection error at 10 attempts without checking isChatGenerating", async () => {
    const syncFromDb = vi.fn().mockResolvedValue(false);
    const setIsStreaming = vi.fn();
    const refs = createRefs();

    renderHook(() =>
      useStreamWatchdog(
        "chat-conn-err",
        true,
        false,
        "error",
        null,
        syncFromDb,
        setIsStreaming,
        refs as any,
      ),
    );

    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(2000);
    }

    expect(mockIsChatGenerating).not.toHaveBeenCalled();
    expect(setIsStreaming).toHaveBeenCalledWith(false);
    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringContaining("Connection lost"),
    );
  });

  it("does not start polling when chatNotFound is true", async () => {
    const syncFromDb = vi.fn().mockResolvedValue(false);
    const setIsStreaming = vi.fn();
    const refs = createRefs();

    renderHook(() =>
      useStreamWatchdog(
        "chat-not-found",
        true,
        true,
        "connected",
        null,
        syncFromDb,
        setIsStreaming,
        refs as any,
      ),
    );

    await vi.advanceTimersByTimeAsync(10000);

    expect(syncFromDb).not.toHaveBeenCalled();
    expect(setIsStreaming).not.toHaveBeenCalled();
  });

  it("clears interval and inflight state when syncFromDb returns true", async () => {
    const syncFromDb = vi.fn().mockResolvedValue(true);
    const setIsStreaming = vi.fn();
    const refs = createRefs({
      lastChunkTimeRef: { current: Date.now() - 10000 },
    });

    renderHook(() =>
      useStreamWatchdog(
        "chat-synced",
        true,
        false,
        "connected",
        null,
        syncFromDb,
        setIsStreaming,
        refs as any,
      ),
    );

    await vi.advanceTimersByTimeAsync(2000);

    expect(syncFromDb).toHaveBeenCalled();
    expect(mockClearInflightState).toHaveBeenCalledWith("chat-synced");

    // Clear calls and advance more time to verify interval was cleared
    syncFromDb.mockClear();
    await vi.advanceTimersByTimeAsync(10000);
    expect(syncFromDb).not.toHaveBeenCalled();
  });

  it("does not abort at 30 attempts if active calling tools are in progress", async () => {
    const syncFromDb = vi.fn().mockResolvedValue(false);
    const setIsStreaming = vi.fn();
    const refs = createRefs({
      activeToolCallsRef: { current: [{ status: "calling" }] },
      lastChunkTimeRef: { current: Date.now() - 10000 },
    });

    renderHook(() =>
      useStreamWatchdog(
        "chat-calling-tool",
        true,
        false,
        "connected",
        null,
        syncFromDb,
        setIsStreaming,
        refs as any,
      ),
    );

    for (let i = 0; i < 35; i++) {
      await vi.advanceTimersByTimeAsync(2000);
    }

    expect(setIsStreaming).not.toHaveBeenCalledWith(false);
  });
});
