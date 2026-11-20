import { describe, expect, it } from "vitest";
import {
  buildFailedIngestSteps,
  createInitialIngestSteps,
  getActiveIngestStepIds,
} from "@/lib/rag/ingest-steps";

describe("createInitialIngestSteps", () => {
  it("initializes all five ingestion steps as pending by default", () => {
    expect(createInitialIngestSteps()).toEqual({
      uploading: { status: "pending" },
      extracting: { status: "pending" },
      embedding: { status: "pending" },
      metadata: { status: "pending" },
      relations: { status: "pending" },
    });
  });

  it("applies partial overrides without clobbering remaining steps", () => {
    expect(
      createInitialIngestSteps({
        uploading: { status: "completed" },
        extracting: { status: "loading" },
      }),
    ).toEqual({
      uploading: { status: "completed" },
      extracting: { status: "loading" },
      embedding: { status: "pending" },
      metadata: { status: "pending" },
      relations: { status: "pending" },
    });
  });
});

describe("getActiveIngestStepIds", () => {
  it("returns all five steps for hybrid mode (and default)", () => {
    expect(getActiveIngestStepIds()).toEqual([
      "uploading",
      "extracting",
      "embedding",
      "metadata",
      "relations",
    ]);
    expect(getActiveIngestStepIds("hybrid")).toEqual([
      "uploading",
      "extracting",
      "embedding",
      "metadata",
      "relations",
    ]);
  });

  it("returns uploading, extracting, and embedding for vector mode", () => {
    expect(getActiveIngestStepIds("vector")).toEqual([
      "uploading",
      "extracting",
      "embedding",
    ]);
  });

  it("omits embedding for file_read mode", () => {
    expect(getActiveIngestStepIds("file_read")).toEqual([
      "uploading",
      "extracting",
      "metadata",
      "relations",
    ]);
  });
});

describe("buildFailedIngestSteps", () => {
  it("marks steps before failure completed, failing step failed, and later steps pending", () => {
    expect(buildFailedIngestSteps("embedding", "Rate limit")).toEqual({
      uploading: { status: "completed" },
      extracting: { status: "completed" },
      embedding: { status: "failed", error: "Rate limit" },
      metadata: { status: "pending" },
      relations: { status: "pending" },
    });
  });

  it("keeps metadata and relations pending when vector mode fails on embedding", () => {
    expect(
      buildFailedIngestSteps("embedding", "Embedding error", "vector"),
    ).toEqual({
      uploading: { status: "completed" },
      extracting: { status: "completed" },
      embedding: { status: "failed", error: "Embedding error" },
      metadata: { status: "pending" },
      relations: { status: "pending" },
    });
  });

  it("keeps embedding pending when file_read mode fails on metadata", () => {
    expect(
      buildFailedIngestSteps("metadata", "Metadata LLM error", "file_read"),
    ).toEqual({
      uploading: { status: "completed" },
      extracting: { status: "completed" },
      embedding: { status: "pending" },
      metadata: { status: "failed", error: "Metadata LLM error" },
      relations: { status: "pending" },
    });
  });

  it("keeps embedding pending when file_read mode fails on relations", () => {
    expect(
      buildFailedIngestSteps("relations", "Relations LLM error", "file_read"),
    ).toEqual({
      uploading: { status: "completed" },
      extracting: { status: "completed" },
      embedding: { status: "pending" },
      metadata: { status: "completed" },
      relations: { status: "failed", error: "Relations LLM error" },
    });
  });
});
