// Tests for the module-level bucketVerified caching in ensureBucket (T7.6).
// Each test resets the module to get a fresh bucketVerified=false state.

const mockSend = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({
  env: {
    S3_BUCKET: "test-bucket",
    S3_REGION: "us-east-1",
    S3_ENDPOINT: "http://localhost:9000",
    S3_ACCESS_KEY: "test-access-key",
    S3_SECRET_KEY: "test-secret-key",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    POSTMARK_SERVER_TOKEN: "test-token",
    POSTMARK_FROM_EMAIL: "noreply@example.com",
    NODE_ENV: "test",
  },
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(function () {
    return { send: mockSend };
  }),
  HeadBucketCommand: vi.fn().mockImplementation(function (params: object) {
    return { _type: "HeadBucketCommand", ...params };
  }),
  CreateBucketCommand: vi.fn().mockImplementation(function (params: object) {
    return { _type: "CreateBucketCommand", ...params };
  }),
}));

import { beforeEach, describe, expect, it, vi } from "vitest";

describe("ensureBucket — module-level caching (T7.6)", () => {
  let ensureBucket: () => Promise<void>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset the module so bucketVerified starts as false for each test
    vi.resetModules();
    const mod = await import("@/lib/storage/ensure-bucket");
    ensureBucket = mod.ensureBucket;
  });

  it("calls HeadBucketCommand on the first call", async () => {
    mockSend.mockResolvedValue({});
    await ensureBucket();
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("skips HeadBucketCommand on subsequent calls (cached)", async () => {
    mockSend.mockResolvedValue({});

    await ensureBucket();
    await ensureBucket();
    await ensureBucket();

    // Called only once despite three invocations
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("retries on the next call if the first call throws an unexpected error", async () => {
    mockSend.mockRejectedValueOnce(new Error("credentials error"));

    await expect(ensureBucket()).rejects.toThrow("credentials error");

    // bucketVerified should still be false — retry is allowed
    mockSend.mockResolvedValue({});
    await ensureBucket();
    expect(mockSend).toHaveBeenCalledTimes(2);
  });
});
