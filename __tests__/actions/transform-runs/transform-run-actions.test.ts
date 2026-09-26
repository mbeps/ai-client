import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NODE_ENV: "test",
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }));

const chainable = vi.hoisted(() => {
  const c: any = {};
  for (const m of [
    "select",
    "from",
    "where",
    "orderBy",
    "limit",
    "insert",
    "values",
    "update",
    "set",
    "delete",
  ]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  c.returning = vi.fn().mockResolvedValue([]);
  c.then = (onFulfilled: any) => Promise.resolve([]).then(onFulfilled);
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

const requireSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: requireSessionMock,
}));

const getOwnedResourceMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/get-owned-resource", () => ({
  getOwnedResource: getOwnedResourceMock,
}));

import { createTransformRun } from "@/actions/transform-runs/create-transform-run";
import { getTransformRun } from "@/actions/transform-runs/get-transform-run";
import { listTransformRuns } from "@/actions/transform-runs/list-transform-runs";

describe("transform run actions", () => {
  const userId = "user-123";
  const agentId = "123e4567-e89b-12d3-a456-426614174000";
  const runId = "123e4567-e89b-12d3-a456-426614174001";
  const attachmentId = "123e4567-e89b-12d3-a456-426614174002";

  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockResolvedValue({
      user: { id: userId, email: "test@example.com" },
      session: { id: "sess-1" },
    });
    for (const m of [
      "select",
      "from",
      "where",
      "orderBy",
      "limit",
      "insert",
      "values",
      "update",
      "set",
      "delete",
    ]) {
      chainable[m].mockImplementation(() => chainable);
    }
    chainable.returning.mockResolvedValue([]);
    chainable.then = (onFulfilled: any) => Promise.resolve([]).then(onFulfilled);
  });

  describe("getTransformRun", () => {
    it("fetches single run using getOwnedResource", async () => {
      const mockRun = { id: runId, agentId, userId, status: "completed" };
      getOwnedResourceMock.mockResolvedValueOnce(mockRun);

      const result = await getTransformRun(runId);
      expect(result).toEqual(mockRun);
      expect(getOwnedResourceMock).toHaveBeenCalledWith(expect.anything(), runId, userId);
    });
  });

  describe("createTransformRun", () => {
    it("throws Not Found when agent is not found or not owned", async () => {
      chainable.then = (onFulfilled: any) => Promise.resolve([]).then(onFulfilled);

      await expect(
        createTransformRun({ agentId }),
      ).rejects.toThrow("Not Found");
    });

    it("creates a transform run with array of input attachments and dryRun", async () => {
      const mockAgent = { id: agentId, userId };
      const createdRun = {
        id: runId,
        agentId,
        userId,
        status: "pending",
        dryRun: true,
        inputAttachmentIds: [attachmentId],
      };

      chainable.then = (onFulfilled: any) => Promise.resolve([mockAgent]).then(onFulfilled);
      chainable.returning.mockResolvedValueOnce([createdRun]);

      const result = await createTransformRun({
        agentId,
        inputAttachmentIds: [attachmentId],
        dryRun: true,
      });

      expect(result).toEqual(createdRun);
      expect(chainable.values).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId,
          userId,
          status: "pending",
          dryRun: true,
          inputAttachmentIds: [attachmentId],
          outputAttachmentIds: [],
        }),
      );
    });

    it("creates a transform run with single string input attachment", async () => {
      const mockAgent = { id: agentId, userId };
      const createdRun = { id: runId, agentId, userId, status: "pending" };

      chainable.then = (onFulfilled: any) => Promise.resolve([mockAgent]).then(onFulfilled);
      chainable.returning.mockResolvedValueOnce([createdRun]);

      const result = await createTransformRun({
        agentId,
        inputAttachmentIds: attachmentId as any,
      });

      expect(result).toEqual(createdRun);
      expect(chainable.values).toHaveBeenCalledWith(
        expect.objectContaining({
          inputAttachmentIds: [attachmentId],
        }),
      );
    });

    it("creates a transform run with default dryRun and no attachments", async () => {
      const mockAgent = { id: agentId, userId };
      const createdRun = { id: runId, agentId, userId, status: "pending", dryRun: false };

      chainable.then = (onFulfilled: any) => Promise.resolve([mockAgent]).then(onFulfilled);
      chainable.returning.mockResolvedValueOnce([createdRun]);

      const result = await createTransformRun({
        agentId,
      });

      expect(result).toEqual(createdRun);
      expect(chainable.values).toHaveBeenCalledWith(
        expect.objectContaining({
          dryRun: false,
          inputAttachmentIds: [],
        }),
      );
    });
  });

  describe("listTransformRuns", () => {
    it("lists runs for an agent ordered by createdAt descending", async () => {
      const mockRuns = [{ id: runId, agentId, userId }];
      chainable.then = (onFulfilled: any) => Promise.resolve(mockRuns).then(onFulfilled);

      const result = await listTransformRuns(agentId);
      expect(result).toEqual(mockRuns);
      expect(chainable.select).toHaveBeenCalled();
      expect(chainable.orderBy).toHaveBeenCalled();
    });
  });
});
