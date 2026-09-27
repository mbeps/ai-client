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

const logMock = vi.hoisted(() => ({
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  getLogger: vi.fn(() => logMock),
  logger: logMock,
}));

// Pass-through spies over the real xlsx so sheet naming / empty-sheet
// fallbacks can be asserted directly instead of being inferred.
const xlsxSpies = vi.hoisted(() => ({
  aoaToSheet: vi.fn(),
  bookAppendSheet: vi.fn(),
}));

vi.mock("xlsx", async (importOriginal) => {
  const actual = await importOriginal<typeof import("xlsx")>();
  return {
    ...actual,
    utils: {
      ...actual.utils,
      aoa_to_sheet: (...args: unknown[]) => {
        xlsxSpies.aoaToSheet(...args);
        return (actual.utils.aoa_to_sheet as (...a: unknown[]) => unknown)(
          ...args,
        );
      },
      book_append_sheet: (...args: unknown[]) => {
        xlsxSpies.bookAppendSheet(...args);
        return (
          actual.utils.book_append_sheet as (...a: unknown[]) => unknown
        )(...args);
      },
    },
  };
});

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
    xlsxSpies.aoaToSheet.mockClear();
    xlsxSpies.bookAppendSheet.mockClear();
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

  it("returns null when artifact has no type at all (type ?? '' falls back)", async () => {
    const result = await persistTransformArtifact(
      {
        kind: "artifact",
        // no `type` key at all
        artifact: { content: JSON.stringify([["A"]]) },
        stepIndex: 0,
      },
      "user-1",
      "run-1",
    );

    // "" !== "spreadsheet" so it bails before touching xlsx or the DB
    expect(result).toBeNull();
    expect(xlsxSpies.aoaToSheet).not.toHaveBeenCalled();
    expect(chainable.insert).not.toHaveBeenCalled();
  });

  it("returns null when artifact has no content at all (content ?? '' falls back)", async () => {
    const result = await persistTransformArtifact(
      {
        kind: "artifact",
        // no `content` key at all
        artifact: { type: "spreadsheet" },
        stepIndex: 0,
      },
      "user-1",
      "run-1",
    );

    expect(result).toBeNull();
    expect(xlsxSpies.aoaToSheet).not.toHaveBeenCalled();
    expect(chainable.insert).not.toHaveBeenCalled();
  });

  it("names the sheet 'Sheet1' when parsed .data object has no name", async () => {
    const result = await persistTransformArtifact(
      {
        kind: "artifact",
        artifact: {
          type: "spreadsheet",
          // `data` present, `name` absent
          content: JSON.stringify({ data: [["a", "b"]] }),
        },
        stepIndex: 0,
      },
      "user-1",
      "run-1",
    );

    expect(result).not.toBeNull();
    expect(xlsxSpies.bookAppendSheet).toHaveBeenCalledTimes(1);
    // 3rd arg is the sheet name
    expect(xlsxSpies.bookAppendSheet.mock.calls[0][2]).toBe("Sheet1");
  });

  it("passes an empty array to aoa_to_sheet when a sheet entry has no data", async () => {
    const result = await persistTransformArtifact(
      {
        kind: "artifact",
        artifact: {
          type: "spreadsheet",
          // second sheet entry has no `data` key
          content: JSON.stringify({
            sheets: [{ name: "HasData", data: [[1, 2]] }, { name: "NoData" }],
          }),
        },
        stepIndex: 0,
      },
      "user-1",
      "run-1",
    );

    expect(result).not.toBeNull();
    expect(xlsxSpies.aoaToSheet).toHaveBeenCalledTimes(2);
    expect(xlsxSpies.aoaToSheet.mock.calls[0][0]).toEqual([[1, 2]]);
    expect(xlsxSpies.aoaToSheet.mock.calls[1][0]).toEqual([]);
    // sheet name still resolves via the defined arm
    expect(xlsxSpies.bookAppendSheet.mock.calls[1][2]).toBe("NoData");
  });

  it("logs a non-Error throwable verbatim when the artifact is not JSON-parseable", async () => {
    // XLSX.write throws a plain (non-Error) value for some inputs; force it
    // so the String(err) arm of the outer catch is exercised.
    const result = await persistTransformArtifact(
      {
        kind: "artifact",
        // A Proxy whose JSON.parse-relevant property access throws a string.
        artifact: {
          type: "spreadsheet",
          get content(): string {
            throw "raw-string-boom";
          },
        },
        stepIndex: 0,
      },
      "user-1",
      "run-1",
    );

    expect(result).toBeNull();
    expect(logMock.warn).toHaveBeenCalled();
    const loggedPayload = logMock.warn.mock.calls.at(-1)?.[1];
    expect(loggedPayload.error).toBe("raw-string-boom");
  });
});
