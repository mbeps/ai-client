// ── queue-based DB mock ──────────────────────────────────────────────────────
// Each queued entry is consumed by one `where()` call, in call order.
const chainable = vi.hoisted(() => {
  const c: any = {
    select: vi.fn(),
    from: vi.fn(),
    leftJoin: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  };
  let queued: unknown[][] = [];
  const installWhere = () => {
    c.where.mockImplementation(() => {
      const rows = queued.shift() ?? [];
      const p: any = Promise.resolve(rows);
      p.limit = () => Promise.resolve(rows);
      return p;
    });
  };
  installWhere();
  (c as any).__queueWhere = (rows: unknown[]) => {
    queued.push(rows);
  };
  (c as any).__resetQueue = () => {
    queued = [];
  };
  (c as any).__installWhere = installWhere;
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));
vi.mock("@/lib/memory/retrieve-relevant-memories", () => ({
  retrieveRelevantMemories: vi.fn().mockResolvedValue([]),
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { encrypt } from "@/lib/encryption/encrypt";
import { loadChatContext } from "@/lib/chat/load-chat-context";

beforeEach(() => {
  vi.clearAllMocks();
  chainable.select.mockReturnValue(chainable);
  chainable.from.mockReturnValue(chainable);
  chainable.leftJoin.mockReturnValue(chainable);
  chainable.innerJoin.mockReturnValue(chainable);
  // clearAllMocks keeps implementations, but re-install defensively since the
  // impl closes over a `queued` array that must stay shared with __queueWhere
  chainable.__installWhere();
  chainable.__resetQueue();
});

describe("loadChatContext KB ownership", () => {
  it("resolves activeKb for the owner's own knowledgebase", async () => {
    chainable.__queueWhere([
      {
        id: "chat-1",
        projectId: null,
        assistantId: null,
        knowledgebaseId: "kb-1",
        projectTableId: null,
        projectGlobalPrompt: null,
        projectKnowledgebaseId: null,
      },
    ]);
    chainable.__queueWhere([]); // personal mcp servers
    chainable.__queueWhere([]); // installed mcp servers
    chainable.__queueWhere([{ indexStatus: "ready" }]); // own KB found
    chainable.__queueWhere([]); // user skills

    const ctx = await loadChatContext("chat-1", "user-1");

    expect(ctx.activeKbId).toBe("kb-1");
    expect(ctx.kbIsReady).toBe(true);
  });

  it("treats another user's knowledgebase id as no active KB", async () => {
    chainable.__queueWhere([
      {
        id: "chat-1",
        projectId: null,
        assistantId: null,
        knowledgebaseId: "kb-2",
        projectTableId: null,
        projectGlobalPrompt: null,
        projectKnowledgebaseId: null,
      },
    ]);
    chainable.__queueWhere([]); // personal mcp servers
    chainable.__queueWhere([]); // installed mcp servers
    chainable.__queueWhere([]); // ownership filter excludes other user's KB
    chainable.__queueWhere([]); // user skills

    const ctx = await loadChatContext("chat-1", "user-1");

    expect(ctx.kbIsReady).toBe(false);
  });

  it("decrypts encrypted MCP server headers for personal and installed servers", async () => {
    const encryptedPersonal = encrypt(
      JSON.stringify({ "X-Personal": "p-secret" }),
    );
    const encryptedInstalled = encrypt(
      JSON.stringify({ "X-Installed": "i-secret" }),
    );

    chainable.__queueWhere([
      {
        id: "chat-1",
        projectId: null,
        assistantId: null,
        knowledgebaseId: null,
        projectTableId: null,
        projectGlobalPrompt: null,
        projectKnowledgebaseId: null,
      },
    ]);
    chainable.__queueWhere([
      {
        id: "srv-1",
        name: "Personal Server",
        url: "https://personal.example.com/mcp",
        headers: encryptedPersonal,
      },
    ]);
    chainable.__queueWhere([
      {
        id: "srv-2",
        name: "Installed Server",
        url: "https://installed.example.com/mcp",
        headers: encryptedInstalled,
      },
    ]);
    chainable.__queueWhere([]); // user skills

    const ctx = await loadChatContext("chat-1", "user-1");

    expect(ctx.servers).toEqual([
      {
        id: "srv-1",
        name: "Personal Server",
        url: "https://personal.example.com/mcp",
        headers: JSON.stringify({ "X-Personal": "p-secret" }),
        authType: "headers",
        oauthClientId: null,
        oauthClientSecret: null,
        oauthScope: null,
        userId: "user-1",
      },
      {
        id: "srv-2",
        name: "Installed Server",
        url: "https://installed.example.com/mcp",
        headers: JSON.stringify({ "X-Installed": "i-secret" }),
        authType: "headers",
        oauthClientId: null,
        oauthClientSecret: null,
        oauthScope: null,
        userId: "user-1",
      },
    ]);
  });

  it("throws ChatNotFoundError when chat row does not exist", async () => {
    chainable.__queueWhere([]); // chat not found
    await expect(loadChatContext("missing-chat", "user-1")).rejects.toThrow();
  });

  it("resolves project, assistant, filtered servers, and matched skills", async () => {
    // 1. Initial chat and project lookup (left-joined)
    chainable.__queueWhere([
      {
        id: "chat-1",
        projectId: "proj-1",
        assistantId: null,
        knowledgebaseId: null,
        projectTableId: "proj-1",
        projectGlobalPrompt: "Project Instructions",
        projectKnowledgebaseId: "proj-kb",
      },
    ]);

    // In Promise.all:
    // 2. Assistant lookup (using selectedAssistantId)
    chainable.__queueWhere([{ prompt: "Assistant Prompt" }]);

    // 3. Personal MCP servers
    chainable.__queueWhere([{ id: "srv-1", name: "Personal Server" }]);

    // 4. Installed MCP servers
    chainable.__queueWhere([{ id: "srv-2", name: "Public Server" }]);

    // 5. KB readiness check (for activeKbId = "proj-kb" inherited from project)
    chainable.__queueWhere([{ indexStatus: "ready" }]);

    // 6. User skills
    chainable.__queueWhere([
      { id: "sk-1", name: "skill-one", displayName: "Skill One", description: "First" },
      { id: "sk-2", name: "skill-two", displayName: "Skill Two", description: "Second" },
    ]);

    const ctx = await loadChatContext(
      "chat-1",
      "user-1",
      ["srv-1"],
      undefined,
      "asst-1",
      ["skill-two"],
    );

    expect(ctx.projectRow?.globalPrompt).toBe("Project Instructions");
    expect(ctx.projectRow?.knowledgebaseId).toBe("proj-kb");
    expect(ctx.activeKbId).toBe("proj-kb");
    expect(ctx.kbIsReady).toBe(true);
    expect(ctx.agentRow?.prompt).toBe("Assistant Prompt");
    expect(ctx.servers).toHaveLength(1);
    expect(ctx.servers[0].id).toBe("srv-1");
    expect(ctx.selectedSkills).toHaveLength(1);
    expect(ctx.selectedSkills[0].name).toBe("skill-two");
    // Pre-loaded skills are fully injected, so they are omitted from the catalog.
    expect(ctx.availableSkills).toHaveLength(1);
    expect(ctx.availableSkills[0].name).toBe("skill-one");
  });

  it("inherits knowledgebase from project when chat has no knowledgebase", async () => {
    // 1. Initial joined chat + project lookup
    chainable.__queueWhere([
      {
        id: "chat-1",
        projectId: "proj-1",
        assistantId: null,
        knowledgebaseId: null,
        projectTableId: "proj-1",
        projectGlobalPrompt: "Project Prompt",
        projectKnowledgebaseId: "proj-kb-1",
      },
    ]);
    chainable.__queueWhere([]); // personal mcp servers
    chainable.__queueWhere([]); // installed mcp servers
    chainable.__queueWhere([{ indexStatus: "ready" }]); // project KB found and ready
    chainable.__queueWhere([]); // user skills

    const ctx = await loadChatContext("chat-1", "user-1");

    expect(ctx.activeKbId).toBe("proj-kb-1");
    expect(ctx.kbIsReady).toBe(true);
    expect(ctx.projectRow?.knowledgebaseId).toBe("proj-kb-1");
  });

  it("prioritizes chat knowledgebase over project knowledgebase", async () => {
    chainable.__queueWhere([
      {
        id: "chat-1",
        projectId: "proj-1",
        assistantId: null,
        knowledgebaseId: "chat-kb-1",
        projectTableId: "proj-1",
        projectGlobalPrompt: "Project Prompt",
        projectKnowledgebaseId: "proj-kb-1",
      },
    ]);
    chainable.__queueWhere([]); // personal mcp servers
    chainable.__queueWhere([]); // installed mcp servers
    chainable.__queueWhere([{ indexStatus: "ready" }]); // chat KB found and ready
    chainable.__queueWhere([]); // user skills

    const ctx = await loadChatContext("chat-1", "user-1");

    expect(ctx.activeKbId).toBe("chat-kb-1");
    expect(ctx.kbIsReady).toBe(true);
  });

  it("prioritizes selectedKbIds over both chat and project knowledgebase", async () => {
    chainable.__queueWhere([
      {
        id: "chat-1",
        projectId: "proj-1",
        assistantId: null,
        knowledgebaseId: "chat-kb-1",
        projectTableId: "proj-1",
        projectGlobalPrompt: "Project Prompt",
        projectKnowledgebaseId: "proj-kb-1",
      },
    ]);
    chainable.__queueWhere([]); // personal mcp servers
    chainable.__queueWhere([]); // installed mcp servers
    chainable.__queueWhere([{ indexStatus: "ready" }]); // override KB found and ready
    chainable.__queueWhere([]); // user skills

    const ctx = await loadChatContext("chat-1", "user-1", undefined, [
      "override-kb-1",
    ]);

    expect(ctx.activeKbId).toBe("override-kb-1");
    expect(ctx.activeKbIds).toEqual(["override-kb-1"]);
    expect(ctx.kbIsReady).toBe(true);
  });

  it("handles multiple selectedKbIds and filters to only ready KBs", async () => {
    chainable.__queueWhere([
      {
        id: "chat-1",
        projectId: null,
        assistantId: null,
        knowledgebaseId: null,
        projectTableId: null,
        projectGlobalPrompt: null,
        projectKnowledgebaseId: null,
      },
    ]);
    chainable.__queueWhere([]); // personal mcp servers
    chainable.__queueWhere([]); // installed mcp servers
    // KB query for multiple KBs returns one ready, one indexing
    chainable.__queueWhere([
      { id: "kb-1", indexStatus: "ready" },
      { id: "kb-2", indexStatus: "indexing" },
    ]);
    chainable.__queueWhere([]); // user skills

    const ctx = await loadChatContext("chat-1", "user-1", undefined, [
      "kb-1",
      "kb-2",
    ]);

    expect(ctx.activeKbIds).toEqual(["kb-1"]);
    expect(ctx.activeKbId).toBe("kb-1");
    expect(ctx.kbIsReady).toBe(true);
  });

  it("returns empty servers array when selectedServerIds is explicitly empty", async () => {
    chainable.__queueWhere([
      {
        id: "chat-1",
        projectId: null,
        assistantId: null,
        knowledgebaseId: null,
        projectTableId: null,
        projectGlobalPrompt: null,
        projectKnowledgebaseId: null,
      },
    ]);
    chainable.__queueWhere([{ id: "srv-1", name: "Server" }]);
    chainable.__queueWhere([]);
    chainable.__queueWhere([]);

    const ctx = await loadChatContext("chat-1", "user-1", []);

    expect(ctx.servers).toEqual([]);
  });

  it("returns a null assistantRow when the assistant lookup matches no row", async () => {
    chainable.__queueWhere([
      {
        id: "chat-1",
        projectId: null,
        assistantId: "asst-missing",
        knowledgebaseId: null,
        projectTableId: null,
        projectGlobalPrompt: null,
        projectKnowledgebaseId: null,
      },
    ]);
    // The assistant query runs first inside Promise.all; an empty result set
    // selects the `?? null` arm rather than `rows[0]`.
    chainable.__queueWhere([]);
    chainable.__queueWhere([]); // personal mcp servers
    chainable.__queueWhere([]); // installed mcp servers
    chainable.__queueWhere([]); // user skills

    const ctx = await loadChatContext("chat-1", "user-1");

    expect(ctx.agentRow).toBeNull();
  });

  it("returns the agent row when the lookup matches a custom agent", async () => {
    chainable.__queueWhere([
      {
        id: "chat-1",
        projectId: null,
        agentId: "agent-1",
        knowledgebaseId: null,
        projectTableId: null,
        projectGlobalPrompt: null,
        projectKnowledgebaseId: null,
        projectSubagentIds: [],
      },
    ]);
    chainable.__queueWhere([
      {
        id: "agent-1",
        name: "Terse Agent",
        prompt: "Be terse",
        skillMode: "dynamic",
        skillIds: [],
        knowledgebaseIds: ["kb-agent-1"],
        subagentIds: ["builtin:researcher"],
      },
    ]);
    chainable.__queueWhere([]); // personal mcp servers
    chainable.__queueWhere([]); // installed mcp servers
    chainable.__queueWhere([]); // user skills
    chainable.__queueWhere([{ id: "kb-agent-1", indexStatus: "ready" }]); // agent KB

    const ctx = await loadChatContext("chat-1", "user-1");

    expect(ctx.agentRow).toMatchObject({ id: "agent-1", prompt: "Be terse" });
    expect(ctx.activeKbIds).toEqual(["kb-agent-1"]);
    expect(ctx.linkedSubagents.map((a) => a.id)).toEqual(["builtin:researcher"]);
  });

  it("resolves built-in agent directly without querying agent table and resolves custom linkedSubagents", async () => {
    chainable.__queueWhere([
      {
        id: "chat-2",
        projectId: "proj-1",
        agentId: "builtin:researcher",
        knowledgebaseId: null,
        projectTableId: "proj-1",
        projectGlobalPrompt: "Project prompt",
        projectKnowledgebaseId: null,
        projectSubagentIds: ["custom-leaf-1"],
      },
    ]);
    chainable.__queueWhere([]); // personal mcp servers
    chainable.__queueWhere([]); // installed mcp servers
    chainable.__queueWhere([]); // user skills
    chainable.__queueWhere([
      {
        id: "custom-leaf-1",
        userId: "user-1",
        name: "Leaf Worker",
        description: "Does leaf work",
        prompt: "Leaf prompt",
        subagentPrompt: null,
        modelId: null,
        knowledgebaseIds: [],
        tools: [],
        skillMode: "dynamic",
        skillIds: [],
        promptMode: "all",
        promptIds: [],
        subagentIds: [],
        guardrails: { maxSteps: 8, scratchpadAccess: "read_only", isolateTools: true },
        avatar: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    const ctx = await loadChatContext("chat-2", "user-1");

    expect(ctx.agentRow?.id).toBe("builtin:researcher");
    expect(ctx.linkedSubagents.map((a) => a.id)).toEqual(["custom-leaf-1"]);
  });

  it("uses selectedSubagentIds override when provided and falls back to linkable built-ins otherwise", async () => {
    chainable.__queueWhere([
      {
        id: "chat-3",
        projectId: null,
        agentId: null,
        knowledgebaseId: null,
        projectTableId: null,
        projectGlobalPrompt: null,
        projectKnowledgebaseId: null,
        projectSubagentIds: [],
      },
    ]);
    chainable.__queueWhere([]);
    chainable.__queueWhere([]);
    chainable.__queueWhere([]);

    const defaultCtx = await loadChatContext("chat-3", "user-1");
    expect(defaultCtx.linkedSubagents.map((a) => a.id)).toEqual([
      "builtin:researcher",
      "builtin:planner",
      "builtin:reviewer",
      "builtin:worker",
    ]);

    chainable.__queueWhere([
      {
        id: "chat-3",
        projectId: null,
        agentId: null,
        knowledgebaseId: null,
        projectTableId: null,
        projectGlobalPrompt: null,
        projectKnowledgebaseId: null,
        projectSubagentIds: [],
      },
    ]);
    chainable.__queueWhere([]);
    chainable.__queueWhere([]);
    chainable.__queueWhere([]);

    const overrideCtx = await loadChatContext(
      "chat-3",
      "user-1",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      ["builtin:planner"],
    );
    expect(overrideCtx.linkedSubagents.map((a) => a.id)).toEqual(["builtin:planner"]);
  });
});
