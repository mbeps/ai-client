import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSelectQueue,
  mockReadSkillFileForUser,
  mockDb,
  mockLimitCalls,
} = vi.hoisted(() => {
  const mockSelectQueue: unknown[][] = [];
  const mockLimitCalls: number[] = [];

  const nextResult = () => mockSelectQueue.shift() ?? [];

  const makeChain = () => {
    const chain: Record<string, any> = {
      from: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn((n: number) => {
        mockLimitCalls.push(n);
        return Promise.resolve(nextResult());
      }),
      // Allow awaiting directly after where/orderBy when limit is not called
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
        Promise.resolve(nextResult()).then(resolve, reject),
    };
    return chain;
  };

  const mockDb = {
    select: vi.fn(() => makeChain()),
  };
  const mockReadSkillFileForUser = vi.fn();

  return {
    mockSelectQueue,
    mockReadSkillFileForUser,
    mockDb,
    mockLimitCalls,
  };
});

vi.mock("@/drizzle/db", () => ({ db: mockDb }));
vi.mock("@/lib/skills/read-skill-file", () => ({
  readSkillFileForUser: (...args: unknown[]) =>
    mockReadSkillFileForUser(...args),
}));

import {
  getWorkspaceResource,
  INSPECTABLE_RESOURCES,
  listWorkspaceResource,
} from "@/lib/app-tools/inspect-workspace-queries";

const USER_ID = "user-1";
const UUID = "11111111-1111-4111-8111-111111111111";

