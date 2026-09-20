// ── env must be mocked before any module that reads it ──────────────────────
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
  for (const m of ["insert", "values", "update", "set", "delete"]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  c.where = vi.fn().mockImplementation(() => c);
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

const uploadObjectMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/storage/upload-object", () => ({
  uploadObject: uploadObjectMock,
}));

import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { persistTransformArtifact } from "@/lib/transform/persist-artifact";

describe("persistTransformArtifact (T2.5/T2.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.insert.mockReturnValue(chainable);
    chainable.values.mockReturnValue(chainable);
    chainable.update.mockReturnValue(chainable);
    chainable.set.mockReturnValue(chainable);
    chainable.delete.mockReturnValue(chainable);
    chainable.where.mockImplementation(() => chainable);
    uploadObjectMock.mockResolvedValue(undefined);
  });

  it("returns null for non-spreadsheet artifact", async () => {
    const result = await persistTransformArtifact(
      {
        kind: "artifact",
        artifact: { type: "text", content: "hi" },
        stepIndex: 0,
      },
      "user-1",
      "run-1",
    );
    expect(result).toBeNull();
  });

  it("uploads to S3 and inserts the attachment row", async () => {
    const result = await persistTransformArtifact(
      {
        kind: "download",
        fileContent: Buffer.from("hello").toString("base64"),
        filename: "out.xlsx",
        stepIndex: 0,
      },
      "user-1",
      "run-1",
    );
    expect(uploadObjectMock).toHaveBeenCalledOnce();
    expect(chainable.insert).toHaveBeenCalledOnce();
    expect(result?.attachmentRow.key).toContain("transform-outputs/user-1/");
  });

  it("appends outputAttachmentIds atomically via sql array_append (T2.6)", async () => {
    await persistTransformArtifact(
      {
        kind: "download",
        fileContent: Buffer.from("hello").toString("base64"),
        filename: "out.xlsx",
        stepIndex: 0,
      },
      "user-1",
      "run-1",
    );

    const setArg = chainable.set.mock.calls[0][0] as Record<string, unknown>;
    const appended = setArg.outputAttachmentIds;
    // Must be a raw SQL annotation, not a plain array overwrite
    expect(sql).toBeDefined();
    expect(typeof appended).toBe("object");
    expect(appended).not.toBeInstanceOf(Array);
    expect((appended as { queryChunks?: unknown[] }).queryChunks).toBeDefined();
    const rendered = JSON.stringify(
      (appended as { queryChunks: unknown[] }).queryChunks,
    );
    expect(rendered).toContain("array_append");
  });

  it("deletes the inserted attachment row and returns null when S3 fails (T2.5)", async () => {
    uploadObjectMock.mockRejectedValue(new Error("S3 down"));

    const result = await persistTransformArtifact(
      {
        kind: "download",
        fileContent: Buffer.from("hello").toString("base64"),
        filename: "out.xlsx",
        stepIndex: 0,
      },
      "user-1",
      "run-1",
    );

    expect(result).toBeNull();
    expect(chainable.delete).toHaveBeenCalledOnce();
    expect(chainable.where).toHaveBeenCalled();
  });

  it("persists spreadsheet artifact when content is an array of rows", async () => {
    const result = await persistTransformArtifact(
      {
        kind: "artifact",
        artifact: {
          type: "spreadsheet",
          content: JSON.stringify([["A", "B"], [1, 2]]),
        },
        stepIndex: 1,
      },
      "user-1",
      "run-1",
    );

    expect(result).not.toBeNull();
    expect(result?.attachmentRow.name).toBe("step-2-output.xlsx");
    expect(uploadObjectMock).toHaveBeenCalled();
  });

  it("persists spreadsheet artifact when content has .data and .name", async () => {
    const result = await persistTransformArtifact(
      {
        kind: "artifact",
        artifact: {
          type: "spreadsheet",
          content: JSON.stringify({ name: "MyData", data: [["val1"]] }),
        },
        stepIndex: 0,
      },
      "user-1",
      "run-1",
    );

    expect(result).not.toBeNull();
    expect(uploadObjectMock).toHaveBeenCalled();
  });

  it("persists spreadsheet artifact when content has .sheets array", async () => {
    const result = await persistTransformArtifact(
      {
        kind: "artifact",
        artifact: {
          type: "spreadsheet",
          content: JSON.stringify({
            sheets: [
              { name: "First", data: [[1, 2]] },
              { data: [[3, 4]] },
            ],
          }),
        },
        stepIndex: 0,
      },
      "user-1",
      "run-1",
    );

    expect(result).not.toBeNull();
    expect(uploadObjectMock).toHaveBeenCalled();
  });

  it("persists spreadsheet artifact with empty sheet when parsed object has no sheets", async () => {
    const result = await persistTransformArtifact(
      {
        kind: "artifact",
        artifact: {
          type: "spreadsheet",
          content: JSON.stringify({ otherField: true }),
        },
        stepIndex: 2,
      },
      "user-1",
      "run-1",
    );

    expect(result).not.toBeNull();
    expect(result?.attachmentRow.name).toBe("step-3-output.xlsx");
  });

  it("returns null when spreadsheet artifact content is empty string", async () => {
    const result = await persistTransformArtifact(
      {
        kind: "artifact",
        artifact: {
          type: "spreadsheet",
          content: "",
        },
        stepIndex: 0,
      },
      "user-1",
      "run-1",
    );

    expect(result).toBeNull();
  });

  it("uses default filename when download payload has no filename", async () => {
    const result = await persistTransformArtifact(
      {
        kind: "download",
        fileContent: Buffer.from("data").toString("base64"),
        filename: "",
        stepIndex: 0,
      },
      "user-1",
      "run-1",
    );

    expect(result).not.toBeNull();
    expect(result?.attachmentRow.name).toBe("step-1-output.xlsx");
  });

  it("handles db error gracefully and returns null", async () => {
    chainable.insert.mockImplementationOnce(() => {
      throw new Error("DB down");
    });

    const result = await persistTransformArtifact(
      {
        kind: "download",
        fileContent: Buffer.from("data").toString("base64"),
        filename: "file.xlsx",
        stepIndex: 0,
      },
      "user-1",
      "run-1",
    );
    expect(result).toBeNull();
  });

  it("returns null when spreadsheet artifact content is invalid JSON", async () => {
    const result = await persistTransformArtifact(
      {
        kind: "artifact",
        artifact: {
          type: "spreadsheet",
          content: "invalid json string",
        },
        stepIndex: 0,
      },
      "user-1",
      "run-1",
    );

    expect(result).toBeNull();
  });

  it("logs and returns null when compensation delete fails during S3 upload failure", async () => {
    uploadObjectMock.mockRejectedValueOnce(new Error("S3 down"));
    chainable.delete.mockImplementationOnce(() => {
      throw new Error("Delete failed");
    });

    const result = await persistTransformArtifact(
      {
        kind: "download",
        fileContent: Buffer.from("data").toString("base64"),
        filename: "file.xlsx",
        stepIndex: 0,
      },
      "user-1",
      "run-1",
    );

    expect(result).toBeNull();
  });
});
