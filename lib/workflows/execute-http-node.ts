import { NonRetriableError } from "inngest";
import { isBlockedUrl } from "@/lib/mcp/url-guard/is-blocked-url";
import { compileWorkflowTemplate } from "@/lib/workflows/compile-template";
import type { HttpRequestNodeData } from "@/types/workflows/workflow";

const MAX_REDIRECT_HOPS = 5;
const DEFAULT_HTTP_TIMEOUT_MS = 15000;

async function fetchWithSsrfRedirectGuard(
  initialUrl: string,
  init: RequestInit,
): Promise<Response> {
  let currentUrl = initialUrl;
  let currentMethod = init.method ?? "GET";
  let currentHeaders: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  let currentBody = init.body;
  const initialOrigin = new URL(initialUrl).origin;

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    if (hop > 0 && (await isBlockedUrl(currentUrl))) {
      throw new NonRetriableError("Blocked URL: SSRF protection");
    }

    const response = await fetch(currentUrl, {
      ...init,
      method: currentMethod,
      headers: currentHeaders,
      body: currentBody,
      redirect: "manual",
    });

    if (
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.get("location")
    ) {
      const prevParsed = new URL(currentUrl);
      const nextParsed = new URL(response.headers.get("location")!, currentUrl);

      if (prevParsed.protocol === "https:" && nextParsed.protocol === "http:") {
        throw new NonRetriableError(
          "Blocked URL: HTTPS to HTTP redirect downgrade",
        );
      }

      if (
        nextParsed.origin !== initialOrigin ||
        nextParsed.origin !== prevParsed.origin
      ) {
        currentHeaders = {};
        currentBody = undefined;
      }

      const shouldConvertToGet =
        response.status === 303
          ? currentMethod !== "GET" && currentMethod !== "HEAD"
          : (response.status === 301 || response.status === 302) &&
            currentMethod === "POST";
      if (shouldConvertToGet) {
        currentMethod = "GET";
        currentBody = undefined;
      }

      currentUrl = nextParsed.toString();
      continue;
    }

    return response;
  }

  throw new NonRetriableError("Too many HTTP redirects");
}

function buildCompiledHeaders(
  headers: Array<{ key: string; value: string }>,
  context: Record<string, unknown>,
  idempotencyKey: string,
): Record<string, string> {
  const result: Record<string, string> = {
    "Idempotency-Key": idempotencyKey,
  };
  for (const header of headers) {
    const key = header.key.trim();
    if (!key) continue;
    result[key] = compileWorkflowTemplate(header.value, context);
  }
  return result;
}

/**
 * Executes an outbound HTTP Request node with template compilation, post-compilation SSRF checks,
 * dry-run protection for mutating verbs, and retriable vs non-retriable HTTP error classification.
 */
export async function executeHttpRequestNode(params: {
  runId: string;
  nodeId: string;
  data: HttpRequestNodeData;
  context: Record<string, unknown>;
  dryRun: boolean;
}): Promise<{
  status: number;
  statusText: string;
  data: unknown;
  summary: string;
}> {
  const { runId, nodeId, data, context, dryRun } = params;
  const compiledUrl = compileWorkflowTemplate(data.url, context);

  if (await isBlockedUrl(compiledUrl)) {
    throw new NonRetriableError("Blocked URL: SSRF protection");
  }

  if (dryRun && data.method !== "GET") {
    return {
      status: 200,
      statusText: "DRY_RUN",
      data: { dryRun: true, method: data.method, url: compiledUrl },
      summary: `Dry run: skipped mutating ${data.method} request`,
    };
  }

  const headers = buildCompiledHeaders(
    data.headers,
    context,
    `${runId}:${nodeId}`,
  );
  const compiledBody =
    data.method !== "GET" && data.body
      ? compileWorkflowTemplate(data.body, context)
      : undefined;

  const response = await fetchWithSsrfRedirectGuard(compiledUrl, {
    method: data.method,
    headers,
    body: compiledBody,
    signal: AbortSignal.timeout(data.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS),
  });

  if (response.status >= 400) {
    const isRetriable =
      response.status === 408 ||
      response.status === 429 ||
      response.status >= 500;
    const message = `HTTP ${response.status} ${response.statusText}`.trim();
    if (isRetriable) {
      throw new Error(message);
    }
    throw new NonRetriableError(message);
  }

  const contentType = response.headers.get("content-type") ?? "";
  let parsedData: unknown = null;
  if (response.status !== 204 && response.status !== 205) {
    const rawText = await response.text();
    if (rawText.trim() !== "") {
      parsedData = contentType.includes("application/json")
        ? JSON.parse(rawText)
        : rawText;
    }
  }

  return {
    status: response.status,
    statusText: response.statusText,
    data: parsedData,
    summary: `${data.method} ${compiledUrl} -> ${response.status}`,
  };
}
