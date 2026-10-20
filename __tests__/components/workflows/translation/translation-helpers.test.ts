import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { triggerTranslation } from "@/actions/workflows/translate";
import {
  applyHydratedTranslation,
  applyTranslationRealtimeEvent,
  executeTranslationRequest,
  handleProcessedAttachment,
  swapLanguageState,
  toTranslationAttachmentPayload,
} from "@/components/workflows/translation/translation-helpers";
import type { Attachment } from "@/types/attachment/attachment";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/actions/workflows/translate", () => ({
  triggerTranslation: vi.fn(),
}));

describe("translation-helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("applyTranslationRealtimeEvent", () => {
    it("handles start event by clearing translated text", () => {
      const setTranslatedText = vi.fn();
      const setIsLoading = vi.fn();

      applyTranslationRealtimeEvent(
        { type: "start" },
        setTranslatedText,
        setIsLoading,
      );

      expect(setTranslatedText).toHaveBeenCalledWith("");
    });

    it("handles text-delta event by appending text", () => {
      const setTranslatedText = vi.fn();
      const setIsLoading = vi.fn();

      applyTranslationRealtimeEvent(
        { type: "text-delta", text: "Hello" },
        setTranslatedText,
        setIsLoading,
      );

      expect(setTranslatedText).toHaveBeenCalledTimes(1);
      const updater = setTranslatedText.mock.calls[0][0];
      expect(updater("Previous ")).toBe("Previous Hello");
    });

    it("handles finish event by updating text and ending loading", () => {
      const setTranslatedText = vi.fn();
      const setIsLoading = vi.fn();

      applyTranslationRealtimeEvent(
        { type: "finish", translatedText: "Final Text" },
        setTranslatedText,
        setIsLoading,
      );

      expect(setTranslatedText).toHaveBeenCalledWith("Final Text");
      expect(setIsLoading).toHaveBeenCalledWith(false);
    });

    it("handles error event by stopping loading and showing error toast", () => {
      const setTranslatedText = vi.fn();
      const setIsLoading = vi.fn();

      applyTranslationRealtimeEvent(
        { type: "error", message: "Failed network" },
        setTranslatedText,
        setIsLoading,
      );

      expect(setIsLoading).toHaveBeenCalledWith(false);
      expect(toast.error).toHaveBeenCalledWith("Failed network");
    });
  });

  describe("applyHydratedTranslation", () => {
    it("rehydrates pending/translating translation state", () => {
      const setters = {
        setActiveTranslationId: vi.fn(),
        setSourceText: vi.fn(),
        setTranslatedText: vi.fn(),
        setIsLoading: vi.fn(),
        setSourceLangValue: vi.fn(),
        setTargetLangValue: vi.fn(),
        setModelId: vi.fn(),
      };

      applyHydratedTranslation(
        {
          id: "tx-1",
          status: "pending",
          sourceText: "Bonjour",
          translatedText: "Hello",
          sourceLanguage: "French",
          targetLanguage: "English",
          modelId: "gpt-4",
          userId: "user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        setters,
      );

      expect(setters.setActiveTranslationId).toHaveBeenCalledWith("tx-1");
      expect(setters.setSourceText).toHaveBeenCalledWith("Bonjour");
      expect(setters.setTranslatedText).toHaveBeenCalledWith("Hello");
      expect(setters.setIsLoading).toHaveBeenCalledWith(true);
      expect(setters.setModelId).toHaveBeenCalledWith("gpt-4");
    });

    it("rehydrates completed translation state", () => {
      const setters = {
        setActiveTranslationId: vi.fn(),
        setSourceText: vi.fn(),
        setTranslatedText: vi.fn(),
        setIsLoading: vi.fn(),
        setSourceLangValue: vi.fn(),
        setTargetLangValue: vi.fn(),
        setModelId: vi.fn(),
      };

      applyHydratedTranslation(
        {
          id: "tx-2",
          status: "completed",
          sourceText: "Hola",
          translatedText: "Hello",
          sourceLanguage: "Spanish",
          targetLanguage: "English",
          modelId: "gpt-4",
          userId: "user-1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        setters,
      );

      expect(setters.setSourceText).toHaveBeenCalledTimes(1);
      const sourceUpdater = setters.setSourceText.mock.calls[0][0];
      expect(sourceUpdater("")).toBe("Hola");

      expect(setters.setTranslatedText).toHaveBeenCalledTimes(1);
      const targetUpdater = setters.setTranslatedText.mock.calls[0][0];
      expect(targetUpdater("")).toBe("Hello");
    });
  });

  describe("toTranslationAttachmentPayload", () => {
    it("returns undefined for null attachment", () => {
      expect(toTranslationAttachmentPayload(null)).toBeUndefined();
    });

    it("returns formatted attachment payload", () => {
      const attachment: Attachment = {
        id: "att-1",
        name: "doc.txt",
        type: "document",
        mimeType: "text/plain",
        dataUrl: "data:text/plain;base64,abc",
        extractedText: "Extracted document text",
        size: 100,
      };

      const result = toTranslationAttachmentPayload(attachment);
      expect(result).toEqual({
        name: "doc.txt",
        type: "document",
        mimeType: "text/plain",
        dataUrl: "data:text/plain;base64,abc",
        extractedText: "Extracted document text",
      });
    });
  });

  describe("handleProcessedAttachment", () => {
    it("truncates extracted text from document attachments", () => {
      const setSourceText = vi.fn();
      const attachment: Attachment = {
        id: "att-2",
        name: "test.pdf",
        type: "document",
        mimeType: "application/pdf",
        dataUrl: "data:...",
        extractedText: "A".repeat(6000),
        size: 500,
      };

      handleProcessedAttachment(attachment, setSourceText);
      expect(setSourceText).toHaveBeenCalledWith("A".repeat(5000));
    });

    it("warns if document has no extracted text", () => {
      const setSourceText = vi.fn();
      const attachment: Attachment = {
        id: "att-3",
        name: "empty.pdf",
        type: "document",
        mimeType: "application/pdf",
        dataUrl: "data:...",
        extractedText: "   ",
        size: 500,
      };

      handleProcessedAttachment(attachment, setSourceText);
      expect(toast.warning).toHaveBeenCalled();
      expect(setSourceText).not.toHaveBeenCalled();
    });
  });

  describe("swapLanguageState", () => {
    it("does nothing if source is auto", () => {
      const setters = {
        setSourceLangValue: vi.fn(),
        setTargetLangValue: vi.fn(),
        setSourceText: vi.fn(),
        setTranslatedText: vi.fn(),
      };

      swapLanguageState("auto", "es", "Source", "Target", setters);
      expect(setters.setSourceLangValue).not.toHaveBeenCalled();
    });

    it("swaps languages and texts when source is not auto", () => {
      const setters = {
        setSourceLangValue: vi.fn(),
        setTargetLangValue: vi.fn(),
        setSourceText: vi.fn(),
        setTranslatedText: vi.fn(),
      };

      swapLanguageState("en", "es", "English text", "Spanish text", setters);
      expect(setters.setSourceLangValue).toHaveBeenCalledWith("es");
      expect(setters.setTargetLangValue).toHaveBeenCalledWith("en");
      expect(setters.setSourceText).toHaveBeenCalledWith("Spanish text");
      expect(setters.setTranslatedText).toHaveBeenCalledWith("English text");
    });
  });

  describe("executeTranslationRequest", () => {
    it("triggers translation and calls onSuccess", async () => {
      vi.mocked(triggerTranslation).mockResolvedValue({
        translationId: "tx-created",
      } as any);

      const onSuccess = vi.fn();
      const onError = vi.fn();
      const handleApiError = vi.fn().mockReturnValue(false);

      await executeTranslationRequest({
        sourceText: "Hello world",
        sourceLangLabel: "English",
        targetLangLabel: "Spanish",
        modelId: "gpt-4",
        attachment: null,
        handleApiError,
        onSuccess,
        onError,
      });

      expect(triggerTranslation).toHaveBeenCalledWith({
        text: "Hello world",
        sourceLanguage: "English",
        targetLanguage: "Spanish",
        modelId: "gpt-4",
        attachment: undefined,
      });
      expect(onSuccess).toHaveBeenCalledWith("tx-created");
      expect(onError).not.toHaveBeenCalled();
    });

    it("handles error and notifies user", async () => {
      vi.mocked(triggerTranslation).mockRejectedValue(
        new Error("Network offline"),
      );

      const onSuccess = vi.fn();
      const onError = vi.fn();
      const handleApiError = vi.fn().mockReturnValue(false);

      await executeTranslationRequest({
        sourceText: "Hello world",
        sourceLangLabel: "English",
        targetLangLabel: "Spanish",
        attachment: null,
        handleApiError,
        onSuccess,
        onError,
      });

      expect(onError).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("Network offline");
    });
  });
});

