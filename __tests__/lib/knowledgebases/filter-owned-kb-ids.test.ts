import { beforeEach, describe, expect, it, vi } from "vitest";
import { filterOwnedKbIds } from "@/lib/knowledgebases/filter-owned-kb-ids";

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("@/drizzle/db", () => ({ db: dbMock }));

describe("filterOwnedKbIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array without querying DB when input is empty or falsy", async () => {
    expect(await filterOwnedKbIds("user-1", [])).toEqual([]);
    expect(await filterOwnedKbIds("user-1", ["", ""])).toEqual([]);
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it("returns only knowledge base IDs owned by the user in original order", async () => {
    const query = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ id: "kb-2" }, { id: "kb-1" }]),
    };
    dbMock.select.mockReturnValueOnce(query);

    const owned = await filterOwnedKbIds("user-1", [
      "kb-1",
      "kb-foreign",
      "kb-2",
      "kb-1",
    ]);

    expect(owned).toEqual(["kb-1", "kb-2"]);
    expect(dbMock.select).toHaveBeenCalledTimes(1);
  });
});
