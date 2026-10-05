import { describe, expect, expectTypeOf, it } from "vitest";
import { ROUTES } from "@/config/routes";
import type { JobItem, JobStatus, JobType, ListJobsResult } from "@/types/jobs";

describe("ROUTES.JOBS", () => {
  it("defines JOBS route with path and name", () => {
    expect(ROUTES.JOBS).toBeDefined();
    expect(ROUTES.JOBS.path).toBe("/jobs");
    expect(ROUTES.JOBS.name).toBe("Running Jobs");
  });
});

describe("Job Types", () => {
  it("exports JobType, JobStatus, JobItem, and ListJobsResult types", () => {
    expectTypeOf<JobType>().toBeString();
    expectTypeOf<JobStatus>().toBeString();

    const sampleJob: JobItem = {
      id: "run-1",
      functionId: "fn-1",
      functionName: "Function One",
      eventName: "event-1",
      type: "kb-ingest",
      title: "Test Ingest",
      status: "RUNNING",
      queuedAt: "2026-09-28T00:00:00.000Z",
      startedAt: "2026-09-28T00:00:01.000Z",
      endedAt: null,
      subtitle: "Sub",
      durationMs: 1200,
      url: "/kb/1",
      errorMessage: undefined,
      entityId: "ent-1",
      entityDeleted: false,
    };
    expect(sampleJob.id).toBe("run-1");

    const sampleResult: ListJobsResult = {
      jobs: [sampleJob],
      offline: false,
      error: undefined,
    };
    expect(sampleResult.jobs).toHaveLength(1);
    expect(sampleResult.offline).toBe(false);
  });
});
