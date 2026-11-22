import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCompactChat } from "@/hooks/chat/use-compact-chat";

const mockCompactChat = vi.hoisted(() => vi.fn());
const mockHandleApiError = vi.hoisted(() => vi.fn());
const mockAddMessage = vi.hoisted(() => vi.fn());
const mockToastLoading = vi.hoisted(() => vi.fn(() => "toast-1"));
const mockToastSuccess = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());
const mockToastDismiss = vi.hoisted(() => vi.fn());

vi.mock("@/actions/chats/compact-chat", () => ({
  compactChat: mockCompactChat,
}));

vi.mock("@/hooks/use-api-error", () => ({
  useApiError: () => ({ handleApiError: mockHandleApiError }),
}));

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: (state: { addMessage: typeof mockAddMessage }) => unknown) =>
    selector({ addMessage: mockAddMessage }),
}));

vi.mock("sonner", () => ({
  toast: {
    loading: mockToastLoading,
    success: mockToastSuccess,
    error: mockToastError,
    dismiss: mockToastDismiss,
  },
}));

describe("useCompactChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleApiError.mockReturnValue(false);
  });

  it("compacts chat and shows singular message for 1 compacted message", async () => {
    mockCompactChat.mockResolvedValue({
      ok: true,
      value: {
        message: {
          id: "sys-1",
          content: "Summary",
          parentId: "msg-1",
          metadata: { compaction: { compactedCount: 1 } },
        },
        compactedCount: 1,
      },
    });

    const { result } = renderHook(() => useCompactChat("chat-1"));

    await act(async () => {
      await result.current.handleCompact("model-1");
    });

    expect(mockCompactChat).toHaveBeenCalledWith({
      chatId: "chat-1",
      modelId: "model-1",
    });
    expect(mockAddMessage).toHaveBeenCalledWith("chat-1", {
      id: "sys-1",
      role: "system",
      content: "Summary",
      parentId: "msg-1",
      metadata: { compaction: { compactedCount: 1 } },
    });
    expect(mockToastSuccess).toHaveBeenCalledWith("Compacted 1 message", {
      id: "toast-1",
    });
    expect(result.current.isCompacting).toBe(false);
  });

  it("shows plural message for multiple compacted messages", async () => {
    mockCompactChat.mockResolvedValue({
      ok: true,
      value: {
        message: {
          id: "sys-2",
          content: "Summary",
          parentId: null,
          metadata: undefined,
        },
        compactedCount: 3,
      },
    });

    const { result } = renderHook(() => useCompactChat("chat-1"));

    await act(async () => {
      await result.current.handleCompact();
    });

    expect(mockToastSuccess).toHaveBeenCalledWith("Compacted 3 messages", {
      id: "toast-1",
    });
  });

  it("ignores concurrent handleCompact calls while already compacting", async () => {
    let resolveCompact!: (value: unknown) => void;
    mockCompactChat.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCompact = resolve;
        }),
    );

    const { result } = renderHook(() => useCompactChat("chat-1"));

    let firstCall!: Promise<void>;
    act(() => {
      firstCall = result.current.handleCompact();
    });

    await act(async () => {
      await result.current.handleCompact();
    });

    expect(mockCompactChat).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCompact({
        ok: true,
        value: {
          message: { id: "sys-1", content: "S", parentId: null, metadata: {} },
          compactedCount: 2,
        },
      });
      await firstCall;
    });
  });

  it("dismisses toast when handleApiError handles the error", async () => {
    mockHandleApiError.mockReturnValue(true);
    mockCompactChat.mockResolvedValue({
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Unauthorized" },
    });

    const { result } = renderHook(() => useCompactChat("chat-1"));

    await act(async () => {
      await result.current.handleCompact();
    });

    expect(mockToastDismiss).toHaveBeenCalledWith("toast-1");
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("shows error toast with error message or fallback when handleApiError returns false", async () => {
    mockHandleApiError.mockReturnValue(false);
    mockCompactChat.mockResolvedValueOnce({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Custom error" },
    });

    const { result } = renderHook(() => useCompactChat("chat-1"));

    await act(async () => {
      await result.current.handleCompact();
    });

    expect(mockToastError).toHaveBeenCalledWith("Custom error", {
      id: "toast-1",
    });

    mockCompactChat.mockResolvedValueOnce({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "" },
    });

    await act(async () => {
      await result.current.handleCompact();
    });

    expect(mockToastError).toHaveBeenCalledWith(
      "Failed to compact conversation",
      { id: "toast-1" },
    );
  });

  it("handles thrown Error and non-Error exceptions", async () => {
    mockCompactChat.mockRejectedValueOnce(new Error("Network down"));
    const { result } = renderHook(() => useCompactChat("chat-1"));

    await act(async () => {
      await result.current.handleCompact();
    });

    expect(mockToastError).toHaveBeenCalledWith("Network down", {
      id: "toast-1",
    });

    mockCompactChat.mockRejectedValueOnce("string error");

    await act(async () => {
      await result.current.handleCompact();
    });

    expect(mockToastError).toHaveBeenCalledWith(
      "Failed to compact conversation",
      { id: "toast-1" },
    );
  });
});
