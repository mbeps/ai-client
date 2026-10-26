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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireUserAttachment } from "@/lib/attachments/attachment-auth";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

describe("requireUserAttachment auth guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
  });

  it("returns attachment and userId when found and owned by user", async () => {
    const mockRow = {
      id: VALID_UUID,
      userId: "user-1",
      name: "report.pdf",
      mimeType: "application/pdf",
      size: 1024,
      key: "attachments/user-1/report.pdf",
    };
    chainable.where.mockResolvedValueOnce([mockRow]);

    const result = await requireUserAttachment(VALID_UUID);
    expect(result).toEqual({
      userId: "user-1",
      attachment: mockRow,
    });
  });

  it("throws validation error when id is not a valid UUID", async () => {
    await expect(requireUserAttachment("invalid-id")).rejects.toThrow();
  });

  it("throws 'Not Found' when attachment does not exist or belongs to another user", async () => {
    chainable.where.mockResolvedValueOnce([]);

    await expect(requireUserAttachment(VALID_UUID)).rejects.toThrow("Not Found");
  });
});

