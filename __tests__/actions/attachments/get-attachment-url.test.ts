// ── env must be mocked before any module that reads it ──────────────────────
vi.mock("@/config/env", () => ({
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

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of ["select", "from", "where"]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

const getPresignedUrlMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage/get-presigned-url", () => ({
  getPresignedUrl: getPresignedUrlMock,
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAttachmentUrl } from "@/actions/attachments/get-attachment-url";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

describe("getAttachmentUrl action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
  });

  it("successfully retrieves presigned URL for owned attachment", async () => {
    chainable.where.mockResolvedValueOnce([
      {
        id: VALID_UUID,
        key: "attachments/user-1/file.txt",
        name: "file.txt",
        mimeType: "text/plain",
      },
    ]);
    getPresignedUrlMock.mockResolvedValue("https://s3.example.com/presigned");

    const result = await getAttachmentUrl(VALID_UUID);

    expect(result).toEqual({
      url: "https://s3.example.com/presigned",
      name: "file.txt",
      mimeType: "text/plain",
    });
    expect(getPresignedUrlMock).toHaveBeenCalledWith("attachments/user-1/file.txt");
  });

  it("throws error if id is not a valid UUID", async () => {
    await expect(getAttachmentUrl("not-a-uuid")).rejects.toThrow();
  });

  it("throws 'Not Found' if attachment does not exist or user does not own it", async () => {
    chainable.where.mockResolvedValueOnce([]);

    await expect(getAttachmentUrl(VALID_UUID)).rejects.toThrow("Not Found");
  });

  it("throws error if session is unauthenticated", async () => {
    const { requireSession } = await import("@/lib/auth/require-session");
    vi.mocked(requireSession).mockRejectedValueOnce(new Error("Unauthorized"));

    await expect(getAttachmentUrl(VALID_UUID)).rejects.toThrow("Unauthorized");
  });
});
