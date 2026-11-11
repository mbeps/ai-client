import { describe, expect, it } from "vitest";
import {
  buildFailedIngestSteps,
  createInitialIngestSteps,
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
});
