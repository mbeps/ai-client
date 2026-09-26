vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NODE_ENV: "test",
  },
}));

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of ["select", "from", "innerJoin", "where", "insert", "values", "returning"]) {
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

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { cloneAttachmentsBatch } from "@/actions/attachments/clone-attachments-batch";

describe("cloneAttachmentsBatch action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.innerJoin.mockReturnValue(chainable);
    chainable.insert.mockReturnValue(chainable);
    chainable.values.mockReturnValue(chainable);
    chainable.returning.mockReturnValue(chainable);
  });

  it("returns early when given an empty input array", async () => {
    const result = await cloneAttachmentsBatch([], "msg-1");
    expect(result).toEqual([]);
    expect(chainable.select).not.toHaveBeenCalled();
  });

  it("throws error when source attachments do not exist or count mismatch", async () => {
    chainable.where.mockResolvedValueOnce([]); // sources length 0 vs 1

    await expect(cloneAttachmentsBatch(["att-1"], "msg-1")).rejects.toThrow(
      "One or more source attachments not found",
    );
  });

  it("throws Forbidden error when source attachment owner does not match session user", async () => {
    chainable.where.mockResolvedValueOnce([
      {
        key: "file.txt",
        name: "file.txt",
        mimeType: "text/plain",
        size: 100,
        extractedText: "hello",
        ownerId: "other-user",
      },
    ]);

    await expect(cloneAttachmentsBatch(["att-1"], "msg-1")).rejects.toThrow("Forbidden");
  });

  it("throws error when target message is not found", async () => {
    chainable.where
      .mockResolvedValueOnce([
        {
          key: "file.txt",
          name: "file.txt",
          mimeType: "text/plain",
          size: 100,
          extractedText: "hello",
          ownerId: "user-1",
        },
      ])
      .mockResolvedValueOnce([]); // target message not found

    await expect(cloneAttachmentsBatch(["att-1"], "msg-1")).rejects.toThrow(
      "Target message not found",
    );
  });

  it("throws Forbidden error when target chat owner does not match session user", async () => {
    chainable.where
      .mockResolvedValueOnce([
        {
          key: "file.txt",
          name: "file.txt",
          mimeType: "text/plain",
          size: 100,
          extractedText: "hello",
          ownerId: "user-1",
        },
      ])
      .mockResolvedValueOnce([{ chatUserId: "other-user" }]);

    await expect(cloneAttachmentsBatch(["att-1"], "msg-1")).rejects.toThrow("Forbidden");
  });

  it("successfully clones attachments and returns new records", async () => {
    const clonedRow = {
      id: "new-att-1",
      key: "file.txt",
      name: "file.txt",
      mimeType: "text/plain",
      size: 100,
      extractedText: "hello",
    };

    chainable.where
      .mockResolvedValueOnce([
        {
          key: "file.txt",
          name: "file.txt",
          mimeType: "text/plain",
          size: 100,
          extractedText: "hello",
          ownerId: "user-1",
        },
      ])
      .mockResolvedValueOnce([{ chatUserId: "user-1" }]);

    chainable.returning.mockResolvedValueOnce([clonedRow]);

    const result = await cloneAttachmentsBatch(["att-1"], "msg-1");
    expect(result).toEqual([clonedRow]);
    expect(chainable.insert).toHaveBeenCalled();
  });
});
