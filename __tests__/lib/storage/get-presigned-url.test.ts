import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/config/env", () => ({
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

  it("passes ResponseContentDisposition when filename is provided", async () => {
    await getPresignedUrl("test/key", undefined, "My Report (2026).xlsx");
    const command = mockGetSignedUrl.mock.calls[0][1];
    expect(command.input.ResponseContentDisposition).toBe(
      'attachment; filename="My%20Report%20(2026).xlsx"',
    );
  });

  it("leaves ResponseContentDisposition undefined when filename is omitted", async () => {
    await getPresignedUrl("test/key");
    const command = mockGetSignedUrl.mock.calls[0][1];
    expect(command.input.ResponseContentDisposition).toBeUndefined();
  });
});
