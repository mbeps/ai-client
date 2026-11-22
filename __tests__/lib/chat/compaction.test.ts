import { describe, expect, it } from "vitest";
import { isCompactionMessage } from "@/lib/chat/is-compaction-message";
import { sliceThreadFromLatestCompaction } from "@/lib/chat/slice-thread-from-compaction";

describe("isCompactionMessage", () => {
  it("returns true for system message with compaction metadata", () => {
    expect(
      isCompactionMessage({
        role: "system",
        metadata: JSON.stringify({ compaction: { compactedCount: 4 } }),
      }),
    ).toBe(true);
  });

  it("returns false for non-system roles even with compaction metadata", () => {
    expect(
      isCompactionMessage({
        role: "assistant",
        metadata: JSON.stringify({ compaction: { compactedCount: 4 } }),
      }),
    ).toBe(false);
  });

  it("returns false for system message without compaction metadata", () => {
    expect(
      isCompactionMessage({
        role: "system",
        metadata: JSON.stringify({ model: "gpt-4o" }),
      }),
    ).toBe(false);
  });
});

describe("sliceThreadFromLatestCompaction", () => {
  it("returns full thread when no compaction checkpoint exists", () => {
    const thread = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ];
    const result = sliceThreadFromLatestCompaction(thread);
    expect(result.compactionMessage).toBeUndefined();
    expect(result.compactionSummary).toBeUndefined();
    expect(result.activeMessages).toEqual(thread);
  });

  it("slices from the latest compaction checkpoint when multiple exist", () => {
    const firstCheckpoint = {
      role: "system",
      content: "First summary",
      metadata: JSON.stringify({ compaction: { compactedCount: 2 } }),
    };
    const secondCheckpoint = {
      role: "system",
      content: "Second summary",
      metadata: JSON.stringify({ compaction: { compactedCount: 3 } }),
    };
    const recentUser = { role: "user", content: "latest question" };

    const thread = [
      { role: "user", content: "old 1" },
      firstCheckpoint,
      { role: "user", content: "mid 1" },
      secondCheckpoint,
      recentUser,
    ];

    const result = sliceThreadFromLatestCompaction(thread);
    expect(result.compactionMessage).toBe(secondCheckpoint);
    expect(result.compactionSummary).toBe("Second summary");
    expect(result.activeMessages).toEqual([recentUser]);
  });
});