describe("inspect-workspace-queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectQueue.length = 0;
    mockLimitCalls.length = 0;
  });

  it("supports all 9 inspectable resource types", () => {
    expect(INSPECTABLE_RESOURCES).toEqual([
      "skills",
      "projects",
      "agents",
      "prompts",
      "workflows",
      "memories",
      "models",
      "knowledgebases",
      "connectors",
    ]);
  });

  describe("listWorkspaceResource", () => {
    it("clamps limit between 1 and 100 and defaults to 50", async () => {
      mockSelectQueue.push([], [], []);

      await listWorkspaceResource(USER_ID, "projects");
      await listWorkspaceResource(USER_ID, "projects", 0);
      await listWorkspaceResource(USER_ID, "projects", 500);

      expect(mockLimitCalls).toEqual([50, 1, 100]);
    });

    it("lists skills, projects, prompts, workflows, memories, knowledgebases", async () => {
      mockSelectQueue.push(
        [{ id: UUID, name: "clean-code", displayName: "Clean Code", description: "Desc", enabled: true }],
        [{ id: UUID, name: "Proj", description: "D", knowledgebaseId: null }],
        [{ id: UUID, title: "Review", shortcut: "review" }],
        [{ id: UUID, name: "WF", description: null, requiresFileUpload: false }],
        [{ id: UUID, content: "Prefers TypeScript" }],
        [{ id: UUID, name: "KB", description: null, indexStatus: "ready" }],
      );

      expect(await listWorkspaceResource(USER_ID, "skills")).toHaveLength(1);
      expect(await listWorkspaceResource(USER_ID, "projects")).toHaveLength(1);
      expect(await listWorkspaceResource(USER_ID, "prompts")).toHaveLength(1);
      expect(await listWorkspaceResource(USER_ID, "workflows")).toHaveLength(1);
      expect(await listWorkspaceResource(USER_ID, "memories")).toHaveLength(1);
      expect(await listWorkspaceResource(USER_ID, "knowledgebases")).toHaveLength(1);
    });

    it("lists custom agents plus built-in agents respecting limit", async () => {
      mockSelectQueue.push([
        { id: UUID, name: "Custom Agent", description: "Custom" },
      ]);

      const items = await listWorkspaceResource(USER_ID, "agents", 3);
      expect(items).toHaveLength(3);
      expect(items[0]).toEqual(
        expect.objectContaining({ id: UUID, isBuiltIn: false }),
      );
      expect(items[1]).toEqual(
        expect.objectContaining({ id: "builtin:researcher", isBuiltIn: true }),
      );
    });

    it("lists models and connectors without secret fields", async () => {
      mockSelectQueue.push(
        [
          {
            id: UUID,
            modelId: "gpt-4o",
            name: "GPT-4o",
            providerName: "OpenAI",
            capTools: true,
            capVision: true,
            capReasoning: false,
            contextWindow: 128000,
          },
        ],
        [
          {
            id: UUID,
            name: "GitHub",
            url: "https://mcp.example.com",
            enabled: true,
            authType: "oauth",
            isPublic: false,
          },
        ],
      );

      const models = await listWorkspaceResource(USER_ID, "models");
      expect(models[0]).not.toHaveProperty("apiKey");
      expect(models[0]).not.toHaveProperty("headers");

      const connectors = await listWorkspaceResource(USER_ID, "connectors");
      expect(connectors[0]).not.toHaveProperty("headers");
      expect(connectors[0]).not.toHaveProperty("oauthClientSecret");
    });
  });

  describe("getWorkspaceResource", () => {
    it("gets a skill by slug or UUID and delegates filePath to readSkillFileForUser", async () => {
      mockSelectQueue.push([
        {
          id: UUID,
          name: "clean-code",
          displayName: "Clean Code",
          description: "Desc",
          content: "# Instructions",
          files: [{ path: "references/guide.md", content: "guide" }],
          enabled: true,
        },
      ]);

      const skill = await getWorkspaceResource(USER_ID, "skills", "clean-code");
      expect(skill).toEqual(
        expect.objectContaining({
          id: UUID,
          name: "clean-code",
          content: "# Instructions",
          files: [{ path: "references/guide.md", sizeBytes: 5 }],
        }),
      );

      mockReadSkillFileForUser.mockResolvedValueOnce({
        path: "references/guide.md",
        content: "guide",
      });
      const file = await getWorkspaceResource(
        USER_ID,
        "skills",
        UUID,
        "references/guide.md",
      );
      expect(mockReadSkillFileForUser).toHaveBeenCalledWith(
        USER_ID,
        UUID,
        "references/guide.md",
      );
      expect(file).toEqual({
        path: "references/guide.md",
        content: "guide",
      });

      mockReadSkillFileForUser.mockResolvedValueOnce(null);
      expect(
        await getWorkspaceResource(USER_ID, "skills", UUID, "missing.md"),
      ).toBeNull();
    });

    it("gets built-in and custom agents", async () => {
      const builtIn = await getWorkspaceResource(
        USER_ID,
        "agents",
        "builtin:researcher",
      );
      expect(builtIn).toEqual(
        expect.objectContaining({
          id: "builtin:researcher",
          isBuiltIn: true,
        }),
      );

      mockSelectQueue.push([{ id: UUID, name: "Custom", description: null }]);
      const custom = await getWorkspaceResource(USER_ID, "agents", UUID);
      expect(custom).toEqual(
        expect.objectContaining({ id: UUID, isBuiltIn: false }),
      );

      mockSelectQueue.push([]);
      expect(await getWorkspaceResource(USER_ID, "agents", UUID)).toBeNull();
    });

    it("gets workflow with nodes and edges while omitting webhookSecret", async () => {
      mockSelectQueue.push(
        [{ id: UUID, name: "WF", description: "D", requiresFileUpload: false }],
        [{ id: "n1", type: "manual_trigger", name: "Start", position: { x: 0, y: 0 }, data: {} }],
        [{ id: "e1", sourceNodeId: "n1", targetNodeId: "n2", sourceHandle: "main", targetHandle: "main" }],
      );

      const wf = await getWorkspaceResource(USER_ID, "workflows", UUID);
      expect(wf).toEqual(
        expect.objectContaining({
          id: UUID,
          nodes: expect.any(Array),
          edges: expect.any(Array),
        }),
      );
      expect(wf).not.toHaveProperty("webhookSecret");

      mockSelectQueue.push([]);
      expect(await getWorkspaceResource(USER_ID, "workflows", UUID)).toBeNull();
    });

    it("gets project, prompt, memory, model, knowledgebase, connector and returns null when missing", async () => {
      mockSelectQueue.push(
        [{ id: UUID, name: "P" }],
        [{ id: UUID, title: "Pr" }],
        [{ id: UUID, content: "Mem" }],
        [{ id: UUID, modelId: "gpt-4o", name: "GPT-4o", providerName: "OpenAI" }],
        [{ id: UUID, name: "KB" }],
        [{ id: UUID, name: "Conn" }],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [{ id: UUID, name: "empty-files", displayName: "Empty", description: "D", content: "C", files: null, enabled: true }],
      );

      expect(await getWorkspaceResource(USER_ID, "projects", UUID)).toEqual({ id: UUID, name: "P" });
      expect(await getWorkspaceResource(USER_ID, "prompts", UUID)).toEqual({ id: UUID, title: "Pr" });
      expect(await getWorkspaceResource(USER_ID, "memories", UUID)).toEqual({ id: UUID, content: "Mem" });
      expect(await getWorkspaceResource(USER_ID, "models", UUID)).toEqual(
        expect.objectContaining({ id: UUID, modelId: "gpt-4o" }),
      );
      expect(await getWorkspaceResource(USER_ID, "knowledgebases", UUID)).toEqual({ id: UUID, name: "KB" });
      expect(await getWorkspaceResource(USER_ID, "connectors", UUID)).toEqual({ id: UUID, name: "Conn" });
      expect(await getWorkspaceResource(USER_ID, "projects", UUID)).toBeNull();
      expect(await getWorkspaceResource(USER_ID, "skills", UUID)).toBeNull();
      expect(await getWorkspaceResource(USER_ID, "prompts", UUID)).toBeNull();
      expect(await getWorkspaceResource(USER_ID, "memories", UUID)).toBeNull();
      expect(await getWorkspaceResource(USER_ID, "models", UUID)).toBeNull();
      expect(await getWorkspaceResource(USER_ID, "knowledgebases", UUID)).toBeNull();
      expect(await getWorkspaceResource(USER_ID, "connectors", UUID)).toBeNull();
      expect(await getWorkspaceResource(USER_ID, "skills", UUID)).toEqual(
        expect.objectContaining({ id: UUID, files: [] }),
      );
    });

    it("strips userinfo and query secrets from connector URLs in list and detail", async () => {
      mockSelectQueue.push(
        [
          {
            id: UUID,
            name: "Secret Conn",
            url: "https://user:pass@mcp.example/mcp?api_key=secret#frag",
            enabled: true,
            authType: "none",
            isPublic: false,
          },
        ],
        [
          {
            id: UUID,
            name: "Malformed Conn",
            url: "not-a-valid-url?token=abc#sec",
            enabled: true,
            authType: "none",
            isPublic: false,
          },
        ],
      );

      const list = await listWorkspaceResource(USER_ID, "connectors");
      expect(list[0]).toEqual(
        expect.objectContaining({
          id: UUID,
          url: "https://mcp.example/mcp",
        }),
      );

      const detail = await getWorkspaceResource(USER_ID, "connectors", UUID);
      expect(detail).toEqual(
        expect.objectContaining({
          id: UUID,
          url: "not-a-valid-url",
        }),
      );
    });
  });
});
