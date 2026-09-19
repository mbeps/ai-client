import { beforeEach, describe, expect, it, vi } from "vitest";

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of ["select", "from", "update", "set"]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  c.where = vi.fn();
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

const mockIngestDocument = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rag/ingest", () => ({
  ingestDocument: mockIngestDocument,
}));

import { ingestKbDocumentFunction } from "@/lib/inngest/functions/kb-ingest";
import { reindexKbFunction } from "@/lib/inngest/functions/kb-reindex";
import { inngest } from "@/lib/inngest/client";

// Step mock helper executing step.run callbacks
const mockStep = {
  run: vi.fn(async (_name: string, fn: () => any) => fn()),
};

describe("KB Inngest Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ingestKbDocumentFunction", () => {
    it("calls ingestDocument inside step.run pipeline", async () => {
      mockIngestDocument.mockResolvedValueOnce({
        chunkCount: 3,
        tokenCount: 15,
      });

      const fn = (ingestKbDocumentFunction as any).fn;
      const result = await fn({
        event: {
          data: {
            documentId: "doc-1",
            userId: "user-1",
          },
        },
        step: mockStep,
      });

      expect(mockStep.run).toHaveBeenCalledWith(
        "ingest-document-pipeline",
        expect.any(Function),
      );
      expect(mockIngestDocument).toHaveBeenCalledWith("doc-1", "user-1");
      expect(result).toEqual({ success: true, documentId: "doc-1" });
    });
  });

  describe("reindexKbFunction", () => {
    it("marks indexing, sets status, and fans out ingestion events for all documents", async () => {
      // 1: select kb; 2: select docs
      let whereCall = 0;
      chainable.where.mockImplementation(() => {
        whereCall++;
        if (whereCall === 1) return Promise.resolve([{ id: "kb-1" }]);
        if (whereCall === 4)
          return Promise.resolve([{ id: "doc-1" }, { id: "doc-2" }]);
        return Promise.resolve([]);
      });

      const fn = (reindexKbFunction as any).fn;
      const result = await fn({
        event: {
          data: {
            kbId: "kb-1",
            userId: "user-1",
          },
        },
        step: mockStep,
      });

      expect(mockStep.run).toHaveBeenCalledWith(
        "mark-indexing-and-fetch-docs",
        expect.any(Function),
      );
      expect(mockStep.run).toHaveBeenCalledWith(
        "fan-out-doc-ingest",
        expect.any(Function),
      );
      expect(inngest.send).toHaveBeenCalledWith([
        {
          name: "knowledgebase/document.ingest",
          data: { documentId: "doc-1", userId: "user-1" },
        },
        {
          name: "knowledgebase/document.ingest",
          data: { documentId: "doc-2", userId: "user-1" },
        },
      ]);
      expect(result).toEqual({ dispatched: 2 });
    });

    it("marks KB ready immediately if there are no documents", async () => {
      let whereCall = 0;
      chainable.where.mockImplementation(() => {
        whereCall++;
        if (whereCall === 1) return Promise.resolve([{ id: "kb-1" }]);
        if (whereCall === 4) return Promise.resolve([]);
        return Promise.resolve([]);
      });

      const fn = (reindexKbFunction as any).fn;
      const result = await fn({
        event: {
          data: {
            kbId: "kb-1",
            userId: "user-1",
          },
        },
        step: mockStep,
      });

      expect(mockStep.run).toHaveBeenCalledWith(
        "mark-ready-empty",
        expect.any(Function),
      );
      expect(result).toEqual({ count: 0 });
    });
  });
});

