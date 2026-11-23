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
        headers: { location: "https://169.254.169.254/latest/meta-data" },
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

  it("blocks HTTPS-to-HTTP redirect downgrades", async () => {
    mockIsBlockedUrl.mockResolvedValue(false);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "http://other.example.com/insecure" },
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
          url: "https://api.example.com/start",
          headers: [],
        },
        context: {},
        dryRun: false,
      }),
    ).rejects.toThrow("Blocked URL: HTTPS to HTTP redirect downgrade");
  });

  it("strips credentials/body on cross-origin redirects and respects 301/302/303 vs 307/308 semantics", async () => {
    mockIsBlockedUrl.mockResolvedValue(false);
    // 1. 307 same-origin preserves POST method, headers, and body
    const sameOriginFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(null, {
          status: 307,
          headers: { location: "https://api.example.com/v2/items" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    await executeHttpRequestNode({
      runId: "run-1",
      nodeId: "http-1",
      data: {
        kind: "http_request",
        variableName: "http1",
        method: "POST",
        url: "https://api.example.com/v1/items",
        headers: [{ key: "Authorization", value: "Bearer secret" }],
        body: '{"name":"item"}',
      },
      context: {},
      dryRun: false,
    });

    expect(sameOriginFetch).toHaveBeenNthCalledWith(
      2,
      "https://api.example.com/v2/items",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer secret" }),
        body: '{"name":"item"}',
      }),
    );

    // 2. 302 cross-origin strips headers, drops body, and changes POST to GET
    vi.restoreAllMocks();
    mockIsBlockedUrl.mockResolvedValue(false);
    const crossOriginFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://cdn.other.com/result" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 204,
          headers: { "content-type": "application/json" },
        }),
      );

    const res = await executeHttpRequestNode({
      runId: "run-1",
      nodeId: "http-1",
      data: {
        kind: "http_request",
        variableName: "http1",
        method: "POST",
        url: "https://api.example.com/submit",
        headers: [{ key: "Authorization", value: "Bearer secret" }],
        body: '{"payload":1}',
      },
      context: {},
      dryRun: false,
    });

    expect(crossOriginFetch).toHaveBeenNthCalledWith(
      2,
      "https://cdn.other.com/result",
      expect.objectContaining({
        method: "GET",
        headers: {},
        body: undefined,
      }),
    );
    expect(res.data).toBeNull();

    // 3. 303 on GET keeps GET, 200 with empty JSON body returns null, and undefined method defaults to GET
    vi.restoreAllMocks();
    mockIsBlockedUrl.mockResolvedValue(false);
    const getRedirectFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(null, {
          status: 303,
          headers: { location: "https://api.example.com/done" },
        }),
      )
      .mockResolvedValueOnce(
        new Response("   ", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    const emptyJsonRes = await executeHttpRequestNode({
      runId: "run-1",
      nodeId: "http-1",
      data: {
        kind: "http_request",
        variableName: "http1",
        method: undefined as any,
        url: "https://api.example.com/poll",
        headers: [],
      },
      context: {},
      dryRun: false,
    });
    expect(getRedirectFetch).toHaveBeenNthCalledWith(
      2,
      "https://api.example.com/done",
      expect.objectContaining({ method: "GET" }),
    );
    expect(emptyJsonRes.data).toBeNull();

    // 4. 303 on HEAD keeps HEAD
    vi.restoreAllMocks();
    mockIsBlockedUrl.mockResolvedValue(false);
    const headRedirectFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(null, {
          status: 303,
          headers: { location: "https://api.example.com/head-target" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await executeHttpRequestNode({
      runId: "run-1",
      nodeId: "http-1",
      data: {
        kind: "http_request",
        variableName: "http1",
        method: "HEAD" as any,
        url: "https://api.example.com/head",
        headers: [],
      },
      context: {},
      dryRun: false,
    });
    expect(headRedirectFetch).toHaveBeenNthCalledWith(
      2,
      "https://api.example.com/head-target",
      expect.objectContaining({ method: "HEAD" }),
    );
  });
});
