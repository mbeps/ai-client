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

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of [
    "select",
    "from",
    "where",
    "delete",
    "insert",
    "values",
    "update",
    "set",
    "returning",
    "orderBy",
  ]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

const s3SendMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage/s3-instance", () => ({
  s3Client: { send: s3SendMock },
  S3_BUCKET: "test-bucket",
}));

const resolveEmbeddingMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/resolve-embedding-provider", () => ({
  resolveEmbeddingProvider: resolveEmbeddingMock,
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createKnowledgebase } from "@/actions/knowledgebases/create-knowledgebase";
import { deleteDocument } from "@/actions/knowledgebases/delete-document";
import { listDocuments } from "@/actions/knowledgebases/list-documents";
import { listKnowledgebases } from "@/actions/knowledgebases/list-knowledgebases";
import { updateKnowledgebase } from "@/actions/knowledgebases/update-knowledgebase";

const KB_ID = "44444444-4444-4444-8444-444444444444";
const DOC_ID = "33333333-3333-4333-8333-333333333333";

describe("knowledgebase documents and CRUD actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
    chainable.where.mockReturnValue(chainable);
    chainable.delete.mockReturnValue(chainable);
    chainable.insert.mockReturnValue(chainable);
    chainable.values.mockReturnValue(chainable);
    chainable.update.mockReturnValue(chainable);
    chainable.set.mockReturnValue(chainable);
    chainable.returning.mockReturnValue(chainable);
    chainable.orderBy.mockReturnValue(chainable);
    s3SendMock.mockResolvedValue({});
    resolveEmbeddingMock.mockResolvedValue({});
  });

  describe("deleteDocument", () => {
    it("deletes S3 object and DB row when document is owned by user", async () => {
      chainable.where.mockResolvedValueOnce([
        { id: DOC_ID, kbId: KB_ID, s3Key: `kb/${KB_ID}/${DOC_ID}/test.pdf` },
      ]);
      chainable.where.mockResolvedValueOnce(undefined);

      await expect(
        deleteDocument({ kbId: KB_ID, documentId: DOC_ID }),
      ).resolves.toBeUndefined();

      expect(s3SendMock).toHaveBeenCalled();
      expect(chainable.delete).toHaveBeenCalled();
    });

    it("throws 'Not Found' when document does not exist or not owned by user", async () => {
      chainable.where.mockResolvedValueOnce([]);

      await expect(
        deleteDocument({ kbId: KB_ID, documentId: DOC_ID }),
      ).rejects.toThrow("Not Found");
    });
  });

  describe("listDocuments", () => {
    it("returns documents when KB is owned by user", async () => {
      chainable.where.mockResolvedValueOnce([{ id: KB_ID }]);
      const mockDocs = [{ id: DOC_ID, name: "file.pdf" }];
      chainable.orderBy.mockResolvedValueOnce(mockDocs);

      const result = await listDocuments(KB_ID);
      expect(result).toEqual(mockDocs);
    });

    it("throws 'Not Found' when KB does not exist or not owned by user", async () => {
      chainable.where.mockResolvedValueOnce([]);

      await expect(listDocuments(KB_ID)).rejects.toThrow("Not Found");
    });
  });

  describe("listKnowledgebases", () => {
    it("returns knowledgebases ordered by updatedAt DESC", async () => {
      const mockKbs = [{ id: KB_ID, name: "KB 1", documentCount: 3 }];
      chainable.orderBy.mockResolvedValueOnce(mockKbs);

      const result = await listKnowledgebases();
      expect(result).toEqual(mockKbs);
    });
  });

  describe("createKnowledgebase", () => {
    it("creates a knowledgebase after validating embedding provider", async () => {
      const createdKb = { id: KB_ID, name: "New KB", description: "Desc" };
      chainable.returning.mockResolvedValueOnce([createdKb]);

      const result = await createKnowledgebase({
        name: "New KB",
        description: "Desc",
      });

      expect(resolveEmbeddingMock).toHaveBeenCalledWith("user-1");
      expect(result).toEqual(createdKb);
    });

    it("creates a knowledgebase with null description when omitted", async () => {
      const createdKb = { id: KB_ID, name: "New KB", description: null };
      chainable.returning.mockResolvedValueOnce([createdKb]);

      const result = await createKnowledgebase({
        name: "New KB",
      });

      expect(result).toEqual(createdKb);
    });
  });

  describe("updateKnowledgebase", () => {
    it("updates name and description", async () => {
      const updatedKb = { id: KB_ID, name: "Updated KB", description: "Updated" };
      chainable.returning.mockResolvedValueOnce([updatedKb]);

      const result = await updateKnowledgebase(KB_ID, {
        name: "Updated KB",
        description: "Updated",
      });

      expect(result).toEqual(updatedKb);
    });

    it("updates without description when only name provided", async () => {
      const updatedKb = { id: KB_ID, name: "Updated KB", description: "Existing" };
      chainable.returning.mockResolvedValueOnce([updatedKb]);

      const result = await updateKnowledgebase(KB_ID, {
        name: "Updated KB",
      });

      expect(result).toEqual(updatedKb);
    });

    it("updates without name when only description provided", async () => {
      const updatedKb = { id: KB_ID, name: "Existing", description: "New desc" };
      chainable.returning.mockResolvedValueOnce([updatedKb]);

      const result = await updateKnowledgebase(KB_ID, {
        description: "New desc",
      });

      expect(result).toEqual(updatedKb);
    });
  });
});
