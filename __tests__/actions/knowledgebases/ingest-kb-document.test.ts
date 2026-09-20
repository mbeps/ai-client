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

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }));

// Drizzle awaits terminate at `.where(...)` for selects — seed that, not a fake `then`.
const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of [
    "select",
    "from",
    "insert",
    "values",
    "update",
    "set",
    "delete",
  ]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  c.where = vi.fn();
  c.returning = vi.fn();
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ingestKbDocument } from "@/actions/knowledgebases/ingest-kb-document";
import {
  ProviderNotConfiguredError,
  RagExtractionEmptyError,
  RateLimitError,
} from "@/constants/errors";
import { inngest } from "@/lib/inngest/client";

describe("ingestKbDocument action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ownership check finds the document.
    chainable.where.mockResolvedValue([
      { id: "00000000-0000-4000-8000-000000000001" },
    ]);
  });

  it("validates UUID format and rejects invalid IDs", async () => {
    const result = await ingestKbDocument("not-a-uuid");
    expect(result).toEqual({
      success: false,
      error: "Invalid document ID format",
    });
  });

  it("returns error if document is not found or not owned by user", async () => {
    chainable.where.mockResolvedValueOnce([]);

    const result = await ingestKbDocument(
      "00000000-0000-4000-8000-000000000001",
    );

    expect(result).toEqual({
      success: false,
      error: "Document not found or access denied",
    });
  });

  it("updates status to processing and dispatches Inngest event", async () => {
    const result = await ingestKbDocument(
      "00000000-0000-4000-8000-000000000001",
    );

    expect(result).toEqual({ success: true });
    expect(chainable.set).toHaveBeenCalledWith({
      status: "processing",
      statusMessage: null,
    });
    expect(inngest.send).toHaveBeenCalledWith({
      name: "knowledgebase/document.ingest",
      data: {
        documentId: "00000000-0000-4000-8000-000000000001",
        userId: "user-1",
      },
    });
  });

  it("handles RateLimitError correctly", async () => {
    chainable.update.mockImplementationOnce(() => {
      throw new RateLimitError("Rate limit exceeded");
    });

    const result = await ingestKbDocument(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(result).toEqual({
      success: false,
      error: "Rate limit exceeded",
    });
  });

  it("handles RagExtractionEmptyError correctly", async () => {
    chainable.update.mockImplementationOnce(() => {
      throw new RagExtractionEmptyError("Extraction empty", "RAG_EXTRACTION_EMPTY");
    });

    const result = await ingestKbDocument(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(result).toEqual({
      success: false,
      error: "Extraction empty",
      code: "RAG_EXTRACTION_EMPTY",
    });
  });

  it("handles ProviderNotConfiguredError correctly", async () => {
    chainable.update.mockImplementationOnce(() => {
      throw new ProviderNotConfiguredError("Provider not configured", "PROVIDER_NOT_CONFIGURED");
    });

    const result = await ingestKbDocument(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(result).toEqual({
      success: false,
      error: "Provider not configured",
      code: "PROVIDER_NOT_CONFIGURED",
    });
  });

  it("handles unexpected errors correctly", async () => {
    chainable.update.mockImplementationOnce(() => {
      throw new Error("Database offline");
    });

    const result = await ingestKbDocument(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(result).toEqual({
      success: false,
      error: "An unexpected error occurred during ingestion",
    });
  });

  it("handles z.ZodError correctly", async () => {
    chainable.update.mockImplementationOnce(() => {
      throw new z.ZodError([]);
    });

    const result = await ingestKbDocument(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(result).toEqual({
      success: false,
      error: "Invalid input data",
    });
  });

  it("handles non-Error thrown gracefully", async () => {
    chainable.update.mockImplementationOnce(() => {
      throw "non-error-string";
    });

    const result = await ingestKbDocument(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(result).toEqual({
      success: false,
      error: "An unexpected error occurred during ingestion",
    });
  });
});
