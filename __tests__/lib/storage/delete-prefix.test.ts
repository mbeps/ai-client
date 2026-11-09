import { beforeEach, describe, expect, it, vi } from "vitest";

const s3ClientMock = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("@/lib/storage/s3-instance", () => ({
  S3_BUCKET: "test-bucket",
  s3Client: s3ClientMock,
}));

import { deleteS3Prefix } from "@/lib/storage/delete-prefix";

describe("deleteS3Prefix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("early returns when prefix is empty string", async () => {
    await deleteS3Prefix("");
    expect(s3ClientMock.send).not.toHaveBeenCalled();
  });

  it("lists and deletes matching objects when prefix has contents", async () => {
    s3ClientMock.send
      .mockResolvedValueOnce({
        Contents: [{ Key: "kb/1/images/d1/0.png" }, { Key: "kb/1/images/d1/1.png" }],
      })
      .mockResolvedValueOnce({});

    await deleteS3Prefix("kb/1/images/d1/");

    expect(s3ClientMock.send).toHaveBeenCalledTimes(2);
  });

  it("skips DeleteObjectsCommand when list returns no contents", async () => {
    s3ClientMock.send.mockResolvedValueOnce({ Contents: [] });

    await deleteS3Prefix("kb/1/images/d1/");

    expect(s3ClientMock.send).toHaveBeenCalledTimes(1);
  });

  it("skips DeleteObjectsCommand when Contents is undefined", async () => {
    s3ClientMock.send.mockResolvedValueOnce({});

    await deleteS3Prefix("kb/1/images/d1/");

    expect(s3ClientMock.send).toHaveBeenCalledTimes(1);
  });

  it("catches and logs error without throwing", async () => {
    s3ClientMock.send.mockRejectedValueOnce(new Error("S3 error"));

    await expect(deleteS3Prefix("kb/1/images/d1/")).resolves.toBeUndefined();
  });

  it("handles non-Error thrown values", async () => {
    s3ClientMock.send.mockRejectedValueOnce("raw string failure");

    await expect(deleteS3Prefix("kb/1/images/d1/")).resolves.toBeUndefined();
  });
});
