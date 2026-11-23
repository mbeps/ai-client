import { NonRetriableError } from "inngest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeHttpRequestNode } from "@/lib/workflows/execute-http-node";

const mockIsBlockedUrl = vi.fn();

vi.mock("@/lib/mcp/url-guard/is-blocked-url", () => ({
  isBlockedUrl: (url: string) => mockIsBlockedUrl(url),
}));

describe("executeHttpRequestNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsBlockedUrl.mockResolvedValue(false);
    vi.restoreAllMocks();
  });

  it("blocks SSRF URLs after template compilation", async () => {
    mockIsBlockedUrl.mockImplementation(async (url: string) =>
      url.includes("127.0.0.1") || url.includes("169.254.169.254"),
    );

    await expect(
      executeHttpRequestNode({
        runId: "run-1",
        nodeId: "http-1",
        data: {
          kind: "http_request",
          variableName: "http1",
          method: "GET",
          url: "http://{{webhook.body.host}}/admin",
          headers: [],
        },
        context: { webhook: { body: { host: "127.0.0.1" } } },
        dryRun: false,
      }),
    ).rejects.toThrow(NonRetriableError);

    expect(mockIsBlockedUrl).toHaveBeenCalledWith("http://127.0.0.1/admin");
  });

  it("blocks redirect hops pointing to internal/blocked URLs", async () => {
    mockIsBlockedUrl
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data" },
      }),
    );

    await expect(
      executeHttpRequestNode({
        runId: "run-1",
        nodeId: "http-1",
        data: {
          kind: "http_request",
          variableName: "http1",
          method: "GET",
          url: "https://public.example.com/start",
          headers: [],
        },
        context: {},
        dryRun: false,
      }),
    ).rejects.toThrow("Blocked URL: SSRF protection");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("follows safe redirects and throws NonRetriableError when too many redirects occur", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(null, {
        status: 301,
        headers: { location: "https://public.example.com/loop" },
      }),
    );

    await expect(
      executeHttpRequestNode({
        runId: "run-1",
        nodeId: "http-1",
        data: {
          kind: "http_request",
          variableName: "http1",
          method: "GET",
          url: "https://public.example.com/start",
          headers: [],
        },
        context: {},
        dryRun: false,
      }),
    ).rejects.toThrow(NonRetriableError);
  });

  it("skips non-GET requests in dryRun mode", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await executeHttpRequestNode({
      runId: "run-1",
      nodeId: "http-1",
      data: {
        kind: "http_request",
        variableName: "http1",
        method: "POST",
        url: "https://api.example.com/items",
        headers: [{ key: "Authorization", value: "Bearer {{token}}" }],
        body: '{"ok":true}',
      },
      context: { token: "sec" },
      dryRun: true,
    });

    expect(res.status).toBe(200);
    expect(res.statusText).toBe("DRY_RUN");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("executes request with compiled headers/body and Idempotency-Key, parsing JSON or text", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 99 }), {
        status: 201,
        statusText: "Created",
        headers: { "content-type": "application/json" },
      }),
    );

    const jsonRes = await executeHttpRequestNode({
      runId: "run-1",
      nodeId: "http-1",
      data: {
        kind: "http_request",
        variableName: "http1",
        method: "POST",
        url: "https://api.example.com/items",
        headers: [
          { key: "X-Custom", value: "{{val}}" },
          { key: "", value: "ignored" },
        ],
        body: '{"name":"{{val}}"}',
        timeoutMs: 5000,
      },
      context: { val: "demo" },
      dryRun: false,
    });

    expect(jsonRes.status).toBe(201);
    expect(jsonRes.data).toEqual({ id: 99 });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.example.com/items",
      expect.objectContaining({
        method: "POST",
        body: '{"name":"demo"}',
      }),
    );

    const noCtRes = new Response("raw", { status: 200 });
    noCtRes.headers.delete("content-type");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(noCtRes);
    const noCtOut = await executeHttpRequestNode({
      runId: "run-1",
      nodeId: "http-noct",
      data: {
        kind: "http_request",
        variableName: "httpNoCt",
        method: "GET",
        url: "https://api.example.com/raw",
        headers: [],
      },
      context: {},
      dryRun: false,
    });
    expect(noCtOut.data).toBe("raw");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("plain text ok", {
        status: 200,
        statusText: "OK",
        headers: { "content-type": "text/plain" },
      }),
    );
    const textRes = await executeHttpRequestNode({
      runId: "run-1",
      nodeId: "http-2",
      data: {
        kind: "http_request",
        variableName: "http2",
        method: "GET",
        url: "https://api.example.com/ping",
        headers: [],
      },
      context: {},
      dryRun: true,
    });
    expect(textRes.data).toBe("plain text ok");
  });

  it("throws NonRetriableError on 4xx (except 408/429) and retriable Error on 429/5xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Bad Request", { status: 400, statusText: "Bad Request" }),
    );
    await expect(
      executeHttpRequestNode({
        runId: "run-1",
        nodeId: "http-1",
        data: {
          kind: "http_request",
          variableName: "http1",
          method: "GET",
          url: "https://api.example.com/bad",
          headers: [],
        },
        context: {},
        dryRun: false,
      }),
    ).rejects.toThrow(NonRetriableError);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Rate Limited", { status: 429, statusText: "Too Many" }),
    );
    await expect(
      executeHttpRequestNode({
        runId: "run-1",
        nodeId: "http-1",
        data: {
          kind: "http_request",
          variableName: "http1",
          method: "GET",
          url: "https://api.example.com/rate",
          headers: [],
        },
        context: {},
        dryRun: false,
      }),
    ).rejects.toThrow("HTTP 429");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Server Error", { status: 503, statusText: "Unavailable" }),
    );
    await expect(
      executeHttpRequestNode({
        runId: "run-1",
        nodeId: "http-1",
        data: {
          kind: "http_request",
          variableName: "http1",
          method: "GET",
          url: "https://api.example.com/err",
          headers: [],
        },
        context: {},
        dryRun: false,
      }),
    ).rejects.toThrow("HTTP 503");
  });
});
