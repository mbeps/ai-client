import { describe, expect, it } from "vitest";
import {
  computeStatCounts,
  matchesJobFilter,
  matchesJobTab,
} from "@/components/jobs/jobs-filter";
import type { JobItem } from "@/types/jobs/job";

describe("jobs-filter", () => {
  it("matchesJobTab returns false for unknown tab", () => {
    expect(matchesJobTab("RUNNING", "unknown" as any)).toBe(false);
  });

  it("computeStatCounts ignores statuses not in STATUS_FIELD_MAP", () => {
    const jobs = [
      { id: "1", status: "RUNNING" },
      { id: "2", status: "UNKNOWN_STATUS" },
    ] as unknown as JobItem[];

    const counts = computeStatCounts(jobs);
    expect(counts.running).toBe(1);
    expect(counts.all).toBe(2);
  });

  it("matchesJobFilter filters by tab and search query", () => {
    const job = {
      id: "1",
      status: "COMPLETED",
      title: "Index KB",
      type: "kb",
      functionName: "indexKb",
      subtitle: "Docs",
    } as unknown as JobItem;

    expect(matchesJobFilter(job, "completed", "index")).toBe(true);
    expect(matchesJobFilter(job, "running", "index")).toBe(false);
  });
});
