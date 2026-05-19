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
    POSTMARK_FROM_EMAIL: "noreply@example.com",
    NODE_ENV: "test",
  },
}));

const mockSend = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(function () {
    return { send: mockSend };
  }),
  PutObjectCommand: vi.fn().mockImplementation(function (params: object) {
    return { _type: "PutObjectCommand", ...params };
  }),
  GetObjectCommand: vi.fn().mockImplementation(function (params: object) {
    return { _type: "GetObjectCommand", ...params };
  }),
  DeleteObjectCommand: vi.fn().mockImplementation(function (params: object) {
    return { _type: "DeleteObjectCommand", ...params };
  }),
  DeleteObjectsCommand: vi.fn().mockImplementation(function (params: object) {
    return { _type: "DeleteObjectsCommand", ...params };
  }),
  HeadBucketCommand: vi.fn().mockImplementation(function (params: object) {
    return { _type: "HeadBucketCommand", ...params };
  }),
  CreateBucketCommand: vi.fn().mockImplementation(function (params: object) {
    return { _type: "CreateBucketCommand", ...params };
  }),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi
    .fn()
    .mockResolvedValue("https://example.com/presigned-url?token=abc"),
}));

import {
  uploadObject,
  deleteObject,
  deleteObjects,
  getPresignedUrl,
  downloadObject,
  ensureBucket,
  S3_BUCKET,
} from "@/lib/storage/s3-client";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("S3_BUCKET constant", () => {
  it("is the bucket name from env", () => {
    expect(S3_BUCKET).toBe("test-bucket");
  });
});

describe("uploadObject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({});
  });

  it("calls s3Client.send with a PutObjectCommand", async () => {
    const key = "attachments/user-1/file.png";
    const body = Buffer.from("image data");
    const contentType = "image/png";

    await uploadObject(key, body, contentType);

    expect(mockSend).toHaveBeenCalledOnce();
    const cmd = mockSend.mock.calls[0][0];
    expect(cmd.Bucket).toBe("test-bucket");
    expect(cmd.Key).toBe(key);
    expect(cmd.Body).toEqual(body);
    expect(cmd.ContentType).toBe(contentType);
  });

  it("throws when s3Client.send rejects", async () => {
    mockSend.mockRejectedValueOnce(new Error("S3 network error"));
    await expect(
      uploadObject("key", Buffer.from("data"), "text/plain"),
    ).rejects.toThrow("S3 network error");
  });

  it("accepts Uint8Array as body", async () => {
    const body = new Uint8Array([1, 2, 3]);
    await expect(
      uploadObject("key", body, "application/octet-stream"),
    ).resolves.not.toThrow();
  });
});

describe("deleteObject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({});
  });

  it("calls s3Client.send with a DeleteObjectCommand for the given key", async () => {
    const key = "attachments/user-1/old-file.pdf";
    await deleteObject(key);

    expect(mockSend).toHaveBeenCalledOnce();
    const cmd = mockSend.mock.calls[0][0];
    expect(cmd.Bucket).toBe("test-bucket");
    expect(cmd.Key).toBe(key);
  });

  it("throws when s3Client.send rejects", async () => {
    mockSend.mockRejectedValueOnce(new Error("access denied"));
    await expect(deleteObject("some-key")).rejects.toThrow("access denied");
  });
});

describe("deleteObjects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({});
  });

  it("is a no-op when keys array is empty", async () => {
    await deleteObjects([]);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("calls s3Client.send once for multiple keys", async () => {
    const keys = ["key1", "key2", "key3"];
    await deleteObjects(keys);
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("sends the correct bucket and objects structure", async () => {
    const keys = ["a/b.png", "c/d.pdf"];
    await deleteObjects(keys);
    const cmd = mockSend.mock.calls[0][0];
    expect(cmd.Bucket).toBe("test-bucket");
    expect(cmd.Delete.Objects).toEqual([
      { Key: "a/b.png" },
      { Key: "c/d.pdf" },
    ]);
  });

  it("throws when s3Client.send rejects", async () => {
    mockSend.mockRejectedValueOnce(new Error("batch delete failed"));
    await expect(deleteObjects(["k1"])).rejects.toThrow("batch delete failed");
  });
});

describe("getPresignedUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSignedUrl as ReturnType<typeof vi.fn>).mockResolvedValue(
      "https://example.com/presigned-url?token=abc",
    );
  });

  it("returns a presigned URL string", async () => {
    const url = await getPresignedUrl("attachments/user-1/file.png");
    expect(url).toBe("https://example.com/presigned-url?token=abc");
  });

  it("calls getSignedUrl with default expiry of 3600 seconds", async () => {
    await getPresignedUrl("test-key");
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 3600 },
    );
  });

  it("passes custom expiresIn when provided", async () => {
    await getPresignedUrl("test-key", 7200);
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 7200 },
    );
  });

  it("throws when signing fails", async () => {
    (getSignedUrl as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("signing failed"),
    );
    await expect(getPresignedUrl("bad-key")).rejects.toThrow("signing failed");
  });
});

describe("downloadObject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a Buffer from S3 stream chunks", async () => {
    const chunks = [new Uint8Array([72, 101, 108]), new Uint8Array([108, 111])];

    async function* asyncGen() {
      for (const chunk of chunks) yield chunk;
    }

    mockSend.mockResolvedValueOnce({ Body: asyncGen() });

    const result = await downloadObject("test-key");
    expect(result).toBeInstanceOf(Buffer);
    expect(result).toEqual(Buffer.from([72, 101, 108, 108, 111]));
  });

  it("throws when response body is empty (null)", async () => {
    mockSend.mockResolvedValueOnce({ Body: null });
    await expect(downloadObject("missing-key")).rejects.toThrow(
      'Empty body for key "missing-key"',
    );
  });

  it("throws when response body is undefined", async () => {
    mockSend.mockResolvedValueOnce({ Body: undefined });
    await expect(downloadObject("no-body")).rejects.toThrow(
      'Empty body for key "no-body"',
    );
  });

  it("throws when s3Client.send rejects", async () => {
    mockSend.mockRejectedValueOnce(new Error("NoSuchKey"));
    await expect(downloadObject("ghost-key")).rejects.toThrow("NoSuchKey");
  });
});

describe("ensureBucket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when bucket already exists (HeadBucket succeeds)", async () => {
    mockSend.mockResolvedValueOnce({});
    await expect(ensureBucket()).resolves.not.toThrow();
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("creates bucket when HeadBucket returns 404 status", async () => {
    const notFoundErr = Object.assign(new Error("Not Found"), {
      $metadata: { httpStatusCode: 404 },
    });
    mockSend.mockRejectedValueOnce(notFoundErr).mockResolvedValueOnce({});

    await ensureBucket();
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("creates bucket when HeadBucket throws error with name 'NotFound'", async () => {
    const notFoundErr = Object.assign(new Error("NotFound"), {
      name: "NotFound",
    });
    mockSend.mockRejectedValueOnce(notFoundErr).mockResolvedValueOnce({});

    await ensureBucket();
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("rethrows unexpected errors from HeadBucket", async () => {
    mockSend.mockRejectedValueOnce(new Error("credentials error"));
    await expect(ensureBucket()).rejects.toThrow("credentials error");
  });
});
