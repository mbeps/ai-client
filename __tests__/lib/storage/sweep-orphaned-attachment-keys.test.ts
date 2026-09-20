import { beforeEach, describe, expect, it, vi } from "vitest";

const chainable = vi.hoisted(() => {
  const c: any = {};
  c.select = vi.fn().mockReturnValue(c);
  c.from = vi.fn().mockReturnValue(c);
  c.where = vi.fn().mockReturnValue(c);
  c.groupBy = vi.fn();
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    S3_BUCKET: "test-bucket",
    S3_REGION: "us-east-1",
    S3_ENDPOINT: "http://localhost:9000",
    S3_ACCESS_KEY: "test-access-key",
    S3_SECRET_KEY: "test-secret-key",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    POSTMARK_SERVER_TOKEN: "test-token",
    NODE_ENV: "test",
  },
}));

const deleteObjectMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage/delete-object", () => ({
  deleteObject: deleteObjectMock,
}));

import { sweepOrphanedAttachmentKeys } from "@/lib/storage/sweep-orphaned-attachment-keys";

describe("sweepOrphanedAttachmentKeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.where.mockReturnValue(chainable);
    deleteObjectMock.mockResolvedValue(undefined);
  });

  it("returns early when keys array is empty", async () => {
    await sweepOrphanedAttachmentKeys([]);
    expect(chainable.select).not.toHaveBeenCalled();
  });

  it("deletes orphaned keys that are not referenced in the database", async () => {
    // key1 is referenced in DB, key2 is orphaned
    chainable.groupBy.mockResolvedValueOnce([{ key: "key1", count: 1 }]);

    await sweepOrphanedAttachmentKeys(["key1", "key2", "key1"]);

    expect(deleteObjectMock).toHaveBeenCalledTimes(1);
    expect(deleteObjectMock).toHaveBeenCalledWith("key2");
  });

  it("does not delete keys still referenced by other attachment rows", async () => {
    chainable.groupBy.mockResolvedValueOnce([{ key: "a", count: 3 }]);

    await sweepOrphanedAttachmentKeys(["a"]);

    expect(deleteObjectMock).not.toHaveBeenCalled();
  });

  it("handles deleteObject throwing Error and non-Error objects without throwing", async () => {
    chainable.groupBy.mockResolvedValueOnce([]);
    deleteObjectMock
      .mockRejectedValueOnce(new Error("S3 error"))
      .mockRejectedValueOnce("String error");

    await expect(
      sweepOrphanedAttachmentKeys(["key-err1", "key-err2"]),
    ).resolves.not.toThrow();

    expect(deleteObjectMock).toHaveBeenCalledTimes(2);
  });

  it("catches and logs database query errors without throwing", async () => {
    chainable.groupBy.mockRejectedValueOnce(new Error("DB connection lost"));

    await expect(
      sweepOrphanedAttachmentKeys(["key1"]),
    ).resolves.not.toThrow();

    // With non-Error
    chainable.groupBy.mockRejectedValueOnce("string db error");
    await expect(
      sweepOrphanedAttachmentKeys(["key1"]),
    ).resolves.not.toThrow();
  });
});
