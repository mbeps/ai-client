import { resolveHostname } from "./dns-resolver";
import {
  isBlockedUrlSync,
  isIpLiteral,
  isBlockedIPv4,
  isBlockedIPv6,
} from "./url-guard-core";

// Re-export core sync validation for backward compatibility
export { isBlockedUrlSync };

/**
 * SSRF protection: validates whether a URL should be blocked due to pointing to internal/private addresses.
 * Performs both string-based pattern matching and DNS resolution to detect DNS rebinding attacks.
 * SECURITY-CRITICAL: Always call this before following user-provided URLs to prevent Server-Side Request Forgery attacks.
 * Blocks: localhost, loopback (127.0.0.0/8), private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16),
 * link-local (169.254.0.0/16), cloud metadata (AWS 169.254.169.254), IPv6 equivalent ranges, unparseable URLs,
 * and hostnames that resolve to private/internal IPs via DNS.
 *
 * For callers that need synchronous validation (e.g., Zod schemas), use {@link isBlockedUrlSync}.
 *
 * @param rawUrl - URL string to validate (must be parseable as URL)
 * @returns True if URL is blocked/internal and unsafe to access, false if URL is safe for external access
 */
export async function isBlockedUrl(rawUrl: string): Promise<boolean> {
  // Fast path: sync string-based checks first
  if (isBlockedUrlSync(rawUrl)) return true;

  // DNS resolution for hostnames that passed string checks
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return true;
  }

  const hostname = parsed.hostname.toLowerCase();

  // Skip DNS for IP literals — sync checks already determined they're public
  if (isIpLiteral(hostname)) return false;

  // If internal access is explicitly allowed, skip DNS resolution too
  if (process.env.NEXT_PUBLIC_ALLOW_PRIVATE_NETWORK_MCP === "true") {
    return false;
  }

  try {
    const addresses = await resolveHostnameWithTimeout(hostname);
    for (const addr of addresses) {
      if (isBlockedIPv4(addr) || isBlockedIPv6(addr)) return true;
    }
    return false;
  } catch {
    // DNS resolution failed (timeout, NXDOMAIN, network error) — block for safety
    return true;
  }
}

/**
 * Resolves a hostname via DNS with a 5-second timeout.
 * Tries both IPv4 and IPv6 records and returns all resolved addresses.
 * Throws if no addresses could be resolved.
 */
async function resolveHostnameWithTimeout(hostname: string): Promise<string[]> {
  return Promise.race([
    resolveHostname(hostname),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("DNS resolution timed out")), 5000),
    ),
  ]);
}
