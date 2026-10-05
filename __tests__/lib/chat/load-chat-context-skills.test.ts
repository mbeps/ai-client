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

const SKILL_ONE = {
  id: "sk-1",
  name: "skill-one",
  displayName: "Skill One",
  description: "First",
  content: "One body",
};

const SKILL_TWO = {
  id: "sk-2",
  name: "skill-two",
  displayName: "Skill Two",
  description: "Second",
  content: "Two body",
};

const SKILL_THREE = {
  id: "sk-3",
  name: "skill-three",
  displayName: "Skill Three",
  description: "Third",
  content: "Three body",
};

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

describe("loadChatContext skill configuration", () => {
  it("prefers assistant skill config over project skill config", async () => {
    // 1. Chat + joined project row
    chainable.__queueWhere([
      {
        id: "chat-1",
        projectId: "proj-1",
        assistantId: "asst-1",
        knowledgebaseId: null,
        projectTableId: "proj-1",
        projectGlobalPrompt: null,
        projectKnowledgebaseId: null,
        projectSkillMode: "specific",
        projectSkillIds: ["sk-1"],
      },
    ]);
    // 2. Assistant row (assistant wins)
    chainable.__queueWhere([
      {
        prompt: null,
        skillMode: "specific",
        skillIds: ["sk-3"],
      },
    ]);
    chainable.__queueWhere([]); // personal mcp servers
    chainable.__queueWhere([]); // installed mcp servers
    // No KB ids, so the KB query short-circuits without consuming a queue slot.
    chainable.__queueWhere([SKILL_ONE, SKILL_TWO, SKILL_THREE]); // user skills

    const ctx = await loadChatContext("chat-1", "user-1");

    expect(ctx.skillMode).toBe("specific");
    expect(ctx.skillIds).toEqual(["sk-3"]);
    expect(ctx.selectedSkills.map((s) => s.name)).toEqual(["skill-three"]);
    expect(ctx.availableSkills.map((s) => s.name)).toEqual([
      "skill-one",
      "skill-two",
    ]);
  });

  it("falls back to project skill config when the assistant has none", async () => {
    chainable.__queueWhere([
      {
        id: "chat-1",
        projectId: "proj-1",
        assistantId: "asst-1",
        knowledgebaseId: null,
        projectTableId: "proj-1",
        projectGlobalPrompt: null,
        projectKnowledgebaseId: null,
        projectSkillMode: "specific",
        projectSkillIds: ["sk-1"],
      },
    ]);
    chainable.__queueWhere([{ prompt: null }]); // assistant row without skill config
    chainable.__queueWhere([]); // personal mcp servers
    chainable.__queueWhere([]); // installed mcp servers
    chainable.__queueWhere([SKILL_ONE, SKILL_TWO]); // user skills

    const ctx = await loadChatContext("chat-1", "user-1");

    expect(ctx.skillMode).toBe("specific");
    expect(ctx.skillIds).toEqual(["sk-1"]);
    expect(ctx.selectedSkills.map((s) => s.name)).toEqual(["skill-one"]);
    expect(ctx.availableSkills.map((s) => s.name)).toEqual(["skill-two"]);
  });

  it("defaults to dynamic mode with no ids when neither entity configures skills", async () => {
    chainable.__queueWhere([
      {
        id: "chat-1",
        projectId: null,
        assistantId: null,
        knowledgebaseId: null,
        projectTableId: null,
        projectGlobalPrompt: null,
        projectKnowledgebaseId: null,
        projectSkillMode: null,
        projectSkillIds: null,
      },
    ]);
    chainable.__queueWhere([]); // personal mcp servers
    chainable.__queueWhere([]); // installed mcp servers
    chainable.__queueWhere([SKILL_ONE, SKILL_TWO]); // user skills

    const ctx = await loadChatContext("chat-1", "user-1");

    expect(ctx.skillMode).toBe("dynamic");
    expect(ctx.skillIds).toEqual([]);
    expect(ctx.selectedSkills).toEqual([]);
    expect(ctx.availableSkills.map((s) => s.name)).toEqual([
      "skill-one",
      "skill-two",
    ]);
  });

  it("returns empty skills in none mode even when the chat sends selectedSkillIds", async () => {
    chainable.__queueWhere([
      {
        id: "chat-1",
        projectId: "proj-1",
        assistantId: null,
        knowledgebaseId: null,
        projectTableId: "proj-1",
        projectGlobalPrompt: null,
        projectKnowledgebaseId: null,
        projectSkillMode: "none",
        projectSkillIds: [],
      },
    ]);
    chainable.__queueWhere([]); // personal mcp servers
    chainable.__queueWhere([]); // installed mcp servers
    chainable.__queueWhere([SKILL_ONE, SKILL_TWO]); // user skills are still loaded

    const ctx = await loadChatContext(
      "chat-1",
      "user-1",
      undefined,
      undefined,
      undefined,
      ["sk-1"],
    );

    expect(ctx.skillMode).toBe("none");
    expect(ctx.selectedSkills).toEqual([]);
    expect(ctx.availableSkills).toEqual([]);
  });

  it("produces both preloaded and catalog entries in specific mode", async () => {
    chainable.__queueWhere([
      {
        id: "chat-1",
        projectId: "proj-1",
        assistantId: null,
        knowledgebaseId: null,
        projectTableId: "proj-1",
        projectGlobalPrompt: null,
        projectKnowledgebaseId: null,
        projectSkillMode: "specific",
        projectSkillIds: ["skill-one"],
      },
    ]);
    chainable.__queueWhere([]); // personal mcp servers
    chainable.__queueWhere([]); // installed mcp servers
    chainable.__queueWhere([SKILL_ONE, SKILL_TWO, SKILL_THREE]); // user skills

    const ctx = await loadChatContext("chat-1", "user-1");

    // Matched by name, not id.
    expect(ctx.selectedSkills).toHaveLength(1);
    expect(ctx.selectedSkills[0].id).toBe("sk-1");
    expect(ctx.selectedSkills[0].content).toBe("One body");
    // Preloaded skills are excluded from the catalog.
    expect(ctx.availableSkills.map((s) => s.name)).toEqual([
      "skill-two",
      "skill-three",
    ]);
    expect(ctx.availableSkills[0]).toEqual({
      name: "skill-two",
      displayName: "Skill Two",
      description: "Second",
    });
  });

  it("honours selectedSkillIds in dynamic mode and excludes them from the catalog", async () => {
    chainable.__queueWhere([
      {
        id: "chat-1",
        projectId: null,
        assistantId: null,
        knowledgebaseId: null,
        projectTableId: null,
        projectGlobalPrompt: null,
        projectKnowledgebaseId: null,
        projectSkillMode: null,
        projectSkillIds: null,
      },
    ]);
    chainable.__queueWhere([]); // personal mcp servers
    chainable.__queueWhere([]); // installed mcp servers
    chainable.__queueWhere([SKILL_ONE, SKILL_TWO]); // user skills

    const ctx = await loadChatContext(
      "chat-1",
      "user-1",
      undefined,
      undefined,
      undefined,
      ["sk-2"],
    );

    expect(ctx.selectedSkills.map((s) => s.name)).toEqual(["skill-two"]);
    expect(ctx.availableSkills.map((s) => s.name)).toEqual(["skill-one"]);
  });
});