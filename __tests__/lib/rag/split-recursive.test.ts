import { describe, it, expect } from "vitest";
import { splitRecursive } from "../../../lib/rag/split-recursive";

describe("splitRecursive", () => {
  it("returns empty array for empty text", () => {
    expect(splitRecursive("", ["\n\n"], 100, 20)).toEqual([]);
  });

  it("returns single chunk for text within chunkSize", () => {
    expect(splitRecursive("hello world", ["\n\n"], 100, 20)).toEqual([
      "hello world",
    ]);
  });

  it("never produces chunks exceeding chunkSize + overlap", () => {
    // A piece larger than chunkSize arriving while current is non-empty goes
    // through the carry branch, which must recurse (not concatenate) —
    // otherwise the carried chunk balloons far beyond the bound.
    const p1 = "b".repeat(50);
    const p2 = "c".repeat(5000);
    const p3 = "d".repeat(5);
    const text = [p1, p2, p3].join("\n");
    const chunks = splitRecursive(text, ["\n"], 100, 20);

    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(120); // chunkSize + overlap
    }
  });

  it("does not accumulate overlap across consecutive oversized pieces", () => {
    // Overlap >= chunkSize makes every carry exceed chunkSize; without a guard
    // each pushed chunk grows by overlap + sep + piece each round.
    const pieces = Array.from({ length: 5 }, (_, i) =>
      String.fromCharCode(97 + i).repeat(90),
    );
    const chunks = splitRecursive(pieces.join("\n"), ["\n"], 100, 100);

    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(200);
    }
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("covers all content across chunks", () => {
    const text = "alpha beta\ngamma delta\n\nepsilon zeta. eta theta";
    const chunks = splitRecursive(text, ["\n\n", "\n", ". ", " ", ""], 15, 4);
    const joined = chunks.join(" ");
    // Separator characters may be dropped at chunk boundaries; every word
    // must survive.
    for (const word of text.split(/\s+/).map((w) => w.replace(/[.]$/, ""))) {
      expect(joined).toContain(word);
    }
  });
});
