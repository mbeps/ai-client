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
  let currentUrl =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  let currentInit = { ...init };

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(currentUrl, {
      ...currentInit,
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        return response;
      }

      const nextUrl = new URL(location, currentUrl);

      // Re-validate every redirect hop against SSRF rules
      if (await isBlockedUrl(nextUrl.href)) {
        throw new Error(
          `Redirect destination "${nextUrl.href}" points to a blocked/internal address`,
        );
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

    return response;
  }

  throw new Error(`Too many redirects (limit: ${MAX_REDIRECTS})`);
}
