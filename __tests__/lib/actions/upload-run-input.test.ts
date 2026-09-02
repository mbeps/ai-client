vi.mock("@/lib/env", () => ({
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
    RATE_LIMIT_UPLOAD_RPM: 20,
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }));

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of ["insert", "values", "returning"]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  c.returning = vi.fn().mockResolvedValue([{ id: "att-1", name: "test.xlsx" }]);
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

vi.mock("@/lib/storage/upload-object", () => ({
  uploadObject: vi.fn().mockResolvedValue(undefined),
}));

const checkRateLimit = vi.hoisted(() =>
  vi.fn().mockReturnValue({ allowed: true, retryAfterSeconds: 0 }),
);
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit }));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_SPREADSHEET_SIZE_BYTES } from "@/constants/attachments";
import { uploadRunInput } from "@/lib/actions/transform-runs/upload-run-input";
import { uploadObject } from "@/lib/storage/upload-object";

function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

function makeFormData(files: File[]): FormData {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  return fd;
}

describe("uploadRunInput — file type + size validation (T1.8)", () => {
  beforeEach(() => {
    vi.mocked(uploadObject).mockClear();
    checkRateLimit.mockClear().mockReturnValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it("consults the rate limiter with upload:userId key", async () => {
    const fd = makeFormData([
      makeFile(
        "data.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        1024,
      ),
    ]);
    await uploadRunInput(fd);
    expect(checkRateLimit).toHaveBeenCalledWith(
      "upload:user-1",
      expect.any(Number),
    );
  });

  it("blocks when rate limited", async () => {
    checkRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 30 });
    const fd = makeFormData([
      makeFile(
        "data.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        1024,
      ),
    ]);
    await expect(uploadRunInput(fd)).rejects.toThrow(/too many uploads/i);
    expect(uploadObject).not.toHaveBeenCalled();
  });

  it("persists the sniffed MIME type, not raw file.type", async () => {
    // Spoofed Content-Type; magic bytes are a real xlsx (ZIP) signature.
    const zipBytes = new Uint8Array([
      0x50,
      0x4b,
      0x03,
      0x04,
      ...new Uint8Array(1020),
    ]);
    const file = new File([zipBytes], "data.xlsx", { type: "text/html" });
    const fd = makeFormData([file]);
    await uploadRunInput(fd);
    const xlsxMime =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    expect(uploadObject).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Buffer),
      xlsxMime,
    );
    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: xlsxMime }),
    );
  });

  it("rejects non-spreadsheet file type (image/png)", async () => {
    const fd = makeFormData([makeFile("photo.png", "image/png", 1024)]);
    await expect(uploadRunInput(fd)).rejects.toThrow(/not supported/i);
  });

  it("rejects file over 50 MB", async () => {
    const fd = makeFormData([
      makeFile(
        "data.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        MAX_SPREADSHEET_SIZE_BYTES + 1,
      ),
    ]);
    await expect(uploadRunInput(fd)).rejects.toThrow(
      /exceeds the maximum size/i,
    );
  });

  it("accepts a valid xlsx file", async () => {
    const fd = makeFormData([
      makeFile(
        "data.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        1024,
      ),
    ]);
    const result = await uploadRunInput(fd);
    expect(result).toEqual([{ id: "att-1", name: "test.xlsx" }]);
  });

  it("accepts a valid csv file", async () => {
    const fd = makeFormData([makeFile("data.csv", "text/csv", 2048)]);
    const result = await uploadRunInput(fd);
    expect(result).toEqual([{ id: "att-1", name: "test.xlsx" }]);
  });
});
