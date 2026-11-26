import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTranslationRealtimeStream } from "@/components/workflows/translation/use-translation-realtime-stream";

const mockUseRealtime = vi.hoisted(() => vi.fn());
const mockGetTranslationRealtimeToken = vi.hoisted(() => vi.fn());
const mockApplyTranslationRealtimeEvent = vi.hoisted(() => vi.fn());

vi.mock("inngest/react", () => ({
  useRealtime: mockUseRealtime,
}));

vi.mock("@/actions/workflows/get-translation-realtime-token", () => ({
  getTranslationRealtimeToken: mockGetTranslationRealtimeToken,
}));

vi.mock("@/components/workflows/translation/translation-helpers", () => ({
  applyTranslationRealtimeEvent: mockApplyTranslationRealtimeEvent,
}));

vi.mock("@/lib/inngest/realtime-url", () => ({
  getRealtimeApiBaseUrl: () => "http://localhost:3000/api/inngest",
}));

vi.mock("@/lib/inngest/translation-channel", () => ({
  translationChannel: ({ translationId }: { translationId: string }) =>
    `translation:${translationId}`,
}));

describe("useTranslationRealtimeStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRealtime.mockReturnValue({ messages: { all: [] } });
  });

  it("configures useRealtime and processes new messages", async () => {
    const setTranslatedText = vi.fn();
    const setIsLoading = vi.fn();

    mockUseRealtime.mockReturnValue({
      messages: {
        all: [{ data: { type: "delta", text: "Ho" } }, { data: undefined }],
      },
    });

    const { rerender, unmount } = renderHook(
      ({ activeTranslationId, isLoading }) =>
        useTranslationRealtimeStream({
          activeTranslationId,
          isLoading,
          setTranslatedText,
          setIsLoading,
        }),
      {
        initialProps: {
          activeTranslationId: "tr-1" as string | null,
          isLoading: true,
        },
      },
    );

    expect(mockApplyTranslationRealtimeEvent).toHaveBeenCalledTimes(1);
    expect(mockApplyTranslationRealtimeEvent).toHaveBeenCalledWith(
      { type: "delta", text: "Ho" },
      setTranslatedText,
      setIsLoading,
    );

    // Test token fetcher success and failure
    const lastCall = mockUseRealtime.mock.calls[0][0];
    mockGetTranslationRealtimeToken.mockResolvedValueOnce({
      ok: true,
      value: { token: "tok" },
    });
    await expect(lastCall.token()).resolves.toEqual({ token: "tok" });

    mockGetTranslationRealtimeToken.mockResolvedValueOnce({
      ok: false,
      error: { message: "Unauthorized" },
    });
    await expect(lastCall.token()).rejects.toThrow("Unauthorized");

    // When messages.all shrinks (new stream), startIndex resets to 0
    mockUseRealtime.mockReturnValue({
      messages: {
        all: [{ data: { type: "delta", text: "La" } }],
      },
    });
    rerender({ activeTranslationId: "tr-2", isLoading: true });
    expect(mockApplyTranslationRealtimeEvent).toHaveBeenCalledTimes(2);

    // When activeTranslationId is null, token throws
    rerender({ activeTranslationId: null, isLoading: false });
    const nullCall = mockUseRealtime.mock.calls.at(-1)![0];
    await expect(nullCall.token()).rejects.toThrow("No active translation");

    unmount();
  });

  it("resets startIndex to 0 when messages array shrinks", () => {
    const setTranslatedText = vi.fn();
    const setIsLoading = vi.fn();
    mockUseRealtime.mockReturnValue({
      messages: {
        all: [
          { data: { type: "text-delta", text: "a" } },
          { data: { type: "text-delta", text: "b" } },
        ],
      },
    });
    const { rerender, unmount } = renderHook(
      ({ activeTranslationId, isLoading }) =>
        useTranslationRealtimeStream({
          activeTranslationId,
          isLoading,
          setTranslatedText,
          setIsLoading,
        }),
      { initialProps: { activeTranslationId: "tr-1" as string | null, isLoading: true } },
    );

    mockUseRealtime.mockReturnValue({
      messages: { all: [{ data: { type: "text-delta", text: "c" } }] },
    });
    rerender({ activeTranslationId: "tr-1", isLoading: true });
    expect(mockApplyTranslationRealtimeEvent).toHaveBeenCalled();
    unmount();
  });
});
