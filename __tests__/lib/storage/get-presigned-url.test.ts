import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockEnv, mockGetSignedUrl } = vi.hoisted(() => ({
  mockEnv: { PRESIGNED_URL_EXPIRY_SECONDS: 3600 as number | undefined },
  mockGetSignedUrl: vi.fn().mockResolvedValue("https://presigned.url"),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mockGetSignedUrl,
}));

vi.mock("@/lib/storage/s3-instance", () => ({
  s3Client: {},
  S3_BUCKET: "test-bucket",
}));

vi.mock("@/lib/env", () => ({
  env: mockEnv,
}));

import { getPresignedUrl } from "@/lib/storage/get-presigned-url";

describe("getPresignedUrl", () => {
  beforeEach(() => {
    mockGetSignedUrl.mockClear();
    mockEnv.PRESIGNED_URL_EXPIRY_SECONDS = 3600;
  });

  it("uses default 3600 when PRESIGNED_URL_EXPIRY_SECONDS is not set", async () => {
    mockEnv.PRESIGNED_URL_EXPIRY_SECONDS = undefined;
    await getPresignedUrl("test/key");
    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 3600 },
    );
  });

  it("uses PRESIGNED_URL_EXPIRY_SECONDS from env when set to 1800", async () => {
    mockEnv.PRESIGNED_URL_EXPIRY_SECONDS = 1800;
    await getPresignedUrl("test/key");
    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 1800 },
    );
  });

  it("explicit expiresIn overrides env var", async () => {
    mockEnv.PRESIGNED_URL_EXPIRY_SECONDS = 1800;
    await getPresignedUrl("test/key", 7200);
    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 7200 },
    );
  });
});
