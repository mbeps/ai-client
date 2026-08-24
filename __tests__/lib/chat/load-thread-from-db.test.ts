// ── queue-based DB mock ──────────────────────────────────────────────────────
// Each queued entry is consumed by one `where()` call, in call order:
// chat lookup → messages → attachments. The returned promise carries an
// `orderBy` that resolves the SAME rows (the result set is fixed after where).
const chainable = vi.hoisted(() => {
  const c: any = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
  };
  let queued: unknown[][] = [];
  const installWhere = () => {
    c.where.mockImplementation(() => {
      const rows = queued.shift() ?? [];
      const p: any = Promise.resolve(rows);
      p.orderBy = () => Promise.resolve(rows);
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

const mockGetPresignedUrl = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage/get-presigned-url", () => ({
  getPresignedUrl: mockGetPresignedUrl,
}));

import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadThreadFromDb } from "@/lib/chat/load-thread-from-db";
import { ChatNotFoundError } from "@/lib/chat/load-chat-context";

beforeEach(() => {
  vi.clearAllMocks();
  chainable.select.mockReturnValue(chainable);
  chainable.from.mockReturnValue(chainable);
  // clearAllMocks keeps implementations, but re-install defensively since the
  // impl closes over a `queued` array that must stay shared with __queueWhere
  chainable.__installWhere();
  chainable.__resetQueue();
  mockGetPresignedUrl.mockResolvedValue("https://example.com/presigned");
});

describe("loadThreadFromDb", () => {
  it("throws ChatNotFoundError when chat does not exist", async () => {
    chainable.__queueWhere([]); // chat lookup returns no row

    await expect(
      loadThreadFromDb("chat-1", "msg-leaf", "user-1"),
    ).rejects.toThrow(ChatNotFoundError);
  });

  it("throws ChatNotFoundError when chat belongs to another user", async () => {
    chainable.__queueWhere([]); // ownership filter excludes the row

    await expect(
      loadThreadFromDb("chat-1", "msg-leaf", "user-1"),
    ).rejects.toThrow(ChatNotFoundError);
  });

  it("returns only the branch root→leaf, not sibling branches", async () => {
    chainable.__queueWhere([{ id: "chat-1" }]);
    chainable.__queueWhere([
      { id: "root", role: "user", content: "hi", parentId: null },
      { id: "a1", role: "assistant", content: "branch A", parentId: "root" },
      { id: "b1", role: "assistant", content: "branch B", parentId: "root" },
      { id: "b2", role: "user", content: "follow-up B", parentId: "b1" },
    ]);
    chainable.__queueWhere([]); // attachments

    const thread = await loadThreadFromDb("chat-1", "b2", "user-1");

    expect(thread.map((m) => m.id)).toEqual(["root", "b1", "b2"]);
  });

  it("throws when userMessageId is not found among chat messages", async () => {
    chainable.__queueWhere([{ id: "chat-1" }]);
    chainable.__queueWhere([
      { id: "root", role: "user", content: "hi", parentId: null },
    ]);
    chainable.__queueWhere([]);

    await expect(
      loadThreadFromDb("chat-1", "missing-msg", "user-1"),
    ).rejects.toThrow(/not found/i);
  });

  it("includes attachments with presigned URLs scoped to the user", async () => {
    chainable.__queueWhere([{ id: "chat-1" }]);
    chainable.__queueWhere([
      { id: "root", role: "user", content: "see file", parentId: null },
    ]);
    chainable.__queueWhere([
      {
        id: "att-1",
        messageId: "root",
        name: "report.pdf",
        mimeType: "application/pdf",
        key: "uploads/user-1/report.pdf",
      },
    ]);
    mockGetPresignedUrl.mockResolvedValueOnce("https://example.com/report");

    const thread = await loadThreadFromDb("chat-1", "root", "user-1");

    expect(mockGetPresignedUrl).toHaveBeenCalledWith(
      "uploads/user-1/report.pdf",
    );
    expect(thread[0].attachments).toEqual([
      {
        id: "att-1",
        name: "report.pdf",
        url: "https://example.com/report",
        type: "document",
      },
    ]);
  });
});
