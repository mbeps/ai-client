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
    mockIsChatGenerating.mockResolvedValue({ ok: true, value: false });
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
      awaitingApprovalRef: { current: false },
      assistantMessageIdRef: { current: null },
      accumulatedTextRef: { current: "" },
      accumulatedReasoningRef: { current: "" },
      ...overrides,
    };
  }

  it("does not abort at 30-attempt threshold if isChatGenerating returns true", async () => {
    mockIsChatGenerating.mockResolvedValue({ ok: true, value: true });
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
    mockIsChatGenerating.mockResolvedValue({ ok: true, value: false });
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

  it("reconciles from DB without aborting while awaitingApprovalRef is true and approval remains pending", async () => {
    const syncFromDb = vi.fn().mockResolvedValue(false);
    const setIsStreaming = vi.fn();
    const refs = createRefs({
      awaitingApprovalRef: { current: true },
      lastChunkTimeRef: { current: Date.now() - 10000 },
    });

    renderHook(() =>
      useStreamWatchdog(
        "chat-awaiting-approval",
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

    expect(syncFromDb).toHaveBeenCalled();
    expect(setIsStreaming).not.toHaveBeenCalledWith(false);
  });

  it("clears watchdog and inflight state when reconciliation succeeds while awaitingApprovalRef is true", async () => {
    const syncFromDb = vi.fn().mockResolvedValue(true);
    const setIsStreaming = vi.fn();
    const refs = createRefs({
      awaitingApprovalRef: { current: true },
      lastChunkTimeRef: { current: Date.now() - 10000 },
    });

    renderHook(() =>
      useStreamWatchdog(
        "chat-awaiting-resolved",
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

    expect(syncFromDb).toHaveBeenCalledTimes(1);
    expect(mockClearInflightState).toHaveBeenCalledWith(
      "chat-awaiting-resolved",
    );
  });

  it("triggers syncFromDb on first tick when rejoinedRef is true", async () => {
    const syncFromDb = vi.fn().mockResolvedValue(false);
    const setIsStreaming = vi.fn();
    const refs = createRefs({
      rejoinedRef: { current: true },
    });

    renderHook(() =>
      useStreamWatchdog(
        "chat-rejoined",
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
    expect(syncFromDb).toHaveBeenCalledTimes(1);

    // Second tick with recent chunk should not trigger syncFromDb again
    refs.lastChunkTimeRef.current = Date.now();
    await vi.advanceTimersByTimeAsync(2000);
    expect(syncFromDb).toHaveBeenCalledTimes(1);
  });

  it("logs realtimeError and triggers syncFromDb when realtimeError is present", async () => {
    const syncFromDb = vi.fn().mockResolvedValue(false);
    const setIsStreaming = vi.fn();
    const refs = createRefs();

    renderHook(() =>
      useStreamWatchdog(
        "chat-realtime-error",
        true,
        false,
        "connected",
        new Error("Realtime failed"),
        syncFromDb,
        setIsStreaming,
        refs as any,
      ),
    );

    expect(syncFromDb).toHaveBeenCalledTimes(1);
  });

  it("aborts after 4 no-chunk attempts when no chunks have been received", async () => {
    mockIsChatGenerating.mockResolvedValue({ ok: false, error: "fail" });
    const syncFromDb = vi.fn().mockResolvedValue(false);
    const setIsStreaming = vi.fn();
    const now = Date.now();
    const refs = createRefs({
      lastChunkTimeRef: { current: now - 10000 },
      pendingRef: { current: { startTime: now - 10000, dispatched: true } },
    });

    renderHook(() =>
      useStreamWatchdog(
        "chat-no-chunks",
        true,
        false,
        "connected",
        null,
        syncFromDb,
        setIsStreaming,
        refs as any,
      ),
    );

    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(2000);
    }

    expect(mockIsChatGenerating).toHaveBeenCalledWith("chat-no-chunks");
    expect(setIsStreaming).toHaveBeenCalledWith(false);
    expect(mockClearInflightState).toHaveBeenCalledWith("chat-no-chunks");
  });

  it("does not increment noChunkAttempts when pendingRef.current.dispatched is false", async () => {
    const syncFromDb = vi.fn().mockResolvedValue(false);
    const setIsStreaming = vi.fn();
    const now = Date.now();
    const refs = createRefs({
      lastChunkTimeRef: { current: now - 10000 },
      pendingRef: { current: { startTime: now - 10000, dispatched: false } },
    });

    renderHook(() =>
      useStreamWatchdog(
        "chat-not-dispatched",
        true,
        false,
        "connected",
        null,
        syncFromDb,
        setIsStreaming,
        refs as any,
      ),
    );

    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(2000);
    }

    expect(mockIsChatGenerating).not.toHaveBeenCalled();
    expect(setIsStreaming).not.toHaveBeenCalledWith(false);
  });
});
