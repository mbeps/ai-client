import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTranslationWorkflow } from "@/components/workflows/translation/use-translation-workflow";

const mockGetLatestTranslationAction = vi.hoisted(() => vi.fn());
const mockExecuteTranslationRequest = vi.hoisted(() => vi.fn());
const mockApplyHydratedTranslation = vi.hoisted(() => vi.fn());
const mockHandleProcessedAttachment = vi.hoisted(() => vi.fn());
const mockSwapLanguageState = vi.hoisted(() => vi.fn());
const mockProcessAttachment = vi.hoisted(() => vi.fn());
const mockUseUserModels = vi.hoisted(() => vi.fn());
const mockHandleApiError = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());

vi.mock("@/actions/workflows/get-latest-translation", () => ({
  getLatestTranslationAction: mockGetLatestTranslationAction,
}));

vi.mock("@/components/workflows/translation/translation-helpers", () => ({
  executeTranslationRequest: mockExecuteTranslationRequest,
  applyHydratedTranslation: mockApplyHydratedTranslation,
  handleProcessedAttachment: mockHandleProcessedAttachment,
  swapLanguageState: mockSwapLanguageState,
}));

vi.mock("@/components/workflows/translation/use-translation-realtime-stream", () => ({
  useTranslationRealtimeStream: vi.fn(),
}));

vi.mock("@/hooks/use-api-error", () => ({
  useApiError: () => ({ handleApiError: mockHandleApiError }),
}));

vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: mockUseUserModels,
}));

vi.mock("@/lib/attachments/process-attachment", () => ({
  processAttachment: mockProcessAttachment,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
    success: vi.fn(),
  },
}));

describe("useTranslationWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLatestTranslationAction.mockResolvedValue({ ok: true, value: null });
    mockUseUserModels.mockReturnValue({
      models: [
        {
          modelId: "gpt-4o",
          capVision: true,
          reasoningEffortFormat: "openai",
        },
        {
          modelId: "plain-model",
          capVision: false,
          reasoningEffortFormat: "none",
        },
      ],
      isLoading: false,
    });
  });

  it("hydrates latest translation on mount and ignores errors", async () => {
    mockGetLatestTranslationAction.mockResolvedValueOnce({
      ok: true,
      value: { id: "tr-1" },
    });

    const { unmount } = renderHook(() => useTranslationWorkflow());
    await waitFor(() => {
      expect(mockApplyHydratedTranslation).toHaveBeenCalledTimes(1);
    });
    unmount();

    mockGetLatestTranslationAction.mockRejectedValueOnce(new Error("fail"));
    const { unmount: unmount2 } = renderHook(() => useTranslationWorkflow());
    await waitFor(() => {
      expect(mockGetLatestTranslationAction).toHaveBeenCalledTimes(2);
    });
    unmount2();
  });

  it("handles translate, swap, reset, and file selection", async () => {
    mockExecuteTranslationRequest.mockImplementation(async ({ onSuccess, onError }) => {
      onSuccess("tr-new");
      onError();
    });

    const { result, unmount } = renderHook(() => useTranslationWorkflow());

    // Empty text & no image -> clears translatedText and returns early
    await act(async () => {
      await result.current.handleTranslate();
    });
    expect(mockExecuteTranslationRequest).not.toHaveBeenCalled();

    // With text -> executes translation
    act(() => {
      result.current.setSourceText("Hello");
    });
    expect(result.current.canTranslate).toBe(true);
    expect(result.current.isVisionModel).toBe(true);
    expect(result.current.supportsReasoningEffort).toBe(true);

    await act(async () => {
      await result.current.handleTranslate();
    });
    expect(mockExecuteTranslationRequest).toHaveBeenCalledTimes(1);

    // Swap languages
    act(() => {
      result.current.swapLanguages();
    });
    expect(mockSwapLanguageState).toHaveBeenCalledTimes(1);

    // Reset
    act(() => {
      result.current.handleReset();
    });
    expect(result.current.sourceText).toBe("");

    // File select: no file
    await act(async () => {
      await result.current.handleFileSelect({
        target: { files: [] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });
    expect(mockProcessAttachment).not.toHaveBeenCalled();

    // File select: success
    const file = new File(["abc"], "test.txt", { type: "text/plain" });
    mockProcessAttachment.mockResolvedValueOnce({
      id: "1",
      name: "test.txt",
      type: "document",
      mimeType: "text/plain",
      size: 3,
      dataUrl: "data:text/plain;base64,YWJj",
    });
    await act(async () => {
      await result.current.handleFileSelect({
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });
    expect(mockHandleProcessedAttachment).toHaveBeenCalledTimes(1);

    // File select: Error thrown
    mockProcessAttachment.mockRejectedValueOnce(new Error("Bad file"));
    await act(async () => {
      await result.current.handleFileSelect({
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });
    expect(mockToastError).toHaveBeenCalledWith("Bad file");

    // File select: non-Error thrown
    mockProcessAttachment.mockRejectedValueOnce("string error");
    await act(async () => {
      await result.current.handleFileSelect({
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });
    expect(mockToastError).toHaveBeenCalledWith("Failed to process file");

    unmount();
  });

  it("handles empty models and non-reasoning model", async () => {
    mockUseUserModels.mockReturnValue({
      models: [],
      isLoading: false,
    });
    const { result, unmount } = renderHook(() => useTranslationWorkflow());
    expect(result.current.canTranslate).toBe(false);
    expect(result.current.isVisionModel).toBe(false);
    expect(result.current.supportsReasoningEffort).toBe(false);
    unmount();
  });

  it("clears fileInputRef.current.value in handleFileSelect finally", async () => {
    const { result, unmount } = renderHook(() => useTranslationWorkflow());
    const inputEl = document.createElement("input");
    (result.current.fileInputRef as { current: HTMLInputElement | null }).current =
      inputEl;

    const file = new File(["hello"], "test.txt", { type: "text/plain" });
    await act(async () => {
      await result.current.handleFileSelect({
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });
    expect(inputEl.value).toBe("");
    unmount();
  });

  it("disables translate when loading and omits reasoningEffort for non-reasoning model", async () => {
    mockUseUserModels.mockReturnValue({
      models: [{ id: "gpt-3.5", name: "GPT-3.5", supportsVision: false, supportsReasoningEffort: false }],
      isLoading: false,
    });
    const { result, unmount } = renderHook(() => useTranslationWorkflow());
    act(() => {
      result.current.setSourceText("Hello");
    });
    await act(async () => {
      await result.current.handleTranslate();
    });
    expect(mockExecuteTranslationRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        reasoningEffort: undefined,
      }),
    );
    expect(result.current.canTranslate).toBe(true);
    unmount();
  });

  it("sets canTranslate to false while translation is loading", async () => {
    let resolveReq!: () => void;
    mockExecuteTranslationRequest.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveReq = resolve; }),
    );
    const { result, unmount } = renderHook(() => useTranslationWorkflow());
    act(() => {
      result.current.setSourceText("Hello");
    });
    let translatePromise!: Promise<void>;
    act(() => {
      translatePromise = result.current.handleTranslate();
    });
    expect(result.current.canTranslate).toBe(false);
    await act(async () => {
      resolveReq();
      await translatePromise;
    });
    unmount();
  });
});
