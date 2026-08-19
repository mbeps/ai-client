// ── env must be mocked before any module that reads it ──────────────────────
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY: "test",
    S3_SECRET_KEY: "test",
    S3_BUCKET: "test-bucket",
    POSTMARK_SERVER_TOKEN: "test-token",
    POSTMARK_FROM_EMAIL: "noreply@example.com",
    NODE_ENV: "test",
  },
}));

// ── chainable DB mock ─────────────────────────────────────────────────────────
const chainable = vi.hoisted(() => {
  const c = { select: vi.fn(), from: vi.fn(), where: vi.fn() };
  c.select.mockReturnValue(c);
  c.from.mockReturnValue(c);
  c.where.mockResolvedValue([]);
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

const mockGetPresignedUrl = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage/get-presigned-url", () => ({
  getPresignedUrl: mockGetPresignedUrl,
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAttachmentUrls } from "@/lib/chat/attachments/get-attachment-urls";
import type { ChatMessage } from "@/schemas/chat/chat";

const MSG_UNOWNED: ChatMessage = {
  role: "user",
  content: "here is a file",
  attachments: [
    { id: "att-1", name: "secret.xlsx", key: "uploads/user-B/secret.xlsx" },
  ],
};

const MSG_OWNED: ChatMessage = {
  role: "user",
  content: "my file",
  attachments: [
    { id: "att-2", name: "report.pdf", key: "uploads/user-A/report.pdf" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  chainable.select.mockReturnValue(chainable);
  chainable.from.mockReturnValue(chainable);
  chainable.where.mockResolvedValue([]);
  mockGetPresignedUrl.mockResolvedValue("https://example.com/presigned");
});

describe("getAttachmentUrls", () => {
  it("returns empty array when history has no messages", async () => {
    const result = await getAttachmentUrls([], "user-A");
    expect(result).toHaveLength(0);
  });

  describe("IDOR security: ownership verification", () => {
    it("does not generate presigned URLs for keys not owned by the user", async () => {
      // DB returns no rows — user-A does not own user-B's attachment key
      chainable.where.mockResolvedValueOnce([]);

      const result = await getAttachmentUrls([MSG_UNOWNED], "user-A");

      expect(result).toHaveLength(0);
      expect(mockGetPresignedUrl).not.toHaveBeenCalled();
    });

    it("generates presigned URLs for keys confirmed as owned by the user", async () => {
      chainable.where.mockResolvedValueOnce([
        { key: "uploads/user-A/report.pdf", name: "report.pdf" },
      ]);
      mockGetPresignedUrl.mockResolvedValueOnce("https://example.com/report");

      const result = await getAttachmentUrls([MSG_OWNED], "user-A");

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: "report.pdf",
        url: "https://example.com/report",
      });
      expect(mockGetPresignedUrl).toHaveBeenCalledWith(
        "uploads/user-A/report.pdf",
      );
    });
  });
});
