vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NODE_ENV: "test",
  },
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

const generateTextMock = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({
  generateText: generateTextMock,
}));

vi.mock("@/lib/chat/resolve-default-chat-provider", () => ({
  resolveDefaultChatProvider: vi.fn().mockResolvedValue({
    modelId: "gpt-4",
    sdkProvider: {
      chat: vi.fn().mockReturnValue("mock-model"),
    },
  }),
}));

const fetchProviderWithModelMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/fetch-provider-with-model", () => ({
  fetchProviderWithModel: fetchProviderWithModelMock,
}));

const dbChainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of [
    "insert",
    "values",
    "returning",
    "select",
    "from",
    "where",
    "orderBy",
    "limit",
  ]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: dbChainable }));

vi.mock("inngest/react", () => ({
  getClientSubscriptionToken: vi.fn().mockResolvedValue("mock-trans-token"),
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLatestTranslationAction,
  getTranslationRealtimeToken,
  translateText,
  triggerTranslation,
} from "@/actions/workflows/translate";
import { ProviderNotConfiguredError, RateLimitError } from "@/lib/errors";
import { inngest } from "@/lib/inngest/client";


describe("translateText action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates language input parameters using translateRequestSchema", async () => {
    await expect(translateText({ sourceLanguage: "", targetLanguage: "", text: "" })).rejects.toThrow(/Invalid translation request/);
  });

  it("translates text from source to target language with valid output", async () => {
    generateTextMock.mockResolvedValueOnce({ text: "  Hola mundo  " });

    const res = await translateText({
      sourceLanguage: "English",
      targetLanguage: "Spanish",
      text: "Hello world",
    });

    expect(res).toBe("Hola mundo");
  });

  it("handles modelId option by calling fetchProviderWithModel", async () => {
    fetchProviderWithModelMock.mockResolvedValueOnce({
      modelId: "claude-3-opus",
      sdkProvider: {
        chat: vi.fn().mockReturnValue("mock-claude"),
      },
    });
    generateTextMock.mockResolvedValueOnce({ text: "Bonjour" });

    const res = await translateText({
      sourceLanguage: "English",
      targetLanguage: "French",
      text: "Hello",
      modelId: "model-claude-id",
    });

    expect(res).toBe("Bonjour");
    expect(fetchProviderWithModelMock).toHaveBeenCalledWith("user-1", { modelId: "model-claude-id" });
  });

  it("handles auto and Auto Detect source language", async () => {
    generateTextMock.mockResolvedValueOnce({ text: "Hallo" });

    const resAuto = await translateText({
      sourceLanguage: "auto",
      targetLanguage: "German",
      text: "Hello",
    });
    expect(resAuto).toBe("Hallo");

    generateTextMock.mockResolvedValueOnce({ text: "Hallo" });
    const resAutoDetect = await translateText({
      sourceLanguage: "Auto Detect",
      targetLanguage: "German",
      text: "Hello",
    });
    expect(resAutoDetect).toBe("Hallo");
  });

  it("handles image attachments with and without mimeType", async () => {
    generateTextMock.mockResolvedValueOnce({ text: "Image translated text" });

    const res = await translateText({
      sourceLanguage: "auto",
      targetLanguage: "Spanish",
      text: "",
      attachment: {
        id: "att-1",
        name: "test.png",
        size: 1024,
        type: "image",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,abc",
      },
    });

    expect(res).toBe("Image translated text");
    expect(generateTextMock).toHaveBeenCalledWith(expect.objectContaining({
      messages: [
        {
          role: "user",
          content: [
            expect.objectContaining({ type: "text" }),
            {
              type: "file",
              data: "data:image/png;base64,abc",
              mediaType: "image/png",
            },
          ],
        },
      ],
    }));
  });

  it("handles image attachment without dataUrl", async () => {
    generateTextMock.mockResolvedValueOnce({ text: "Image text without data url" });

    const res = await translateText({
      sourceLanguage: "auto",
      targetLanguage: "Spanish",
      text: "Fallback text",
      attachment: {
        id: "att-2",
        name: "test2.png",
        size: 1024,
        type: "image",
        mimeType: "image/png",
      },
    });
    expect(res).toBe("Image text without data url");
  });

  it("handles document attachment with extractedText", async () => {
    generateTextMock.mockResolvedValueOnce({ text: "Document translated" });

    const res = await translateText({
      sourceLanguage: "English",
      targetLanguage: "German",
      attachment: {
        name: "doc.pdf",
        type: "document",
        mimeType: "application/pdf",
        extractedText: "Extracted document content",
      },
    });

    expect(res).toBe("Document translated");
  });

  it("re-throws ProviderNotConfiguredError without wrapping", async () => {
    generateTextMock.mockRejectedValueOnce(new ProviderNotConfiguredError("Provider missing"));

    await expect(
      translateText({
        sourceLanguage: "English",
        targetLanguage: "Spanish",
        text: "Hello",
      }),
    ).rejects.toThrow(ProviderNotConfiguredError);
  });

  it("catches and transforms rate limit errors into RateLimitError", async () => {
    const rateLimitErr = new Error("Rate limit exceeded 429");
    (rateLimitErr as any).status = 429;
    generateTextMock.mockRejectedValueOnce(rateLimitErr);

    await expect(
      translateText({
        sourceLanguage: "English",
        targetLanguage: "Spanish",
        text: "Hello",
      }),
    ).rejects.toThrow(RateLimitError);
  });

  it("catches generic errors and throws a friendly user error", async () => {
    generateTextMock.mockRejectedValueOnce(new Error("AI Gateway exploded"));

    await expect(
      translateText({
        sourceLanguage: "English",
        targetLanguage: "Spanish",
        text: "Hello",
      }),
    ).rejects.toThrow("Failed to translate text. Please try again.");

    generateTextMock.mockRejectedValueOnce("Plain string explosion");
    await expect(
      translateText({
        sourceLanguage: "English",
        targetLanguage: "Spanish",
        text: "Hello",
      }),
    ).rejects.toThrow("Failed to translate text. Please try again.");
  });

  it("throws when non-image translation has no readable text", async () => {
    await expect(
      translateText({
        sourceLanguage: "English",
        targetLanguage: "Spanish",
        text: "   ",
        attachment: {
          name: "empty.pdf",
          type: "document",
          mimeType: "application/pdf",
          extractedText: "   ",
        },
      }),
    ).rejects.toThrow(/Either text or an attachment with content must be provided/);
  });

});

