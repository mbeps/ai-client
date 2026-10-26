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
import { getLatestTranslationAction } from "@/actions/workflows/get-latest-translation";
import { getTranslationRealtimeToken } from "@/actions/workflows/get-translation-realtime-token";
import { triggerTranslation } from "@/actions/workflows/trigger-translation";
import { inngest } from "@/lib/inngest/client";

describe("empty source text guard", () => {
  it.each([
    [
      "no text and no attachment",
      {
        sourceLanguage: "English",
        targetLanguage: "Italian",
        text: "",
      },
    ],
    [
      "whitespace text only",
      {
        sourceLanguage: "English",
        targetLanguage: "Italian",
        text: "   ",
      },
    ],
    [
      "document attachment with no extracted text",
      {
        sourceLanguage: "English",
        targetLanguage: "Italian",
        attachment: {
          name: "empty.pdf",
          type: "document",
          mimeType: "application/pdf",
        },
      },
    ],
    [
      "document attachment with whitespace extracted text",
      {
        sourceLanguage: "English",
        targetLanguage: "Italian",
        attachment: {
          name: "empty.pdf",
          type: "document",
          mimeType: "application/pdf",
          extractedText: "   ",
        },
      },
    ],
    [
      "undefined text with no attachment",
      {
        sourceLanguage: "English",
        targetLanguage: "Italian",
        text: undefined,
      },
    ],
  ])(
    "triggerTranslation rejects before the action guard: %s",
    async (_label, input) => {
      await expect(triggerTranslation(input)).rejects.toThrow(
        /Invalid translation request/,
      );
      expect(dbChainable.insert).not.toHaveBeenCalled();
    },
  );
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

  it("falls back to an empty source text and forwards image data for an image with no text", async () => {
    dbChainable.returning.mockResolvedValueOnce([
      { id: "trans-img-1", userId: "user-1", status: "pending" },
    ]);

    const result = await triggerTranslation({
      sourceLanguage: "English",
      targetLanguage: "Japanese",
      attachment: {
        name: "sign.png",
        type: "image",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,AAA",
      },
    });

    expect(result).toEqual({ translationId: "trans-img-1" });
    // sourceText falls through both `||` operands to the "" literal
    expect(dbChainable.values).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceText: "",
        attachmentName: "sign.png",
        attachmentType: "image",
      }),
    );
    // isImage is true, so dataUrl/mimeType are forwarded rather than undefined
    expect(inngest.send).toHaveBeenCalledWith({
      name: "workflows/translate.execute",
      data: expect.objectContaining({
        isImage: true,
        sourceText: "",
        attachmentDataUrl: "data:image/png;base64,AAA",
        attachmentMimeType: "image/png",
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


