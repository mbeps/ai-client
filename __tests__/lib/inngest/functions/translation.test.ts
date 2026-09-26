import { beforeEach, describe, expect, it, vi } from "vitest";

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of ["update", "set", "where"]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

const mockResolveProvider = vi.hoisted(() => vi.fn());
const mockFetchProviderWithModel = vi.hoisted(() => vi.fn());
const mockStreamText = vi.hoisted(() => vi.fn());

vi.mock("@/lib/chat/resolve-default-chat-provider", () => ({
  resolveDefaultChatProvider: mockResolveProvider,
}));

vi.mock("@/lib/chat/fetch-provider-with-model", () => ({
  fetchProviderWithModel: mockFetchProviderWithModel,
}));

vi.mock("ai", () => ({
  streamText: mockStreamText,
}));

import { inngest } from "@/lib/inngest/client";
import { executeTranslationWorkflow } from "@/lib/inngest/functions/translation";

describe("executeTranslationWorkflow Inngest Function", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockResolveProvider.mockResolvedValue({
      modelId: "gpt-4o",
      sdkProvider: { chat: () => () => {} },
    });

    mockFetchProviderWithModel.mockResolvedValue({
      modelId: "custom-model",
      sdkProvider: { chat: () => () => {} },
    });

    mockStreamText.mockReturnValue({
      textStream: (async function* () {
        yield "Ciao ";
        yield "mondo!";
      })(),
    });
  });

  it("streams translation tokens and marks record as completed", async () => {
    const fn = (executeTranslationWorkflow as any).fn;

    const result = await fn({
      event: {
        data: {
          translationId: "trans-1",
          userId: "user-1",
          sourceLanguage: "English",
          targetLanguage: "Italian",
          sourceText: "Hello world!",
        },
      },
    });

    expect(result).toEqual({
      success: true,
      translationId: "trans-1",
      translatedText: "Ciao mondo!",
    });

    expect(chainable.update).toHaveBeenCalled();
    expect(chainable.set).toHaveBeenCalledWith({ status: "translating" });
    expect(chainable.set).toHaveBeenCalledWith({
      status: "completed",
      translatedText: "Ciao mondo!",
    });

    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      { type: "start", translationId: "trans-1" },
    );
    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      { type: "text-delta", text: "Ciao " },
    );
    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      { type: "text-delta", text: "mondo!" },
    );
    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      { type: "finish", translatedText: "Ciao mondo!" },
    );
  });

  it("resolves specific model when modelId is provided", async () => {
    const fn = (executeTranslationWorkflow as any).fn;

    await fn({
      event: {
        data: {
          translationId: "trans-2",
          userId: "user-1",
          sourceLanguage: "auto",
          targetLanguage: "Spanish",
          sourceText: "Hello",
          modelId: "custom-model",
        },
      },
    });

    expect(mockFetchProviderWithModel).toHaveBeenCalledWith("user-1", {
      modelId: "custom-model",
    });
  });

  it("handles image attachments with dataUrl and mimeType", async () => {
    const fn = (executeTranslationWorkflow as any).fn;

    await fn({
      event: {
        data: {
          translationId: "trans-3",
          userId: "user-1",
          sourceLanguage: "English",
          targetLanguage: "French",
          sourceText: "",
          isImage: true,
          attachmentDataUrl: "data:image/png;base64,123",
          attachmentMimeType: "image/png",
        },
      },
    });

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({ type: "text" }),
              expect.objectContaining({
                type: "file",
                data: "data:image/png;base64,123",
                mediaType: "image/png",
              }),
            ]),
          }),
        ],
      }),
    );
  });

  it("handles failure by updating status to failed and emitting error", async () => {
    mockStreamText.mockImplementationOnce(() => {
      throw new Error("Provider stream exploded");
    });

    const fn = (executeTranslationWorkflow as any).fn;

    await expect(
      fn({
        event: {
          data: {
            translationId: "trans-err",
            userId: "user-1",
            sourceLanguage: "English",
            targetLanguage: "German",
            sourceText: "Test error",
          },
        },
      }),
    ).rejects.toThrow("Provider stream exploded");

    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        errorMessage: expect.stringContaining("Provider stream exploded"),
      }),
    );

    expect(inngest.realtime.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: "error",
        message: expect.stringContaining("Provider stream exploded"),
      }),
    );
  });
});

