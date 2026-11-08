import { AppException } from "@/lib/error/app-exception";
import { ERROR_CODE } from "@/lib/error/error-code";
import { isBlockedUrl } from "@/lib/mcp/url-guard/is-blocked-url";

/**
 * Maximum number of redirect hops allowed before aborting.
 */
const MAX_REDIRECTS = 5;

/**
 * Strips payload-specific headers when transitioning from POST to GET after 301/302/303 redirects.
 *
 * @param headers - Original request headers
 * @returns Cleaned headers without Content-Type or Content-Length
 * @author Maruf Bepary
 */
function stripPayloadHeaders(
  headers: HeadersInit | undefined,
): HeadersInit | undefined {
  if (!headers) return undefined;
  if (headers instanceof Headers) {
    const next = new Headers(headers);
    next.delete("content-type");
    next.delete("content-length");
    return next;
  }
  if (Array.isArray(headers)) {
    return headers.filter(([key]) => !/^content-(type|length)$/i.test(key));
  }
  const {
    "content-type": _ct,
    "Content-Type": _CT,
    "content-length": _cl,
    "Content-Length": _CL,
    ...rest
  } = headers as Record<string, string>;
  return rest;
}

/**
 * When an MCP server request was redirected across origins and returns 401 Unauthorized,
 * any `resource_metadata="..."` URL in WWW-Authenticate that doesn't match the initial origin
 * will cause @ai-sdk/mcp's `assertResourceMetadataUrlSameOrigin` to fail.
 *
 * Stripping cross-origin `resource_metadata` allows @ai-sdk/mcp to fall back to discovering
 * metadata through `safeMcpFetch`, which follows redirects and invokes `validateResourceURL`.
 *
 * @param response - The original HTTP response
 * @param initialUrl - The URL of the original request
 * @param finalUrl - The URL of the final response after redirects
 * @returns A new Response object with sanitized headers if necessary
 * @author Maruf Bepary
 */
function sanitizeCrossOriginAuthResponse(
  response: Response,
  initialUrl: string,
  finalUrl: string,
): Response {
  if (response.status !== 401) {
    return response;
  }

  let initialOrigin: string;
  let finalOrigin: string;
  try {
    initialOrigin = new URL(initialUrl).origin;
    finalOrigin = new URL(finalUrl).origin;
  } catch {
    return response;
  }

  if (initialOrigin === finalOrigin) {
    return response;
  }

  const authHeader = response.headers.get("www-authenticate");
  if (!authHeader?.includes("resource_metadata")) {
    return response;
  }

  const resourceMatch = authHeader.match(
    /(?:^|[,\s])resource_metadata="([^"]*)"/i,
  );
  if (resourceMatch) {
    try {
      const metaOrigin = new URL(resourceMatch[1]).origin;
      if (metaOrigin === initialOrigin) {
        return response;
      }
    } catch {
      // Invalid URL in resource_metadata, fall through to sanitize
    }
  }

  const cleanedHeader = authHeader
    .replace(/(?:^|[,\s])resource_metadata="?[^",]+"?(?=,|$|\s)/gi, "")
    .replace(/^\s*,\s*|,\s*$/g, "")
    .replace(/(Bearer)\s*,?\s*/gi, "$1 ")
    .replace(/,\s*,/g, ", ")
    .replace(/\s+/g, " ")
    .trim();

  const newHeaders = new Headers(response.headers);
  if (cleanedHeader) {
    newHeaders.set("www-authenticate", cleanedHeader);
  } else {
    newHeaders.delete("www-authenticate");
  }

  return new Proxy(response, {
    get(target, prop) {
      if (prop === "headers") {
        return newHeaders;
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/**
 * Custom fetch wrapper for MCP HTTP transports.
 * Safely follows HTTP redirects (e.g. www to non-www, HTTP to HTTPS, canonical paths)
 * while re-validating every redirect target IP against SSRF rules via isBlockedUrl().
 *
 * @param input - Target resource URL or Request
 * @param init - Request options
 * @returns Settled HTTP Response
 * @throws {Error} When a redirect destination resolves to an internal/private IP or redirect limit is exceeded
 * @author Maruf Bepary
 */
export async function safeMcpFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const initialUrl =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  let currentUrl = initialUrl;
  let currentInit = { ...init };

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(currentUrl, {
      ...currentInit,
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        return sanitizeCrossOriginAuthResponse(
          response,
          initialUrl,
          currentUrl,
        );
      }

      const nextUrl = new URL(location, currentUrl);

      // Re-validate every redirect hop against SSRF rules
      if (await isBlockedUrl(nextUrl.href)) {
        throw new AppException({
          code: ERROR_CODE.FORBIDDEN,
          message: `Redirect destination "${nextUrl.href}" points to a blocked/internal address`,
        });
      }

      currentUrl = nextUrl.href;

      // RFC 7231 / RFC 9110: 301, 302, 303 change POST to GET and drop payload
      if (
        (response.status === 301 ||
          response.status === 302 ||
          response.status === 303) &&
        currentInit.method === "POST"
      ) {
        currentInit = {
          ...currentInit,
          method: "GET",
          body: undefined,
          headers: stripPayloadHeaders(currentInit.headers),
        };
      }
      continue;
    }

    return sanitizeCrossOriginAuthResponse(response, initialUrl, currentUrl);
  }

  throw new AppException({
    code: ERROR_CODE.UPSTREAM_HTTP,
    message: `Too many redirects (limit: ${MAX_REDIRECTS})`,
  });
}
