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

const mockLog = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: mockLog,
  getLogger: () => mockLog,
}));

type RunNode = Record<string, any>;

/** A complete dev-mode run node; override only the fields under test. */
function devNode(overrides: RunNode = {}): RunNode {
  return {
    id: "run-x",
    functionID: "fn-x",
    function: { name: "fn-name-x", slug: "fn-slug-x" },
    eventName: "chat/response.generate",
    queuedAt: "2026-09-28T09:00:00Z",
    startedAt: null,
    endedAt: null,
    status: "COMPLETED",
    output: null,
    ...overrides,
  };
}

/** Build a successful runTrigger response around the supplied value. */
function triggerJson(runTrigger: unknown) {
  return { ok: true, status: 200, json: async () => ({ data: { runTrigger } }) };
}

/**
 * Mock fetch for the dev GraphQL endpoint. `triggerFor` receives the run id and
 * may return a response object, a rejected promise, or any other value.
 */
function devFetch(nodes: RunNode[], triggerFor: (runId: string) => unknown) {
  return vi.fn().mockImplementation(async (_url: string, options?: RequestInit) => {
    const body = JSON.parse((options?.body as string) || "{}");
    if (body.query?.includes("runs(")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: { runs: { edges: nodes.map((node) => ({ node })) } },
        }),
      };
    }
    if (body.query?.includes("runTrigger(")) {
      return triggerFor(body.variables.runID);
    }
    throw new Error(`Unexpected query: ${body.query}`);
  });
}

/** Put the service into production REST mode. */
function useProdMode() {
  mockEnv.INNGEST_DEV = "false";
  mockEnv.INNGEST_SIGNING_KEY = "signkey-prod-123";
  mockEnv.NODE_ENV = "production";
}

