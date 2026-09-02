import { beforeEach, describe, expect, it, vi } from "vitest";

// Spy on drizzle-orm condition builders so the WHERE clause can be verified.
vi.mock("drizzle-orm", async (importOriginal) => {
  const mod = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...mod,
    and: vi.fn(mod.and),
    eq: vi.fn(mod.eq),
    lt: vi.fn(mod.lt),
  };
});

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of ["update", "set"]) c[m] = vi.fn();
  c.where = vi.fn().mockImplementation(() => c);
  c.returning = vi.fn();
  c.update.mockImplementation(() => c);
  c.set.mockImplementation(() => c);
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

import { and, eq, lt } from "drizzle-orm";
import { transformRun } from "@/drizzle/schema";
import { resetStuckRuns } from "@/lib/transform/lifecycle-service";

describe("resetStuckRuns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.update.mockImplementation(() => chainable);
    chainable.set.mockImplementation(() => chainable);
    chainable.where.mockImplementation(() => chainable);
  });

  it("updates stale running rows to failed and returns count", async () => {
    chainable.returning.mockResolvedValue([{ id: "r1" }, { id: "r2" }]);

    const count = await resetStuckRuns(10);

    expect(count).toBe(2);
    expect(chainable.update).toHaveBeenCalledWith(transformRun);
    expect(chainable.set).toHaveBeenCalledWith({
      status: "failed",
      errorMessage: "Run timed out",
    });
    // where must filter on running status AND stale updatedAt
    expect(and).toHaveBeenCalledTimes(1);
    expect(eq).toHaveBeenCalledWith(transformRun.status, "running");
    expect(lt).toHaveBeenCalledWith(transformRun.updatedAt, expect.anything());
  });

  it("returns 0 when nothing matched", async () => {
    chainable.returning.mockResolvedValue([]);

    const count = await resetStuckRuns(10);

    expect(count).toBe(0);
  });
});
