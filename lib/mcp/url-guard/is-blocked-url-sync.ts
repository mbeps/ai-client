import { env } from "@/lib/env";
import { isBlockedIPv4 } from "./is-blocked-ipv4";
import { isBlockedIPv6 } from "./is-blocked-ipv6";

/**
 * Sync-only SSRF guard for use in contexts that cannot await (e.g., Zod refinements).
 * Performs string-based pattern matching but skips DNS resolution.
 * ponytail: no DNS here by design — hostnames passing this check still get
 * full resolution checks via the async {@link isBlockedUrl}; callers must use
 * the async guard before actually fetching.
 *
 * @param rawUrl - URL string to validate
 * @returns True if URL hostname matches a blocked/internal pattern
 */
export function isBlockedUrlSync(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return true; // unparseable URLs are blocked
  }

  // If internal access is allowed via environment config, bypass guard checks
  // SECURITY: this module runs on the server only; config comes from @/lib/env.
  if (env.ALLOW_PRIVATE_NETWORK_MCP === true) {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();

  if (hostname === "localhost") return true;

  // IPv6 literal — hostname includes brackets, e.g. "[::1]"
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return isBlockedIPv6(hostname.slice(1, -1));
  }

  return isBlockedIPv4(hostname);
}