/** Put the service into dev GraphQL mode. */
function useDevMode() {
  mockEnv.INNGEST_DEV = "1";
  mockEnv.INNGEST_BASE_URL = "http://127.0.0.1:8288";
  mockEnv.INNGEST_SIGNING_KEY = "local";
  mockEnv.NODE_ENV = "development";
}

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

  describe("parseTriggerPayloadData", () => {
    /** Drive parseTriggerPayloadData through fetchUserInngestRuns via a single run. */
    async function payloadOf(payloads: unknown, runOverrides: RunNode = {}) {
      globalThis.fetch = devFetch([devNode(runOverrides)], () =>
        triggerJson({ eventName: "chat/response.generate", payloads }),
      );
      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");
      return result.jobs[0];
    }

    it("returns undefined when payloads is missing entirely", async () => {
      const job = await payloadOf(undefined);
      expect(job.entityId).toBeUndefined();
    });

    it("returns undefined when payloads is an empty array", async () => {
      const job = await payloadOf([]);
      expect(job.entityId).toBeUndefined();
    });

    it("unwraps the data property of a JSON string payload", async () => {
      const job = await payloadOf([
        JSON.stringify({ data: { chatId: "chat-in-data", userId: "user-123" } }),
      ]);
      expect(job.entityId).toBe("chat-in-data");
    });

    it("uses the parsed object directly when the payload has no data property", async () => {
      const job = await payloadOf([
        JSON.stringify({ chatId: "chat-bare", userId: "user-123" }),
      ]);
      expect(job.entityId).toBe("chat-bare");
    });

    it("returns undefined when the payload string is not valid JSON", async () => {
      const job = await payloadOf(["{not valid json"]);
      expect(job.entityId).toBeUndefined();
    });

    it("accepts a payload that is already an object", async () => {
      const job = await payloadOf([
        { data: { chatId: "chat-obj", userId: "user-123" } },
      ]);
      expect(job.entityId).toBe("chat-obj");
    });

    it("accepts a payload object that has no data property", async () => {
      const job = await payloadOf([{ chatId: "chat-obj-bare", userId: "user-123" }]);
      expect(job.entityId).toBe("chat-obj-bare");
    });

    it("returns undefined when the first payload is neither string nor object", async () => {
      const job = await payloadOf([42]);
      expect(job.entityId).toBeUndefined();
    });

    it("returns undefined when the first payload is null", async () => {
      const job = await payloadOf([null]);
      expect(job.entityId).toBeUndefined();
    });
  });

  describe("resolveJobMetadata", () => {
    /** Drive resolveJobMetadata for a given event via a single dev-mode run. */
    async function metaOf(
      eventName: string,
      data: Record<string, unknown> | undefined,
      runOverrides: RunNode = {},
    ) {
      globalThis.fetch = devFetch(
        [devNode({ id: "run-meta", eventName, ...runOverrides })],
        () =>
          triggerJson({
            eventName,
            payloads: data === undefined ? undefined : [JSON.stringify({ data })],
          }),
      );
      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");
      return result.jobs[0];
    }

    it("falls back to the event name when the function name is empty", async () => {
      const job = await metaOf("some/unmapped.event", undefined, {
        function: { name: "", slug: "" },
        functionID: "",
      });
      expect(job.functionName).toBe("");
      expect(job.title).toBe("some/unmapped.event");
      expect(job.functionId).toBe("");
    });

    it("falls back to 'Background Job' when function name and event name are both empty", async () => {
      const job = await metaOf("", undefined, {
        function: { name: "", slug: "" },
        functionID: "",
      });
      expect(job.title).toBe("Background Job");
      expect(job.eventName).toBe("");
    });

    it("omits the chat URL when there is no chatId", async () => {
      const job = await metaOf("chat/response.generate", {
        userId: "user-123",
        model: "gpt-5",
      });
      expect(job.subtitle).toBe("Model: gpt-5");
      expect(job.url).toBeUndefined();
    });

    it("uses agentName as the transform subtitle", async () => {
      const job = await metaOf("workflows/transform.execute", {
        userId: "user-123",
        runId: "tr-9",
        agentName: "My Agent",
        agentId: "agent-9",
      });
      expect(job.subtitle).toBe("My Agent");
      expect(job.url).toBe("/workflows/transform/agent-9/tr-9");
    });

    it("falls back to the runId query URL when agentId is absent", async () => {
      const job = await metaOf("workflows/transform.execute", {
        userId: "user-123",
        runId: "tr-10",
      });
      expect(job.url).toBe("/workflows/transform?runId=tr-10");
      expect(job.subtitle).toBeUndefined();
    });

    it("falls back to the bare transform URL when there is no entity id", async () => {
      const job = await metaOf("workflows/transform.execute", {
        userId: "user-123",
        agentId: "agent-10",
      });
      expect(job.url).toBe("/workflows/transform");
    });

    it("builds the translation subtitle from both language fields", async () => {
      const job = await metaOf("workflows/translate.execute", {
        userId: "user-123",
        translationId: "tl-9",
        sourceLanguage: "English",
        targetLanguage: "French",
      });
      expect(job.subtitle).toBe("English → French");
      expect(job.url).toBe("/workflows/translation");
    });

    it("omits the translation subtitle when targetLanguage is absent", async () => {
      const job = await metaOf("workflows/translate.execute", {
        userId: "user-123",
        translationId: "tl-10",
        sourceLanguage: "English",
      });
      expect(job.subtitle).toBeUndefined();
    });

    it("omits the translation subtitle when sourceLanguage is absent", async () => {
      const job = await metaOf("workflows/translate.execute", {
        userId: "user-123",
        translationId: "tl-11",
        targetLanguage: "German",
      });
      expect(job.subtitle).toBeUndefined();
    });

    it("uses documentName as the ingest subtitle", async () => {
      const job = await metaOf("knowledgebase/document.ingest", {
        userId: "user-123",
        documentId: "doc-9",
        documentName: "report.pdf",
      });
      expect(job.subtitle).toBe("report.pdf");
      expect(job.url).toBe("/knowledgebases");
    });

    it("falls back to 'Document <id>' when documentName is absent", async () => {
      const job = await metaOf("knowledgebase/document.ingest", {
        userId: "user-123",
        documentId: "doc-10",
      });
      expect(job.subtitle).toBe("Document doc-10");
    });

    it("omits the ingest subtitle when neither documentName nor documentId exist", async () => {
      const job = await metaOf("knowledgebase/document.ingest", {
        userId: "user-123",
      });
      expect(job.subtitle).toBeUndefined();
      expect(job.url).toBe("/knowledgebases");
    });

    it("uses kbTitle as the reindex subtitle", async () => {
      const job = await metaOf("knowledgebase/reindex", {
        userId: "user-123",
        kbId: "kb-9",
        kbTitle: "Handbook",
      });
      expect(job.subtitle).toBe("Handbook");
      expect(job.url).toBe("/knowledgebases/kb-9");
    });

    it("falls back to 'KB <id>' when kbTitle is absent", async () => {
      const job = await metaOf("knowledgebase/reindex", {
        userId: "user-123",
        kbId: "kb-10",
      });
      expect(job.subtitle).toBe("KB kb-10");
      expect(job.url).toBe("/knowledgebases/kb-10");
    });

    it("falls back to the bare knowledgebases URL when there is no kb id", async () => {
      const job = await metaOf("knowledgebase/reindex", { userId: "user-123" });
      expect(job.subtitle).toBeUndefined();
      expect(job.url).toBe("/knowledgebases");
    });

    it("prefers chatId over the other entity id fields", async () => {
      const job = await metaOf("chat/response.generate", {
        userId: "user-123",
        chatId: "c-1",
        runId: "r-1",
        translationId: "t-1",
        documentId: "d-1",
        kbId: "k-1",
      });
      expect(job.entityId).toBe("c-1");
    });

    it("prefers runId over translationId", async () => {
      const job = await metaOf("workflows/transform.execute", {
        userId: "user-123",
        runId: "r-1",
        translationId: "t-1",
        documentId: "d-1",
        kbId: "k-1",
      });
      expect(job.entityId).toBe("r-1");
    });

    it("prefers translationId over documentId", async () => {
      const job = await metaOf("workflows/translate.execute", {
        userId: "user-123",
        translationId: "t-1",
        documentId: "d-1",
        kbId: "k-1",
      });
      expect(job.entityId).toBe("t-1");
    });

    it("prefers documentId over kbId", async () => {
      const job = await metaOf("knowledgebase/document.ingest", {
        userId: "user-123",
        documentId: "d-1",
        kbId: "k-1",
      });
      expect(job.entityId).toBe("d-1");
    });

    it("coerces a numeric entity id to a string", async () => {
      const job = await metaOf("knowledgebase/reindex", {
        userId: "user-123",
        kbId: 42,
      });
      expect(job.entityId).toBe("42");
      expect(job.url).toBe("/knowledgebases/42");
    });
  });

  describe("extractErrorMessage", () => {
    /** Drive extractErrorMessage through a FAILED run with the given output. */
    async function errorOf(output: unknown) {
      globalThis.fetch = devFetch(
        [devNode({ id: "run-err", status: "FAILED", output })],
        () => triggerJson({ eventName: "chat/response.generate", payloads: [] }),
      );
      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");
      return result.jobs[0].errorMessage;
    }

    it("returns undefined for a non-FAILED status", async () => {
      globalThis.fetch = devFetch(
        [devNode({ status: "COMPLETED", output: { error: "ignored" } })],
        () => triggerJson({ eventName: "chat/response.generate", payloads: [] }),
      );
      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");
      expect(result.jobs[0].errorMessage).toBeUndefined();
    });

    it("uses the default message when output is null", async () => {
      expect(await errorOf(null)).toBe("Job execution failed");
    });

    it("uses the default message when output is an empty string", async () => {
      expect(await errorOf("")).toBe("Job execution failed");
    });

    it("uses the default message when output is zero", async () => {
      expect(await errorOf(0)).toBe("Job execution failed");
    });

    it("returns a string output verbatim", async () => {
      expect(await errorOf("model timed out")).toBe("model timed out");
    });

    it("returns a string error property from an object output", async () => {
      expect(await errorOf({ error: "boom from error string" })).toBe(
        "boom from error string",
      );
    });

    it("returns error.message when the error is an Error-like object", async () => {
      expect(await errorOf({ error: { message: "nested failure" } })).toBe(
        "nested failure",
      );
    });

    it("stringifies the error property when it has no message", async () => {
      expect(await errorOf({ error: { code: "E_NOPE" } })).toBe(
        JSON.stringify({ code: "E_NOPE" }),
      );
    });

    it("stringifies a non-object, non-string error property", async () => {
      expect(await errorOf({ error: 123 })).toBe("123");
    });

    it("returns the message property when no error property is present", async () => {
      expect(await errorOf({ message: 9876 })).toBe("9876");
    });

    it("uses the default message for an object with neither error nor message", async () => {
      expect(await errorOf({ unrelated: true })).toBe("Job execution failed");
    });

    it("uses the default message for an empty object output", async () => {
      expect(await errorOf({})).toBe("Job execution failed");
    });

    it("uses the default message for a boolean output", async () => {
      expect(await errorOf(false)).toBe("Job execution failed");
    });

    it("uses the default message for a number output", async () => {
      expect(await errorOf(7)).toBe("Job execution failed");
    });

    it("uses the default message for an array output", async () => {
      expect(await errorOf(["a"])).toBe("Job execution failed");
    });
  });

  describe("computeDurationMs", () => {
    it("returns undefined when the run has not started", async () => {
      globalThis.fetch = devFetch(
        [devNode({ startedAt: null, endedAt: "2026-09-28T09:00:10Z" })],
        () => triggerJson({ eventName: "chat/response.generate", payloads: [] }),
      );
      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");
      expect(result.jobs[0].durationMs).toBeUndefined();
    });

    it("returns the elapsed time so far when the run has not ended", async () => {
      globalThis.fetch = devFetch(
        [devNode({ startedAt: "2026-09-28T09:00:00Z", endedAt: null })],
        () => triggerJson({ eventName: "chat/response.generate", payloads: [] }),
      );
      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");
      expect(result.jobs[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it("clamps a negative duration to zero when the end precedes the start", async () => {
      globalThis.fetch = devFetch(
        [
          devNode({
            startedAt: "2026-09-28T09:00:10Z",
            endedAt: "2026-09-28T09:00:00Z",
          }),
        ],
        () => triggerJson({ eventName: "chat/response.generate", payloads: [] }),
      );
      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");
      expect(result.jobs[0].durationMs).toBe(0);
    });
  });

  describe("fetchDevUserRuns error handling", () => {
    it("returns a GraphQL error when the runs query responds non-ok", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.jobs).toEqual([]);
      expect(result.error).toBe("GraphQL request failed with HTTP 503");
    });

    it("returns no jobs when the runs payload has no edges array", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: {} }),
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.jobs).toEqual([]);
      expect(result.error).toBeUndefined();
    });

    it("falls back to the node event name when the trigger has none", async () => {
      globalThis.fetch = devFetch([devNode({ id: "run-no-trigger-name" })], () =>
        triggerJson({ payloads: [] }),
      );

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.jobs[0].eventName).toBe("chat/response.generate");
    });

    it("falls back to the functionID when the node has no function object", async () => {
      globalThis.fetch = devFetch(
        [devNode({ id: "run-no-fn", function: undefined, functionID: "fn-only" })],
        () => triggerJson({ eventName: "chat/response.generate", payloads: [] }),
      );

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.jobs[0].functionName).toBe("fn-only");
      expect(result.jobs[0].functionId).toBe("fn-only");
    });

    it("returns empty strings when neither a function object nor a functionID exist", async () => {
      globalThis.fetch = devFetch(
        [devNode({ id: "run-no-fn-at-all", function: undefined, functionID: undefined })],
        () => triggerJson({ eventName: "chat/response.generate", payloads: [] }),
      );

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.jobs[0].functionName).toBe("");
      expect(result.jobs[0].functionId).toBe("");
    });

    it("returns null from the trigger fetch when the response is not ok", async () => {
      globalThis.fetch = devFetch([devNode({ id: "run-trigger-500" })], () => ({
        ok: false,
        status: 500,
        json: async () => ({}),
      }));

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].id).toBe("run-trigger-500");
    });

    it("returns null from the trigger fetch when data is missing", async () => {
      globalThis.fetch = devFetch([devNode({ id: "run-trigger-nodata" })], () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: {} }),
      }));

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.jobs[0].eventName).toBe("chat/response.generate");
    });

    it("logs and swallows an Error thrown by the trigger fetch", async () => {
      globalThis.fetch = devFetch([devNode({ id: "run-trigger-throw" })], () => {
        throw new Error("trigger blew up");
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.jobs).toHaveLength(1);
      expect(mockLog.debug).toHaveBeenCalledWith(
        "Failed to fetch run trigger for run {runId}: {error}",
        expect.objectContaining({ runId: "run-trigger-throw", error: "trigger blew up" }),
      );
    });

    it("stringifies a non-Error rejection from the trigger fetch", async () => {
      globalThis.fetch = devFetch([devNode({ id: "run-trigger-nonerror" })], () =>
        Promise.reject("plain string failure"),
      );

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.jobs).toHaveLength(1);
      expect(mockLog.debug).toHaveBeenCalledWith(
        "Failed to fetch run trigger for run {runId}: {error}",
        expect.objectContaining({ error: "plain string failure" }),
      );
    });
  });

  describe("fetchProdUserRuns error handling", () => {
    it("returns an error when the production request responds non-ok", async () => {
      useProdMode();
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.jobs).toEqual([]);
      expect(result.error).toBe("Inngest API request failed with HTTP 500");
    });

    it("returns no jobs when data is not an array", async () => {
      useProdMode();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { unexpected: true } }),
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.jobs).toEqual([]);
    });

    it("appends each status filter to the query string", async () => {
      useProdMode();
      let capturedUrl = "";
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        capturedUrl = url.toString();
        return { ok: true, status: 200, json: async () => ({ data: [] }) };
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      await fetchUserInngestRuns("user-123", { status: ["FAILED", "RUNNING"] });

      expect(capturedUrl).toContain("status=FAILED");
      expect(capturedUrl).toContain("status=RUNNING");
    });

    it("ignores an empty status array", async () => {
      useProdMode();
      let capturedUrl = "";
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        capturedUrl = url.toString();
        return { ok: true, status: 200, json: async () => ({ data: [] }) };
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      await fetchUserInngestRuns("user-123", { status: [] });

      expect(capturedUrl).not.toContain("status=");
    });

    it("passes a custom limit through to the query string", async () => {
      useProdMode();
      let capturedUrl = "";
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        capturedUrl = url.toString();
        return { ok: true, status: 200, json: async () => ({ data: [] }) };
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      await fetchUserInngestRuns("user-123", { limit: 5 });

      expect(capturedUrl).toContain("limit=5");
    });

    /** Run a single production run through the mapper and return the job. */
    async function prodJob(run: Record<string, unknown>) {
      useProdMode();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [run] }),
      });
      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");
      return result.jobs[0];
    }

    it("reads payload data from run.event.data", async () => {
      const job = await prodJob({
        id: "p-1",
        function_id: "f-1",
        function_name: "fn",
        event_name: "chat/response.generate",
        status: "COMPLETED",
        event: { data: { userId: "user-123", chatId: "c-event" } },
      });
      expect(job.entityId).toBe("c-event");
    });

    it("reads payload data from run.data", async () => {
      const job = await prodJob({
        id: "p-2",
        function_id: "f-2",
        function_name: "fn",
        event_name: "chat/response.generate",
        status: "COMPLETED",
        data: { userId: "user-123", chatId: "c-flat" },
      });
      expect(job.entityId).toBe("c-flat");
    });

    it("treats a run with no payload data at all as belonging to the user", async () => {
      const job = await prodJob({
        id: "p-3",
        function_id: "f-3",
        function_name: "fn",
        event_name: "chat/response.generate",
        status: "COMPLETED",
      });
      expect(job).toBeDefined();
      expect(job.entityId).toBeUndefined();
    });

    it("filters out a production run belonging to another user", async () => {
      useProdMode();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: "p-other",
              function_id: "f",
              function_name: "fn",
              event_name: "chat/response.generate",
              status: "COMPLETED",
              trigger: { data: { userId: "somebody-else" } },
            },
          ],
        }),
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.jobs).toEqual([]);
    });

    it("reads the event name from run.eventName", async () => {
      const job = await prodJob({
        id: "p-4",
        function_id: "f-4",
        functionName: "fn",
        eventName: "chat/response.generate",
        status: "COMPLETED",
        trigger: { name: "ignored", data: { userId: "user-123", chatId: "c-4" } },
      });
      expect(job.eventName).toBe("chat/response.generate");
    });

    it("reads the event name from run.trigger.name as a last resort", async () => {
      const job = await prodJob({
        id: "p-5",
        function_id: "f-5",
        function_name: "fn",
        status: "COMPLETED",
        trigger: { name: "chat/response.generate", data: { userId: "user-123", chatId: "c-5" } },
      });
      expect(job.eventName).toBe("chat/response.generate");
    });

    it("yields an empty event name when no event field is present", async () => {
      const job = await prodJob({
        id: "p-6",
        function_id: "f-6",
        function_name: "fn",
        status: "COMPLETED",
      });
      expect(job.eventName).toBe("");
      expect(job.type).toBe("other");
    });

    it("reads the function name from run.functionName", async () => {
      const job = await prodJob({
        id: "p-7",
        function_id: "f-7",
        functionName: "camel-fn",
        event_name: "chat/response.generate",
        status: "COMPLETED",
        trigger: { data: { userId: "user-123" } },
      });
      expect(job.functionName).toBe("camel-fn");
    });

    it("falls back to the function id when no function name exists", async () => {
      const job = await prodJob({
        id: "p-8",
        function_id: "f-8",
        event_name: "chat/response.generate",
        status: "COMPLETED",
        trigger: { data: { userId: "user-123" } },
      });
      expect(job.functionName).toBe("f-8");
      expect(job.functionId).toBe("f-8");
    });

    it("yields empty function identifiers when neither exists", async () => {
      const job = await prodJob({
        id: "p-9",
        event_name: "chat/response.generate",
        status: "COMPLETED",
        trigger: { data: { userId: "user-123" } },
      });
      expect(job.functionName).toBe("");
      expect(job.functionId).toBe("");
    });

    it("defaults the status to QUEUED when the run has none", async () => {
      const job = await prodJob({
        id: "p-10",
        function_id: "f-10",
        event_name: "chat/response.generate",
        trigger: { data: { userId: "user-123" } },
      });
      expect(job.status).toBe("QUEUED");
    });

    it("falls back to a generated queuedAt when the run has no timestamps", async () => {
      const before = Date.now();
      const job = await prodJob({
        id: "p-11",
        function_id: "f-11",
        event_name: "chat/response.generate",
        status: "COMPLETED",
        trigger: { data: { userId: "user-123" } },
      });
      expect(job.queuedAt).toBeTruthy();
      expect(new Date(job.queuedAt as string).getTime()).toBeGreaterThanOrEqual(
        before - 1000,
      );
      expect(job.startedAt).toBeNull();
      expect(job.endedAt).toBeNull();
      expect(job.durationMs).toBeUndefined();
    });

    it("uses the camelCase queued_at and started_at fields", async () => {
      const job = await prodJob({
        id: "p-12",
        function_id: "f-12",
        event_name: "chat/response.generate",
        status: "COMPLETED",
        queuedAt: "2026-09-28T09:00:00Z",
        startedAt: "2026-09-28T09:00:01Z",
        endedAt: "2026-09-28T09:00:05Z",
        trigger: { data: { userId: "user-123" } },
      });
      expect(job.queuedAt).toBe("2026-09-28T09:00:00Z");
      expect(job.durationMs).toBe(4000);
    });

    it("reads the error message from the run error field when output is absent", async () => {
      const job = await prodJob({
        id: "p-13",
        function_id: "f-13",
        event_name: "chat/response.generate",
        status: "FAILED",
        error: "prod failure text",
        trigger: { data: { userId: "user-123" } },
      });
      expect(job.errorMessage).toBe("prod failure text");
    });
  });

  describe("isDevMode", () => {
    it("uses dev mode when INNGEST_DEV is the string 'true'", async () => {
      mockEnv.INNGEST_DEV = "true";
      mockEnv.NODE_ENV = "production";
      mockEnv.INNGEST_SIGNING_KEY = "signkey-prod-123";

      let hitDevEndpoint = false;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("127.0.0.1:8288")) hitDevEndpoint = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { runs: { edges: [] } } }),
        };
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      await fetchUserInngestRuns("user-123");

      expect(hitDevEndpoint).toBe(true);
    });

    it("uses dev mode when the signing key is the literal 'local'", async () => {
      mockEnv.INNGEST_DEV = "0";
      mockEnv.NODE_ENV = "production";
      mockEnv.INNGEST_SIGNING_KEY = "local";

      let hitDevEndpoint = false;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("127.0.0.1:8288")) hitDevEndpoint = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { runs: { edges: [] } } }),
        };
      });

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-1", "user-123");

      expect(hitDevEndpoint).toBe(true);
      expect(res.success).toBe(true);
    });

    it("uses dev mode when no signing key is configured", async () => {
      mockEnv.INNGEST_DEV = "0";
      mockEnv.NODE_ENV = "production";
      mockEnv.INNGEST_SIGNING_KEY = "";

      let hitDevEndpoint = false;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("127.0.0.1:8288")) hitDevEndpoint = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { runs: { edges: [] } } }),
        };
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      await fetchUserInngestRuns("user-123");

      expect(hitDevEndpoint).toBe(true);
    });

    it("uses dev mode when NODE_ENV is not production", async () => {
      mockEnv.INNGEST_DEV = "0";
      mockEnv.NODE_ENV = "test";
      mockEnv.INNGEST_SIGNING_KEY = "signkey-prod-123";

      let hitDevEndpoint = false;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("127.0.0.1:8288")) hitDevEndpoint = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { runs: { edges: [] } } }),
        };
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      await fetchUserInngestRuns("user-123");

      expect(hitDevEndpoint).toBe(true);
    });
  });

  describe("default base URL fallback", () => {
    it("falls back to the default dev port when INNGEST_BASE_URL is empty", async () => {
      mockEnv.INNGEST_DEV = "1";
      mockEnv.NODE_ENV = "development";
      mockEnv.INNGEST_BASE_URL = "";

      let capturedUrl = "";
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        capturedUrl = url.toString();
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { runs: { edges: [] } } }),
        };
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      await fetchUserInngestRuns("user-123");

      expect(capturedUrl).toBe("http://127.0.0.1:8288/v0/gql");
    });

    it("falls back to the default dev port when cancelling", async () => {
      mockEnv.INNGEST_DEV = "1";
      mockEnv.NODE_ENV = "development";
      mockEnv.INNGEST_BASE_URL = "";

      let capturedUrl = "";
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        capturedUrl = url.toString();
        return { ok: true, status: 200, json: async () => ({ data: {} }) };
      });

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      await cancelInngestRun("run-1", "user-123");

      expect(capturedUrl).toBe("http://127.0.0.1:8288/v0/gql");
    });
  });

  describe("fetchUserInngestRuns offline resilience", () => {
    it("returns the offline flag and message for a non-Error rejection", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue("string rejection reason");

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.jobs).toEqual([]);
      expect(result.offline).toBe(true);
      expect(result.error).toBe("string rejection reason");
      expect(mockLog.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ error: "string rejection reason", userId: "user-123" }),
      );
    });

    it("returns the offline flag for an object rejection", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue({ reason: "object rejection" });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.offline).toBe(true);
      expect(result.error).toBe("[object Object]");
    });
  });

  describe("cancelInngestRun error handling", () => {
    it("returns a failure when the dev cancellation responds non-ok", async () => {
      useDevMode();
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 502 });

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-1", "user-123");

      expect(res.success).toBe(false);
      expect(res.error).toBe("Cancel request failed with HTTP 502");
    });

    it("returns the first GraphQL error message when it is not an already-ended error", async () => {
      useDevMode();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: null, errors: [{ message: "run is locked" }] }),
      });

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-1", "user-123");

      expect(res.success).toBe(false);
      expect(res.error).toBe("run is locked");
    });

    it("falls back to an empty message when the GraphQL error has none", async () => {
      useDevMode();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: null, errors: [{}] }),
      });

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-1", "user-123");

      expect(res.success).toBe(false);
      expect(res.error).toBe("");
    });

    it("treats each already-ended phrase as success in dev mode", async () => {
      useDevMode();
      const phrases = [
        "Cannot cancel an ended run",
        "This run has already completed",
        "The run has already ended",
        "The run was already cancelled",
        "The run is not running",
        "The run is not active",
      ];

      for (const phrase of phrases) {
        globalThis.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ data: null, errors: [{ message: phrase }] }),
        });

        const { cancelInngestRun } = await import("@/lib/inngest/run-service");
        const res = await cancelInngestRun("run-1", "user-123");

        expect(res.success).toBe(true);
      }
    });

    it("returns the response text for a production failure with no body", async () => {
      useProdMode();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "",
      });

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-1", "user-123");

      expect(res.success).toBe(false);
      expect(res.error).toBe("Failed with status 500");
    });

    it("returns the response text for an unrelated production failure", async () => {
      useProdMode();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        text: async () => "invalid run identifier",
      });

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-1", "user-123");

      expect(res.success).toBe(false);
      expect(res.error).toBe("invalid run identifier");
    });

    it("returns success for a production error body that mentions an ended run", async () => {
      useProdMode();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "the run is not active any more",
      });

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-1", "user-123");

      expect(res.success).toBe(true);
    });

    it("stringifies a non-Error rejection", async () => {
      useProdMode();
      globalThis.fetch = vi.fn().mockRejectedValue("prod string rejection");

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-9", "user-123");

      expect(res.success).toBe(false);
      expect(res.error).toBe("prod string rejection");
      expect(mockLog.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          error: "prod string rejection",
          runId: "run-9",
          userId: "user-123",
        }),
      );
    });
  });
});
