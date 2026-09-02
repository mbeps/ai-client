import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSend = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(function () {
    return { send: mockSend };
  }),
  DeleteObjectCommand: vi.fn().mockImplementation(function (params: object) {
    return { _type: "DeleteObjectCommand", ...params };
  }),
}));

vi.mock("@/lib/env", () => ({
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

vi.mock("@/drizzle/db", () => ({
  db: { select: vi.fn() },
}));

import { db } from "@/drizzle/db";
import { sweepOrphanedAttachmentKeys } from "@/lib/storage/sweep-orphaned-attachment-keys";

// ponytail: chain methods are no-ops; only the rows resolved by groupBy matter
function stubCountQuery(rows: Array<{ key: string; count: number }>) {
  const builder = {
    from: () => builder,
    where: () => builder,
    groupBy: () => Promise.resolve(rows),
  };
  vi.mocked(db.select).mockReturnValue(builder as never);
}

describe("sweepOrphanedAttachmentKeys", () => {
  beforeEach(() => {
    mockSend.mockReset();
    vi.mocked(db.select).mockReset();
  });

  it("issues DeleteObjectCommand for keys with zero remaining references", async () => {
    stubCountQuery([]);
    mockSend.mockResolvedValue({});

    await sweepOrphanedAttachmentKeys(["a", "b"]);

    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("does not delete keys still referenced by other attachment rows", async () => {
    stubCountQuery([{ key: "a", count: 3 }]);
    mockSend.mockResolvedValue({});

    await sweepOrphanedAttachmentKeys(["a"]);

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("never throws when S3 deletion fails", async () => {
    stubCountQuery([]);
    mockSend.mockRejectedValue(new Error("S3 down"));

    await expect(sweepOrphanedAttachmentKeys(["a"])).resolves.toBeUndefined();
  });
});
