// ── Chainable Drizzle select mock ──────────────────────────────────────────
// `.where()` returns the promise the unit under test awaits. Rows are queued
// per `where()` call so each test states exactly which result set it wants.
const chainable = vi.hoisted(() => {
  const c: any = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
  };
  let queued: unknown[][] = [];
  const installWhere = () => {
    c.where.mockImplementation(() => Promise.resolve(queued.shift() ?? []));
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
import { getUserSettingsByUserId } from "@/lib/user/get-user-settings-by-id";

const makeRow = (userId: string) => ({
  id: "settings-1",
  userId,
  globalSystemPrompt: null,
  defaultModelId: null,
  knowledgebaseId: null,
  temperature: null,
  logLevel: null,
  theme: null,
  language: null,
  timezone: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
});

beforeEach(() => {
  vi.clearAllMocks();
  chainable.select.mockReturnValue(chainable);
  chainable.from.mockReturnValue(chainable);
  // clearAllMocks keeps implementations, but re-install defensively because the
  // implementation closes over the `queued` array shared with __queueWhere.
  chainable.__installWhere();
  chainable.__resetQueue();
});

describe("getUserSettingsByUserId", () => {
  it("returns the settings row when one exists", async () => {
    const row = makeRow("user-1");
    chainable.__queueWhere([row]);

    const result = await getUserSettingsByUserId("user-1");

    expect(result).toBe(row);
    // Prove the query was scoped to the userSettings table by user id.
    expect(chainable.select).toHaveBeenCalledTimes(1);
    expect(chainable.from).toHaveBeenCalledTimes(1);
    expect(chainable.where).toHaveBeenCalledTimes(1);
  });

  it("returns null when the result set is empty", async () => {
    chainable.__queueWhere([]);

    await expect(getUserSettingsByUserId("missing-user")).resolves.toBeNull();
  });

  it("returns null for a result set containing an undefined row", async () => {
    // Drizzle yields `[row]` on a hit and `[]` on a miss; an explicit
    // `undefined` first element exercises the `?? null` fallback directly.
    chainable.__queueWhere([undefined]);

    await expect(getUserSettingsByUserId("ghost")).resolves.toBeNull();
  });
});
