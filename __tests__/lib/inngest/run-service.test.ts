import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
  INNGEST_DEV: "1",
  INNGEST_BASE_URL: "http://127.0.0.1:8288",
  INNGEST_SIGNING_KEY: "local",
  INNGEST_EVENT_KEY: "local",
  NODE_ENV: "development",
}));

vi.mock("@/config/env", () => ({
  env: mockEnv,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe("Inngest Run Service", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.INNGEST_DEV = "1";
    mockEnv.INNGEST_BASE_URL = "http://127.0.0.1:8288";
    mockEnv.INNGEST_SIGNING_KEY = "local";
    mockEnv.NODE_ENV = "development";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("fetchUserInngestRuns", () => {
    it("fetches runs successfully in dev mode via GraphQL with RunsFilterV2 and CEL query", async () => {
      const mockFetch = vi.fn().mockImplementation(async (_url: string, options?: RequestInit) => {
        const body = JSON.parse((options?.body as string) || "{}");

        if (body.query?.includes("runs(")) {
          expect(body.variables.filter.from).toBe("2020-01-01T00:00:00Z");
          expect(body.variables.filter.query).toBe('event.data.userId == "user-123"');
          expect(body.variables.orderBy).toEqual([{ field: "QUEUED_AT", direction: "DESC" }]);

          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                runs: {
                  edges: [
                    {
                      node: {
                        id: "run-001",
                        functionID: "fn-chat-id",
                        function: {
                          name: "generate-chat-response",
                          slug: "ai-client-generate-chat-response",
                        },
                        eventName: "chat/response.generate",
                        queuedAt: "2026-09-28T09:00:00Z",
                        startedAt: "2026-09-28T09:00:01Z",
                        endedAt: "2026-09-28T09:00:10Z",
                        status: "COMPLETED",
                        output: null,
                      },
                    },
                  ],
                },
              },
            }),
          };
        }

        if (body.query?.includes("runTrigger(")) {
          expect(body.variables.runID).toBe("run-001");
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                runTrigger: {
                  eventName: "chat/response.generate",
                  payloads: [
                    JSON.stringify({
                      name: "chat/response.generate",
                      data: {
                        chatId: "chat-xyz",
                        model: "anthropic/claude-3-5-sonnet",
                        userId: "user-123",
                      },
                    }),
                  ],
                },
              },
            }),
          };
        }

        throw new Error(`Unexpected request: ${body.query}`);
      });

      globalThis.fetch = mockFetch;

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.offline).toBeFalsy();
      expect(result.jobs).toHaveLength(1);
      const job = result.jobs[0];
      expect(job.id).toBe("run-001");
      expect(job.type).toBe("chat");
      expect(job.status).toBe("COMPLETED");
      expect(job.entityId).toBe("chat-xyz");
      expect(job.url).toContain("chat-xyz");
      expect(job.durationMs).toBe(9000);
    });

    it("verifies user-scoping and filters out runs not matching userId in application code", async () => {
      const mockFetch = vi.fn().mockImplementation(async (_url: string, options?: RequestInit) => {
        const body = JSON.parse((options?.body as string) || "{}");

        if (body.query?.includes("runs(")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                runs: {
                  edges: [
                    {
                      node: {
                        id: "run-matching",
                        functionID: "fn-1",
                        function: { name: "test-fn", slug: "test-fn" },
                        eventName: "chat/response.generate",
                        queuedAt: "2026-09-28T09:00:00Z",
                        startedAt: null,
                        endedAt: null,
                        status: "QUEUED",
                        output: null,
                      },
                    },
                    {
                      node: {
                        id: "run-mismatch",
                        functionID: "fn-2",
                        function: { name: "other-fn", slug: "other-fn" },
                        eventName: "chat/response.generate",
                        queuedAt: "2026-09-28T09:00:00Z",
                        startedAt: null,
                        endedAt: null,
                        status: "QUEUED",
                        output: null,
                      },
                    },
                  ],
                },
              },
            }),
          };
        }

        if (body.query?.includes("runTrigger(")) {
          const runId = body.variables.runID;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                runTrigger: {
                  eventName: "chat/response.generate",
                  payloads: [
                    JSON.stringify({
                      data: {
                        userId: runId === "run-matching" ? "user-123" : "other-user-999",
                        chatId: runId,
                      },
                    }),
                  ],
                },
              },
            }),
          };
        }

        throw new Error(`Unexpected query: ${body.query}`);
      });

      globalThis.fetch = mockFetch;

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].id).toBe("run-matching");
    });

    it("maps various event names correctly to JobType", async () => {
      const testEvents = [
        { event: "chat/response.generate", expectedType: "chat", idField: "chatId", idVal: "c-1" },
        { event: "workflows/transform.execute", expectedType: "transform", idField: "runId", idVal: "tr-1" },
        { event: "workflows/translate.execute", expectedType: "translation", idField: "translationId", idVal: "tl-1" },
        { event: "knowledgebase/document.ingest", expectedType: "kb-ingest", idField: "documentId", idVal: "doc-1" },
        { event: "knowledgebase/reindex", expectedType: "kb-reindex", idField: "kbId", idVal: "kb-1" },
        { event: "custom/random.event", expectedType: "other", idField: "customId", idVal: "x-1" },
      ];

      const mockFetch = vi.fn().mockImplementation(async (_url: string, options?: RequestInit) => {
        const body = JSON.parse((options?.body as string) || "{}");

        if (body.query?.includes("runs(")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                runs: {
                  edges: testEvents.map((t, idx) => ({
                    node: {
                      id: `run-${idx}`,
                      functionID: `fn-${idx}`,
                      function: { name: `fn-name-${idx}`, slug: `fn-slug-${idx}` },
                      eventName: t.event,
                      queuedAt: "2026-09-28T09:00:00Z",
                      startedAt: "2026-09-28T09:00:01Z",
                      endedAt: null,
                      status: "RUNNING",
                      output: null,
                    },
                  })),
                },
              },
            }),
          };
        }

        if (body.query?.includes("runTrigger(")) {
          const runId = body.variables.runID;
          const idx = parseInt(runId.replace("run-", ""), 10);
          const t = testEvents[idx];

          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                runTrigger: {
                  eventName: t.event,
                  payloads: [
                    JSON.stringify({
                      data: {
                        userId: "user-123",
                        [t.idField]: t.idVal,
                      },
                    }),
                  ],
                },
              },
            }),
          };
        }

        throw new Error(`Unexpected query: ${body.query}`);
      });

      globalThis.fetch = mockFetch;

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.jobs).toHaveLength(testEvents.length);
      testEvents.forEach((t, idx) => {
        expect(result.jobs[idx].type).toBe(t.expectedType);
        if (t.expectedType !== "other") {
          expect(result.jobs[idx].entityId).toBe(t.idVal);
        }
      });
    });

    it("handles offline resilience / network failure without throwing", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("fetch failed: ECONNREFUSED"));

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.jobs).toEqual([]);
      expect(result.offline).toBe(true);
      expect(result.error).toBeDefined();
    });

    it("applies status filtering when options.status is provided", async () => {
      let sentStatus: string[] | undefined;

      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, options?: RequestInit) => {
        const body = JSON.parse((options?.body as string) || "{}");
        if (body.query?.includes("runs(")) {
          sentStatus = body.variables.filter.status;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                runs: {
                  edges: [],
                },
              },
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ data: {} }) };
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      await fetchUserInngestRuns("user-123", { status: ["RUNNING", "QUEUED"] });

      expect(sentStatus).toEqual(["RUNNING", "QUEUED"]);
    });

    it("fetches runs in production mode using Inngest REST API v1", async () => {
      mockEnv.INNGEST_DEV = "false";
      mockEnv.INNGEST_SIGNING_KEY = "signkey-prod-123";
      mockEnv.NODE_ENV = "production";

      let capturedUrl = "";
      let capturedAuthHeader: string | null = null;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        capturedUrl = url.toString();
        capturedAuthHeader = (init?.headers as Record<string, string>)?.["Authorization"] || null;

        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                id: "prod-run-1",
                function_id: "prod-fn-id",
                function_name: "generate-chat-response",
                event_name: "chat/response.generate",
                status: "RUNNING",
                queued_at: "2026-09-28T09:00:00Z",
                started_at: "2026-09-28T09:00:02Z",
                ended_at: null,
                trigger: {
                  name: "chat/response.generate",
                  data: {
                    userId: "user-123",
                    chatId: "prod-chat-999",
                  },
                },
              },
            ],
          }),
        };
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(capturedUrl).toContain("https://api.inngest.com/v1/runs");
      expect(capturedUrl).toContain("event.data.userId");
      expect(capturedAuthHeader).toBe("Bearer signkey-prod-123");
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].id).toBe("prod-run-1");
      expect(result.jobs[0].type).toBe("chat");
      expect(result.jobs[0].entityId).toBe("prod-chat-999");
    });
  });

  describe("cancelInngestRun", () => {
    it("cancels run successfully in dev mode via GraphQL cancelRun mutation", async () => {
      let capturedBody: any = null;

      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        capturedBody = JSON.parse((init?.body as string) || "{}");
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              cancelRun: {
                id: "run-cancel-123",
                status: "CANCELLED",
              },
            },
          }),
        };
      });

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-cancel-123", "user-123");

      expect(capturedBody.query).toContain("cancelRun");
      expect(capturedBody.variables.runID).toBe("run-cancel-123");
      expect(res.success).toBe(true);
    });

    it("gracefully handles already completed or cancelled runs returning success: true", async () => {
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: null,
            errors: [
              {
                message: "cannot cancel an ended run",
                path: ["cancelRun"],
              },
            ],
          }),
        };
      });

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-ended-123", "user-123");

      expect(res.success).toBe(true);
    });

    it("handles offline network failure returning success: false with error", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network connection refused"));

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-fail-123", "user-123");

      expect(res.success).toBe(false);
      expect(res.error).toContain("Network connection refused");
    });

    it("cancels run in production mode via REST API", async () => {
      mockEnv.INNGEST_DEV = "false";
      mockEnv.INNGEST_SIGNING_KEY = "signkey-prod-123";
      mockEnv.NODE_ENV = "production";

      let capturedUrl = "";
      let capturedMethod = "";
      let capturedAuth: string | null = null;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        capturedUrl = url.toString();
        capturedMethod = init?.method || "GET";
        capturedAuth = (init?.headers as Record<string, string>)?.["Authorization"] || null;

        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        };
      });

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("prod-run-cancel", "user-123");

      expect(capturedUrl).toBe("https://api.inngest.com/v1/runs/prod-run-cancel/cancel");
      expect(capturedMethod).toBe("POST");
      expect(capturedAuth).toBe("Bearer signkey-prod-123");
      expect(res.success).toBe(true);
    });

    it("gracefully handles already completed run in production mode (409 Conflict)", async () => {
      mockEnv.INNGEST_DEV = "false";
      mockEnv.INNGEST_SIGNING_KEY = "signkey-prod-123";
      mockEnv.NODE_ENV = "production";

      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return {
          ok: false,
          status: 409,
          text: async () => JSON.stringify({ message: "cannot cancel an ended run" }),
        };
      });

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("prod-run-ended", "user-123");

      expect(res.success).toBe(true);
    });
  });
});
