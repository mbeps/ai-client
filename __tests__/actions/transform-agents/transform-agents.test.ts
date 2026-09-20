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

import { createTransformAgent } from "@/actions/transform-agents/create-transform-agent";
import { deleteTransformAgent } from "@/actions/transform-agents/delete-transform-agent";
import { getTransformAgent } from "@/actions/transform-agents/get-transform-agent";
import { listTransformAgents } from "@/actions/transform-agents/list-transform-agents";
import { renameTransformAgent } from "@/actions/transform-agents/rename-transform-agent";
import { updateTransformAgent } from "@/actions/transform-agents/update-transform-agent";

describe("transform agents actions", () => {
  const userId = "user-123";
  const agentId = "123e4567-e89b-12d3-a456-426614174000";

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

  describe("createTransformAgent", () => {
    it("creates a transform agent with full payload", async () => {
      const inserted = { id: agentId, name: "Agent 1", userId };
      chainable.returning.mockResolvedValueOnce([inserted]);

      const validStep = {
        id: "123e4567-e89b-12d3-a456-426614174001",
        name: "Step 1",
        prompt: "Do step 1",
        mcpServerIds: [],
        toolIds: [],
        order: 0,
        requiresReview: false,
      };

      const result = await createTransformAgent({
        name: "Agent 1",
        description: "Agent description",
        globalContext: "Context prompt",
        modelId: "gpt-4o",
        tools: ["tool-1"],
        knowledgeBaseIds: ["kb-1"],
        requiresFileUpload: true,
        steps: [validStep],
      });

      expect(result).toEqual(inserted);
      expect(chainable.insert).toHaveBeenCalled();
      expect(chainable.values).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Agent 1",
          description: "Agent description",
          globalContext: "Context prompt",
          modelId: "gpt-4o",
          tools: ["tool-1"],
          knowledgeBaseIds: ["kb-1"],
          requiresFileUpload: true,
          steps: expect.stringContaining("Step 1"),
          userId,
        }),
      );
    });

    it("creates a transform agent with optional fields omitted", async () => {
      const inserted = { id: agentId, name: "Minimal Agent", userId };
      chainable.returning.mockResolvedValueOnce([inserted]);

      const result = await createTransformAgent({
        name: "Minimal Agent",
      });

      expect(result).toEqual(inserted);
      expect(chainable.values).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Minimal Agent",
          description: null,
          globalContext: null,
          modelId: null,
          steps: "[]",
          userId,
        }),
      );
    });
  });

  describe("deleteTransformAgent", () => {
    it("deletes transform agent owned by user", async () => {
      await deleteTransformAgent(agentId);
      expect(chainable.delete).toHaveBeenCalled();
    });
  });

  describe("renameTransformAgent", () => {
    it("renames transform agent via renameEntityFactory", async () => {
      const updated = { id: agentId, name: "Renamed Agent" };
      chainable.returning.mockResolvedValueOnce([updated]);

      const result = await renameTransformAgent(agentId, "Renamed Agent");
      expect(result).toEqual(updated);
    });
  });

  describe("updateTransformAgent", () => {
    it("updates all partial fields when provided", async () => {
      const updated = { id: agentId, name: "Updated Agent" };
      chainable.returning.mockResolvedValueOnce([updated]);

      const validStep = {
        id: "123e4567-e89b-12d3-a456-426614174002",
        name: "Updated Step",
        prompt: "New prompt",
        mcpServerIds: [],
        toolIds: [],
        order: 1,
        requiresReview: true,
      };

      const result = await updateTransformAgent(agentId, {
        name: "Updated Agent",
        description: "New description",
        globalContext: "New context",
        modelId: "claude-3-5-sonnet",
        tools: ["new-tool"],
        knowledgeBaseIds: ["new-kb"],
        requiresFileUpload: false,
        steps: [validStep],
      });

      expect(result).toEqual(updated);
      expect(chainable.update).toHaveBeenCalled();
      expect(chainable.set).toHaveBeenCalledWith({
        name: "Updated Agent",
        description: "New description",
        globalContext: "New context",
        modelId: "claude-3-5-sonnet",
        tools: ["new-tool"],
        knowledgeBaseIds: ["new-kb"],
        requiresFileUpload: false,
        steps: expect.stringContaining("Updated Step"),
      });
    });

    it("updates agent with empty payload without modifying any fields", async () => {
      const updated = { id: agentId, name: "Existing Agent" };
      chainable.returning.mockResolvedValueOnce([updated]);

      const result = await updateTransformAgent(agentId, {});
      expect(result).toEqual(updated);
      expect(chainable.set).toHaveBeenCalledWith({});
    });

    it("updates odd fields (description, modelId, knowledgeBaseIds, steps)", async () => {
      const updated = { id: agentId, name: "Existing Agent" };
      chainable.returning.mockResolvedValueOnce([updated]);

      const result = await updateTransformAgent(agentId, {
        description: "Desc",
        modelId: "gpt-4",
        knowledgeBaseIds: ["kb-1"],
        steps: [],
      });
      expect(result).toEqual(updated);
    });

    it("updates even fields (name, globalContext, tools, requiresFileUpload)", async () => {
      const updated = { id: agentId, name: "Existing Agent" };
      chainable.returning.mockResolvedValueOnce([updated]);

      const result = await updateTransformAgent(agentId, {
        name: "Name",
        globalContext: "Context",
        tools: ["t-1"],
        requiresFileUpload: false,
      });
      expect(result).toEqual(updated);
    });

    it("throws Not Found when agent is not found or not owned", async () => {
      chainable.returning.mockResolvedValueOnce([]);

      await expect(
        updateTransformAgent(agentId, { name: "Missing" }),
      ).rejects.toThrow("Not Found");
    });
  });

  describe("getTransformAgent", () => {
    it("fetches single agent using getOwnedResource", async () => {
      const mockAgent = { id: agentId, name: "Agent 1", userId };
      getOwnedResourceMock.mockResolvedValueOnce(mockAgent);

      const result = await getTransformAgent(agentId);
      expect(result).toEqual(mockAgent);
      expect(getOwnedResourceMock).toHaveBeenCalledWith(expect.anything(), agentId, userId);
    });
  });

  describe("listTransformAgents", () => {
    it("returns list of agents ordered by updatedAt descending", async () => {
      const mockAgents = [{ id: agentId, name: "Agent 1", userId }];
      chainable.then = (onFulfilled: any) => Promise.resolve(mockAgents).then(onFulfilled);

      const result = await listTransformAgents();
      expect(result).toEqual(mockAgents);
      expect(chainable.select).toHaveBeenCalled();
      expect(chainable.orderBy).toHaveBeenCalled();
    });
  });
});
