import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTranslationFormState } from "@/components/workflows/translation/use-translation-form-state";
import {
  DEFAULT_SOURCE_LANGUAGE,
  DEFAULT_TARGET_LANGUAGE,
} from "@/config/languages";

const mockToastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
  },
}));

describe("useTranslationFormState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("initializes with default values and updates state", () => {
    const { result, unmount } = renderHook(() => useTranslationFormState());

    expect(result.current.sourceText).toBe("");
    expect(result.current.translatedText).toBe("");
    expect(result.current.sourceLangValue).toBe(DEFAULT_SOURCE_LANGUAGE);
    expect(result.current.targetLangValue).toBe(DEFAULT_TARGET_LANGUAGE);
    expect(result.current.isCopied).toBe(false);

    act(() => {
      result.current.setSourceText("Hello");
      result.current.setTranslatedText("Hola");
      result.current.setSourceLangValue("en");
      result.current.setTargetLangValue("es");
      result.current.setModelId("gpt-4");
      result.current.setReasoningEffort("high");
      result.current.setAttachment({
        id: "1",
        name: "doc.txt",
        type: "document",
        mimeType: "text/plain",
        size: 10,
        dataUrl: "data:text/plain;base64,QQ==",
      });
      result.current.setIsExtracting(true);
    });

    expect(result.current.sourceLang.value).toBe("en");
    expect(result.current.targetLang.value).toBe("es");

    // Fallback when unknown language value is set
    act(() => {
      result.current.setSourceLangValue("unknown-lang");
      result.current.setTargetLangValue("unknown-lang");
    });
    expect(result.current.sourceLang.value).toBeDefined();
    expect(result.current.targetLang.value).toBeDefined();

    unmount();
  });

  it("handles copy when translatedText is empty and non-empty", () => {
    const { result, unmount } = renderHook(() => useTranslationFormState());

    act(() => {
      result.current.handleCopy();
    });
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();

    act(() => {
      result.current.setTranslatedText("Bonjour");
    });
    act(() => {
      result.current.handleCopy();
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Bonjour");
    expect(result.current.isCopied).toBe(true);
    expect(mockToastSuccess).toHaveBeenCalledWith("Copied to clipboard");

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.isCopied).toBe(false);

    unmount();
  });

  it("handles reset and removeAttachment", () => {
    const { result, unmount } = renderHook(() => useTranslationFormState());

    act(() => {
      result.current.setSourceText("Hi");
      result.current.setTranslatedText("Hola");
      result.current.setAttachment({
        id: "1",
        name: "img.png",
        type: "image",
        mimeType: "image/png",
        size: 10,
        dataUrl: "data:image/png;base64,AA==",
      });
    });

    act(() => {
      result.current.removeAttachment();
    });
    expect(result.current.attachment).toBeNull();

    act(() => {
      result.current.setAttachment({
        id: "2",
        name: "img2.png",
        type: "image",
        mimeType: "image/png",
        size: 10,
        dataUrl: "data:image/png;base64,AA==",
      });
    });

    act(() => {
      result.current.handleReset();
    });
    expect(result.current.sourceText).toBe("");
    expect(result.current.translatedText).toBe("");
    expect(result.current.attachment).toBeNull();

    unmount();
  });
});