describe("triggerTranslation action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates input and throws on empty text without image", async () => {
    await expect(
      triggerTranslation({
        sourceLanguage: "English",
        targetLanguage: "Italian",
        text: "",
      }),
    ).rejects.toThrow(/Invalid translation request/);
  });

  it("inserts translation record and dispatches Inngest event", async () => {
    dbChainable.returning.mockResolvedValueOnce([
      { id: "trans-new-1", userId: "user-1", status: "pending" },
    ]);

    const result = await triggerTranslation({
      sourceLanguage: "English",
      targetLanguage: "German",
      text: "Hello world",
    });

    expect(result).toEqual({ translationId: "trans-new-1" });
    expect(dbChainable.insert).toHaveBeenCalled();
    expect(inngest.send).toHaveBeenCalledWith({
      name: "workflows/translate.execute",
      data: expect.objectContaining({
        translationId: "trans-new-1",
        userId: "user-1",
        sourceText: "Hello world",
      }),
    });
  });

  it("handles document attachment with extracted text", async () => {
    dbChainable.returning.mockResolvedValueOnce([
      { id: "trans-doc-1", userId: "user-1", status: "pending" },
    ]);

    const result = await triggerTranslation({
      sourceLanguage: "English",
      targetLanguage: "French",
      attachment: {
        name: "letter.pdf",
        type: "document",
        mimeType: "application/pdf",
        extractedText: "Letter body text",
      },
    });

    expect(result).toEqual({ translationId: "trans-doc-1" });
    expect(inngest.send).toHaveBeenCalledWith({
      name: "workflows/translate.execute",
      data: expect.objectContaining({
        translationId: "trans-doc-1",
        sourceText: "Letter body text",
      }),
    });
  });
});

describe("getTranslationRealtimeToken action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws Unauthorized if record not found or belongs to another user", async () => {
    dbChainable.where.mockResolvedValueOnce([]);

    await expect(getTranslationRealtimeToken("trans-ghost")).rejects.toThrow(
      "Unauthorized",
    );
  });

  it("returns subscription token when record exists and belongs to user", async () => {
    dbChainable.where.mockResolvedValueOnce([{ id: "trans-ok" }]);

    const token = await getTranslationRealtimeToken("trans-ok");
    expect(token).toBe("mock-trans-token");
  });
});

describe("getLatestTranslationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns latest translation record or null", async () => {
    dbChainable.limit.mockResolvedValueOnce([
      { id: "trans-recent", status: "completed", translatedText: "Ciao" },
    ]);

    const latest = await getLatestTranslationAction();
    expect(latest).toEqual({
      id: "trans-recent",
      status: "completed",
      translatedText: "Ciao",
    });

    dbChainable.limit.mockResolvedValueOnce([]);
    const empty = await getLatestTranslationAction();
    expect(empty).toBeNull();
  });
});


