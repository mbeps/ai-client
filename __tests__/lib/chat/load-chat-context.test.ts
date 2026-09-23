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

import { beforeEach, describe, expect, it, vi } from "vitest";
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
    expect(ctx.assistantRow?.prompt).toBe("Assistant Prompt");
    expect(ctx.servers).toHaveLength(1);
    expect(ctx.servers[0].id).toBe("srv-1");
    expect(ctx.selectedSkills).toHaveLength(1);
    expect(ctx.selectedSkills[0].name).toBe("skill-two");
    expect(ctx.availableSkills).toHaveLength(2);
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
});
