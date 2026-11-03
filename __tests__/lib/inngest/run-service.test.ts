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

function useDevMode() {
  mockEnv.INNGEST_DEV = "1";
  mockEnv.INNGEST_BASE_URL = "http://127.0.0.1:8288";
  mockEnv.INNGEST_SIGNING_KEY = "local";
  mockEnv.INNGEST_EVENT_KEY = "local";
  mockEnv.NODE_ENV = "development";
}

function useProdMode() {
  mockEnv.INNGEST_DEV = "false";
  mockEnv.INNGEST_BASE_URL = "";
  mockEnv.INNGEST_SIGNING_KEY = "signkey-prod-123";
  mockEnv.INNGEST_EVENT_KEY = "eventkey-prod-123";
  mockEnv.NODE_ENV = "production";
}

describe("Inngest Run Service (Unified REST v2)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    useDevMode();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("fetchUserInngestRuns", () => {
    it("fetches runs successfully in dev mode via REST v2 with CEL query", async () => {
      let capturedUrl = "";
      let capturedHeaders: Record<string, string> | undefined;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        capturedUrl = url.toString();
        capturedHeaders = init?.headers as Record<string, string>;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                id: "run-1",
                function: { id: "fn-1", name: "Generate Chat", slug: "generate-chat" },
                trigger: {
                  eventName: "chat/response.generate",
                  data: { userId: "user-123", chatId: "chat-99" },
                },
                status: "COMPLETED",
                queuedAt: "2026-09-28T09:00:00Z",
                startedAt: "2026-09-28T09:00:01Z",
                endedAt: "2026-09-28T09:00:05Z",
              },
            ],
          }),
        };
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(capturedUrl).toContain("http://127.0.0.1:8288/v2/runs");
      expect(capturedUrl).toContain("query=event.data.userId+%3D%3D+%22user-123%22");
      expect(capturedUrl).toContain("limit=20");
      expect(capturedUrl).toContain("include=output");
      expect(capturedHeaders?.Authorization).toBeUndefined();

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].id).toBe("run-1");
      expect(result.jobs[0].type).toBe("chat");
      expect(result.jobs[0].entityId).toBe("chat-99");
      expect(result.jobs[0].durationMs).toBe(4000);
    });

    it("fetches runs in production mode using Inngest Cloud REST API v2 with auth header", async () => {
      useProdMode();
      let capturedUrl = "";
      let capturedAuthHeader: string | undefined;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        capturedUrl = url.toString();
        capturedAuthHeader = (init?.headers as Record<string, string>)?.Authorization;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                id: "prod-run-1",
                status: "COMPLETED",
                queued_at: "2026-03-30T10:00:00Z",
                trigger: {
                  eventName: "chat/response.generate",
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

      expect(capturedUrl).toContain("https://api.inngest.com/v2/runs");
      expect(capturedUrl).toContain("query=event.data.userId+%3D%3D+%22user-123%22");
      expect(capturedAuthHeader).toBe("Bearer signkey-prod-123");
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].id).toBe("prod-run-1");
      expect(result.jobs[0].type).toBe("chat");
      expect(result.jobs[0].entityId).toBe("prod-chat-999");
    });

    it("fetches event payload from /v1/events/{id} when inline trigger data is absent", async () => {
      let eventFetched = false;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        const urlStr = url.toString();
        if (urlStr.includes("/v2/runs")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                {
                  id: "run-with-event-id",
                  function: { id: "fn-transform", name: "Transform Agent", slug: "transform-agent" },
                  trigger: {
                    eventIds: ["event-abc-123"],
                  },
                  status: "RUNNING",
                  queuedAt: "2026-10-01T12:00:00Z",
                },
              ],
            }),
          };
        }
        if (urlStr.includes("/v1/events/event-abc-123")) {
          eventFetched = true;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                name: "workflows/transform.execute",
                data: {
                  userId: "user-123",
                  runId: "tr-777",
                  agentName: "Analyzer",
                },
              },
            }),
          };
        }
        throw new Error(`Unexpected URL: ${urlStr}`);
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(eventFetched).toBe(true);
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].type).toBe("transform");
      expect(result.jobs[0].entityId).toBe("tr-777");
      expect(result.jobs[0].subtitle).toBe("Analyzer");
    });

    it("deduplicates event fetch promises when multiple runs share the same eventId", async () => {
      let eventFetchCount = 0;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        const urlStr = url.toString();
        if (urlStr.includes("/v2/runs")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                {
                  id: "run-1",
                  trigger: { eventIds: ["shared-event-1"] },
                  status: "COMPLETED",
                },
                {
                  id: "run-2",
                  trigger: { eventIds: ["shared-event-1"] },
                  status: "RUNNING",
                },
              ],
            }),
          };
        }
        if (urlStr.includes("/v1/events/shared-event-1")) {
          eventFetchCount++;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                name: "chat/response.generate",
                data: { userId: "user-123", chatId: "chat-shared" },
              },
            }),
          };
        }
        throw new Error(`Unexpected URL: ${urlStr}`);
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(eventFetchCount).toBe(1);
      expect(result.jobs).toHaveLength(2);
      expect(result.jobs[0].entityId).toBe("chat-shared");
      expect(result.jobs[1].entityId).toBe("chat-shared");
    });

    it("handles event fetch returning non-ok or non-object payload data", async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        const urlStr = url.toString();
        if (urlStr.includes("/v2/runs")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                {
                  id: "run-event-404",
                  trigger: { eventIds: ["event-404"] },
                  status: "COMPLETED",
                },
                {
                  id: "run-event-bad-data",
                  trigger: { eventIds: ["event-bad"] },
                  status: "COMPLETED",
                },
              ],
            }),
          };
        }
        if (urlStr.includes("/v1/events/event-404")) {
          return { ok: false, status: 404 };
        }
        if (urlStr.includes("/v1/events/event-bad")) {
          return { ok: true, status: 200, json: async () => ({ data: "string-not-object" }) };
        }
        throw new Error(`Unexpected URL: ${urlStr}`);
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.jobs).toEqual([]);
    });

    it("handles event fetch throwing network exception gracefully", async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        const urlStr = url.toString();
        if (urlStr.includes("/v2/runs")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                {
                  id: "run-event-error",
                  trigger: { eventIds: ["event-err"] },
                  status: "COMPLETED",
                },
              ],
            }),
          };
        }
        if (urlStr.includes("/v1/events/event-err")) {
          throw new Error("Event fetch timeout");
        }
        throw new Error(`Unexpected URL: ${urlStr}`);
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.jobs).toEqual([]);
      expect(mockLog.debug).toHaveBeenCalledWith(
        expect.stringContaining("Failed to fetch event payload"),
        expect.objectContaining({ eventId: "event-err", error: "Event fetch timeout" }),
      );
    });

    it("handles event fetch throwing non-Error rejection", async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        const urlStr = url.toString();
        if (urlStr.includes("/v2/runs")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [{ id: "run-1", trigger: { eventIds: ["event-str"] }, status: "COMPLETED" }],
            }),
          };
        }
        if (urlStr.includes("/v1/events/event-str")) {
          return Promise.reject("string rejection");
        }
        throw new Error(`Unexpected URL: ${urlStr}`);
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.jobs).toEqual([]);
      expect(mockLog.debug).toHaveBeenCalledWith(
        expect.stringContaining("Failed to fetch event payload"),
        expect.objectContaining({ error: "string rejection" }),
      );
    });

    it("verifies user-scoping and filters out runs not matching userId in application code", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: "run-match",
              trigger: { data: { userId: "user-123", chatId: "chat-1" } },
              status: "COMPLETED",
            },
            {
              id: "run-mismatch",
              trigger: { data: { userId: "victim-456", chatId: "chat-2" } },
              status: "COMPLETED",
            },
            {
              id: "run-no-user",
              trigger: { data: { chatId: "chat-3" } },
              status: "COMPLETED",
            },
          ],
        }),
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].id).toBe("run-match");
    });

    it("applies status filtering and pagination limit", async () => {
      let capturedUrl = "";
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        capturedUrl = url.toString();
        return { ok: true, status: 200, json: async () => ({ data: [] }) };
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      await fetchUserInngestRuns("user-123", {
        status: ["RUNNING", "QUEUED"],
        limit: 5,
      });

      expect(capturedUrl).toContain("status=RUNNING");
      expect(capturedUrl).toContain("status=QUEUED");
      expect(capturedUrl).toContain("limit=5");
    });

    it("handles offline resilience / network failure without throwing", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.jobs).toEqual([]);
      expect(result.offline).toBe(true);
      expect(result.error).toBe("Connection refused");
      expect(mockLog.warn).toHaveBeenCalledWith(
        expect.stringContaining("Inngest run service offline or unreachable"),
        expect.objectContaining({ error: "Connection refused", userId: "user-123" }),
      );
    });

    it("handles non-Error rejection in fetchUserInngestRuns", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue("network aborted");

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.jobs).toEqual([]);
      expect(result.offline).toBe(true);
      expect(result.error).toBe("network aborted");
    });

    it("returns error string when Inngest responds with non-ok HTTP status", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.jobs).toEqual([]);
      expect(result.error).toBe("Inngest API request failed with HTTP 404");
    });

    it("returns empty jobs array when body.data is not an array", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: null }),
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const result = await fetchUserInngestRuns("user-123");

      expect(result.jobs).toEqual([]);
    });

    it("strips trailing slash on INNGEST_BASE_URL cleanly", async () => {
      mockEnv.INNGEST_BASE_URL = "http://my-inngest:8288///";
      let capturedUrl = "";

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        capturedUrl = url.toString();
        return { ok: true, status: 200, json: async () => ({ data: [] }) };
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      await fetchUserInngestRuns("user-123");

      expect(capturedUrl).toContain("http://my-inngest:8288/v2/runs");
      expect(capturedUrl).not.toContain("///v2");
    });
  });

  describe("cancelInngestRun", () => {
    it("cancels run successfully via POST /v2/runs/{id}/cancel without userId check", async () => {
      let cancelEndpointCalled = false;
      let capturedBody: any;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        const urlStr = url.toString();
        if (urlStr.endsWith("/v2/runs/run-99/cancel")) {
          cancelEndpointCalled = true;
          capturedBody = JSON.parse((init?.body as string) || "{}");
          return { ok: true, status: 200, json: async () => ({ success: true }) };
        }
        throw new Error(`Unexpected url: ${urlStr}`);
      });

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-99");

      expect(cancelEndpointCalled).toBe(true);
      expect(capturedBody).toEqual({});
      expect(res.success).toBe(true);
    });

    it("verifies run ownership before cancellation when userId is supplied", async () => {
      let getRunCalled = false;
      let cancelCalled = false;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        const urlStr = url.toString();
        if (urlStr.endsWith("/v2/runs/run-verify")) {
          getRunCalled = true;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                id: "run-verify",
                trigger: { data: { userId: "user-123" } },
              },
            }),
          };
        }
        if (urlStr.endsWith("/v2/runs/run-verify/cancel")) {
          cancelCalled = true;
          return { ok: true, status: 200, json: async () => ({ success: true }) };
        }
        throw new Error(`Unexpected url: ${urlStr}`);
      });

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-verify", "user-123");

      expect(getRunCalled).toBe(true);
      expect(cancelCalled).toBe(true);
      expect(res.success).toBe(true);
    });

    it("verifies run ownership via event fetch when run has only trigger.eventIds", async () => {
      let eventFetched = false;
      let cancelCalled = false;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        const urlStr = url.toString();
        if (urlStr.endsWith("/v2/runs/run-event-lookup")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                id: "run-event-lookup",
                trigger: { eventIds: ["ev-lookup-1"] },
              },
            }),
          };
        }
        if (urlStr.includes("/v1/events/ev-lookup-1")) {
          eventFetched = true;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: { data: { userId: "user-123" } },
            }),
          };
        }
        if (urlStr.endsWith("/v2/runs/run-event-lookup/cancel")) {
          cancelCalled = true;
          return { ok: true, status: 200, json: async () => ({}) };
        }
        throw new Error(`Unexpected url: ${urlStr}`);
      });

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-event-lookup", "user-123");

      expect(eventFetched).toBe(true);
      expect(cancelCalled).toBe(true);
      expect(res.success).toBe(true);
    });

    it("rejects cancellation when run ownership verification fails", async () => {
      let cancelCalled = false;

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        const urlStr = url.toString();
        if (urlStr.endsWith("/v2/runs/run-victim")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                id: "run-victim",
                trigger: { data: { userId: "other-user-456" } },
              },
            }),
          };
        }
        if (urlStr.includes("/cancel")) {
          cancelCalled = true;
          return { ok: true, status: 200, json: async () => ({}) };
        }
        throw new Error(`Unexpected url: ${urlStr}`);
      });

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-victim", "attacker-123");

      expect(res.success).toBe(false);
      expect(res.error).toBe("Run does not belong to user or trigger payload is missing");
      expect(cancelCalled).toBe(false);
    });

    it("rejects cancellation when run fetch returns HTTP 404", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-missing", "user-123");

      expect(res.success).toBe(false);
      expect(res.error).toBe("Failed to verify run ownership: HTTP 404");
    });

    it("treats 409 Conflict as success (already ended)", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
      });

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-already-ended");

      expect(res.success).toBe(true);
    });

    it("treats already ended text in error body as success", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "The run is already completed",
      });

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-completed");

      expect(res.success).toBe(true);
    });

    it("returns error string when cancel request fails with non-ok and non-ended text", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal server failure",
      });

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-500");

      expect(res.success).toBe(false);
      expect(res.error).toBe("Internal server failure");
    });

    it("falls back to status code message when cancel returns empty text", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: async () => "",
      });

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-502");

      expect(res.success).toBe(false);
      expect(res.error).toBe("Failed with status 502");
    });

    it("handles cancel run response with top-level payload without data wrapper", async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        const urlStr = url.toString();
        if (urlStr.endsWith("/v2/runs/run-flat")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: "run-flat",
              trigger: { data: { userId: "user-123" } },
            }),
          };
        }
        if (urlStr.endsWith("/v2/runs/run-flat/cancel")) {
          return { ok: true, status: 200, json: async () => ({}) };
        }
        throw new Error(`Unexpected url: ${urlStr}`);
      });

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-flat", "user-123");
      expect(res.success).toBe(true);
    });

    it("rejects cancel when event fetch returns no data", async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        const urlStr = url.toString();
        if (urlStr.endsWith("/v2/runs/run-no-event-data")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                id: "run-no-event-data",
                trigger: { eventIds: ["ev-empty"] },
              },
            }),
          };
        }
        if (urlStr.includes("/v1/events/ev-empty")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: {} }),
          };
        }
        throw new Error(`Unexpected url: ${urlStr}`);
      });

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-no-event-data", "user-123");
      expect(res.success).toBe(false);
      expect(res.error).toBe("Run does not belong to user or trigger payload is missing");
    });

    it("handles cancel network error gracefully", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network timeout"));

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-timeout");

      expect(res.success).toBe(false);
      expect(res.error).toBe("Network timeout");
    });

    it("handles cancel non-Error rejection gracefully", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue("string cancel error");

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-str-timeout");

      expect(res.success).toBe(false);
      expect(res.error).toBe("string cancel error");
    });
  });

  describe("Metadata & Helpers", () => {
    it("resolves job metadata across supported event types and fallbacks", async () => {
      const { resolveJobType, resolveJobMetadata } = await import(
        "@/lib/inngest/run-service/run-metadata"
      );

      expect(resolveJobType("chat/response.generate")).toBe("chat");
      expect(resolveJobType("workflows/transform.execute")).toBe("transform");
      expect(resolveJobType("workflows/translate.execute")).toBe("translation");
      expect(resolveJobType("knowledgebase/document.ingest")).toBe("kb-ingest");
      expect(resolveJobType("knowledgebase/reindex")).toBe("kb-reindex");
      expect(resolveJobType("custom.event")).toBe("other");
      expect(resolveJobType(null)).toBe("other");

      const chatMeta = resolveJobMetadata(
        "chat",
        "chat/response.generate",
        "fn",
        { chatId: "c-1", model: "gpt-4o" },
      );
      expect(chatMeta.title).toBe("Chat Response");
      expect(chatMeta.subtitle).toBe("Model: gpt-4o");
      expect(chatMeta.entityId).toBe("c-1");
      expect(chatMeta.url).toBe("/chats/c-1");

      const transformMeta1 = resolveJobMetadata(
        "transform",
        "workflows/transform.execute",
        "fn",
        { agentId: "ag-1", runId: "tr-1", agentName: "Worker" },
      );
      expect(transformMeta1.url).toBe("/transform/ag-1/tr-1");
      expect(transformMeta1.subtitle).toBe("Worker");

      const transformMeta2 = resolveJobMetadata(
        "transform",
        "workflows/transform.execute",
        "fn",
        { runId: "tr-2" },
      );
      expect(transformMeta2.url).toBe("/transform?runId=tr-2");

      const transformMeta3 = resolveJobMetadata(
        "transform",
        "workflows/transform.execute",
        "fn",
        undefined,
      );
      expect(transformMeta3.url).toBe("/transform");

      const translationMeta1 = resolveJobMetadata(
        "translation",
        "workflows/translate.execute",
        "fn",
        { translationId: "t-1", sourceLanguage: "EN", targetLanguage: "ES" },
      );
      expect(translationMeta1.title).toBe("Document Translation");
      expect(translationMeta1.subtitle).toBe("EN → ES");
      expect(translationMeta1.url).toBe("/translation");

      const translationMeta2 = resolveJobMetadata(
        "translation",
        "workflows/translate.execute",
        "fn",
        { sourceLanguage: "EN" },
      );
      expect(translationMeta2.subtitle).toBeUndefined();

      const kbIngestMeta1 = resolveJobMetadata(
        "kb-ingest",
        "knowledgebase/document.ingest",
        "fn",
        { documentId: "d-1", documentName: "file.pdf" },
      );
      expect(kbIngestMeta1.subtitle).toBe("file.pdf");

      const kbIngestMeta2 = resolveJobMetadata(
        "kb-ingest",
        "knowledgebase/document.ingest",
        "fn",
        { documentId: "d-2" },
      );
      expect(kbIngestMeta2.subtitle).toBe("Document d-2");

      const kbIngestMeta3 = resolveJobMetadata(
        "kb-ingest",
        "knowledgebase/document.ingest",
        "fn",
        undefined,
      );
      expect(kbIngestMeta3.subtitle).toBeUndefined();

      const kbReindexMeta1 = resolveJobMetadata(
        "kb-reindex",
        "knowledgebase/reindex",
        "fn",
        { kbId: "k-1", kbTitle: "Docs" },
      );
      expect(kbReindexMeta1.subtitle).toBe("Docs");
      expect(kbReindexMeta1.url).toBe("/knowledgebases/k-1");

      const kbReindexMeta2 = resolveJobMetadata(
        "kb-reindex",
        "knowledgebase/reindex",
        "fn",
        { kbId: "k-2" },
      );
      expect(kbReindexMeta2.subtitle).toBe("KB k-2");

      const kbReindexMeta3 = resolveJobMetadata(
        "kb-reindex",
        "knowledgebase/reindex",
        "fn",
        undefined,
      );
      expect(kbReindexMeta3.url).toBe("/knowledgebases");

      const otherMeta = resolveJobMetadata(
        "other",
        "",
        "",
        undefined,
      );
      expect(otherMeta.title).toBe("Background Job");
    });

    it("computes duration in milliseconds correctly", async () => {
      const { computeDurationMs } = await import(
        "@/lib/inngest/run-service/run-metadata"
      );

      expect(computeDurationMs(undefined, undefined)).toBeUndefined();
      expect(
        computeDurationMs("2026-01-01T00:00:00Z", "2026-01-01T00:00:05Z"),
      ).toBe(5000);
      expect(
        computeDurationMs("2026-01-01T00:00:05Z", "2026-01-01T00:00:00Z"),
      ).toBe(0);
      expect(
        computeDurationMs("2026-01-01T00:00:00Z", null),
      ).toBeGreaterThan(0);
    });

    it("extracts error messages from status and output", async () => {
      const { extractErrorMessage } = await import(
        "@/lib/inngest/run-service/run-metadata"
      );

      expect(extractErrorMessage("COMPLETED", { error: "none" })).toBeUndefined();
      expect(extractErrorMessage("FAILED", "Direct error")).toBe("Direct error");
      expect(extractErrorMessage("FAILED", { error: "Object error" })).toBe("Object error");
      expect(extractErrorMessage("FAILED", { error: { message: "Nested error" } })).toBe("Nested error");
      expect(extractErrorMessage("FAILED", { error: { code: 500 } })).toBe('{"code":500}');
      expect(extractErrorMessage("FAILED", { message: "Bare message" })).toBe("Bare message");
      expect(extractErrorMessage("FAILED", {})).toBe("Job execution failed");
      expect(extractErrorMessage("FAILED", 404)).toBe("Job execution failed");
      expect(extractErrorMessage("FAILED", null)).toBe("Job execution failed");
    });

    it("verifies isMismatchedUser behavior", async () => {
      const { isMismatchedUser } = await import(
        "@/lib/inngest/run-service/run-metadata"
      );

      expect(isMismatchedUser(undefined, undefined)).toBe(false);
      expect(isMismatchedUser(undefined, "user-1")).toBe(true);
      expect(isMismatchedUser(null, "user-1")).toBe(true);
      expect(isMismatchedUser({}, "user-1")).toBe(true);
      expect(isMismatchedUser({ userId: "other" }, "user-1")).toBe(true);
      expect(isMismatchedUser({ userId: "user-1" }, "user-1")).toBe(false);
    });

    it("verifies isAlreadyEndedError matches ended phrases", async () => {
      const { isAlreadyEndedError } = await import(
        "@/lib/inngest/run-service/run-metadata"
      );

      expect(isAlreadyEndedError("cannot cancel an ended run")).toBe(true);
      expect(isAlreadyEndedError("Run has already completed")).toBe(true);
      expect(isAlreadyEndedError("Run already ended")).toBe(true);
      expect(isAlreadyEndedError("already cancelled")).toBe(true);
      expect(isAlreadyEndedError("not running")).toBe(true);
      expect(isAlreadyEndedError("not active")).toBe(true);
      expect(isAlreadyEndedError("unknown failure")).toBe(false);
      expect(isAlreadyEndedError(undefined)).toBe(false);
    });

    it("verifies resolveInngestHeaders, keys, and base URLs", async () => {
      const {
        resolveInngestHeaders,
        resolveInngestSigningKey,
        resolveInngestEventKey,
        resolveInngestApiBaseUrl,
      } = await import("@/lib/inngest/run-service/run-metadata");

      useDevMode();
      expect(resolveInngestSigningKey()).toBeUndefined();
      expect(resolveInngestEventKey()).toBeUndefined();
      expect(resolveInngestApiBaseUrl()).toBe("http://127.0.0.1:8288");
      expect(resolveInngestHeaders().Authorization).toBeUndefined();

      useProdMode();
      expect(resolveInngestSigningKey()).toBe("signkey-prod-123");
      expect(resolveInngestEventKey()).toBe("eventkey-prod-123");
      expect(resolveInngestApiBaseUrl()).toBe("https://api.inngest.com");
      expect(resolveInngestHeaders().Authorization).toBe("Bearer signkey-prod-123");
    });

    it("extracts inline payload data and trigger event ids", async () => {
      const {
        extractInlinePayloadData,
        extractTriggerEventId,
        normalizeRunFields,
        firstNonEmpty,
      } = await import("@/lib/inngest/run-service/run-metadata");

      expect(firstNonEmpty(undefined, null, undefined)).toBeUndefined();
      expect(firstNonEmpty(undefined, "found", "second")).toBe("found");

      expect(extractInlinePayloadData({ trigger: { data: { a: 1 } } })).toEqual({ a: 1 });
      expect(extractInlinePayloadData({ event: { data: { b: 2 } } })).toEqual({ b: 2 });
      expect(extractInlinePayloadData({ data: { c: 3 } })).toEqual({ c: 3 });
      expect(extractInlinePayloadData({})).toBeUndefined();

      expect(extractTriggerEventId({ trigger: { eventIds: ["ev-1"] } })).toBe("ev-1");
      expect(extractTriggerEventId({ event_id: "ev-2" })).toBe("ev-2");
      expect(extractTriggerEventId({ eventId: "ev-3" })).toBe("ev-3");
      expect(extractTriggerEventId({})).toBeUndefined();

      const norm = normalizeRunFields(
        {
          function_id: "fid-1",
          function_name: "fname-1",
          event_name: "ename-1",
          queued_at: "2026-01-01T00:00:00Z",
          started_at: "2026-01-01T00:00:01Z",
          ended_at: "2026-01-01T00:00:02Z",
          error: "some error",
        },
        { fallback: true },
        "fallback-event",
      );

      expect(norm.functionId).toBe("fid-1");
      expect(norm.functionName).toBe("fname-1");
      expect(norm.eventName).toBe("ename-1");
      expect(norm.payloadData).toEqual({ fallback: true });
      expect(norm.output).toBe("some error");
    });

    it("covers resolveInngestApiBaseUrl default dev fallback when INNGEST_BASE_URL is empty", async () => {
      const { resolveInngestApiBaseUrl } = await import(
        "@/lib/inngest/run-service/run-metadata"
      );
      mockEnv.INNGEST_DEV = "1";
      mockEnv.INNGEST_BASE_URL = "";
      mockEnv.NODE_ENV = "development";
      expect(resolveInngestApiBaseUrl()).toBe("http://127.0.0.1:8288");
    });

    it("handles runs with no payload data and no trigger event ID gracefully", async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/v2/runs")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                {
                  id: "run-cron-1",
                  status: "Completed",
                  function_id: "cron-job",
                },
              ],
            }),
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });

      const { fetchUserInngestRuns } = await import("@/lib/inngest/run-service");
      const res = await fetchUserInngestRuns();
      expect(res.jobs).toHaveLength(1);
      expect(res.jobs[0].id).toBe("run-cron-1");
    });

    it("handles run cancellation when run has no payload and no trigger event ID", async () => {
      let cancelCalled = false;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (init?.method === "POST" && url.includes("/cancel")) {
          cancelCalled = true;
          return { ok: true, status: 200, json: async () => ({}) };
        }
        if (url.includes("/v2/runs/run-no-event")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                id: "run-no-event",
                status: "Running",
                function_id: "cron-job",
              },
            }),
          };
        }
        return { ok: false, status: 404, json: async () => ({}) };
      });

      const { cancelInngestRun } = await import("@/lib/inngest/run-service");
      const res = await cancelInngestRun("run-no-event", "user-1");
      expect(res.success).toBe(false);
      expect(res.error).toContain(
        "Run does not belong to user or trigger payload is missing",
      );
      expect(cancelCalled).toBe(false);
    });

    it("produces undefined URL for chat job metadata when entityId is omitted", async () => {
      const { resolveJobMetadata } = await import(
        "@/lib/inngest/run-service/run-metadata"
      );
      const meta = resolveJobMetadata(
        "chat",
        "chat.generate",
        "Chat Function",
        { model: "gpt-4" },
      );
      expect(meta.title).toBe("Chat Response");
      expect(meta.subtitle).toBe("Model: gpt-4");
      expect(meta.url).toBeUndefined();
    });

    it("resolves inline payload directly in resolveRunEventData without network call", async () => {
      const { resolveRunEventData } = await import(
        "@/lib/inngest/run-service"
      );
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const run = { trigger: { data: { userId: "user-1", chatId: "chat-1" } } };
      const result = await resolveRunEventData(
        run,
        "http://127.0.0.1:8288",
        {},
        AbortSignal.timeout(1000),
      );

      expect(result.payloadData).toEqual({ userId: "user-1", chatId: "chat-1" });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("fetches event payload from /v1/events in resolveRunEventData when inline data is absent", async () => {
      const { resolveRunEventData } = await import(
        "@/lib/inngest/run-service"
      );
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/v1/events/ev-123")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                name: "chat/response.generate",
                data: { userId: "user-1", chatId: "chat-99" },
              },
            }),
          };
        }
        return { ok: false, status: 404 };
      });

      const run = { trigger: { eventIds: ["ev-123"] } };
      const result = await resolveRunEventData(
        run,
        "http://127.0.0.1:8288",
        { Authorization: "Bearer key" },
        AbortSignal.timeout(1000),
      );

      expect(result.payloadData).toEqual({ userId: "user-1", chatId: "chat-99" });
      expect(result.eventNameFallback).toBe("chat/response.generate");
    });
  });
});
