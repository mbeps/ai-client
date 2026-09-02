// ── queue-based DB mock ──────────────────────────────────────────────────────
// Each queued entry is consumed by one `where()` call, in call order.
const chainable = vi.hoisted(() => {
  const c: any = {
    select: vi.fn(),
    from: vi.fn(),
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
      },
    ]);
    chainable.__queueWhere([]); // personal mcp servers
    chainable.__queueWhere([]); // installed mcp servers
    chainable.__queueWhere([]); // ownership filter excludes other user's KB
    chainable.__queueWhere([]); // user skills

    const ctx = await loadChatContext("chat-1", "user-1");

    expect(ctx.kbIsReady).toBe(false);
  });
});
