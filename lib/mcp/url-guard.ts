import { resolveHostname } from "./dns-resolver";

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
 * Sync-only SSRF guard for use in contexts that cannot await (e.g., Zod refinements).
 * Performs the same string-based pattern matching as {@link isBlockedUrl} but skips DNS resolution.
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
  // SECURITY: Access process.env directly instead of importing @/lib/env to prevent
  // leaking server-side environment variable validation to the client bundle.
  if (process.env.NEXT_PUBLIC_ALLOW_PRIVATE_NETWORK_MCP === "true") {
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

/**
 * Checks whether a hostname is an IP literal (IPv4 or IPv6).
 * If it is, DNS resolution is unnecessary — the sync checks already handled it.
 */
function isIpLiteral(hostname: string): boolean {
  // IPv6 literal (with brackets, as parsed by URL)
  if (hostname.startsWith("[") && hostname.endsWith("]")) return true;
  // IPv4 literal
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
}

/**
 * Checks whether an IPv4 address is in a blocked/private range.
 * SECURITY: Validates all RFC 1918 private ranges, loopback, link-local, and cloud metadata endpoints.
 * Helper function for isBlockedUrl().
 *
 * @param ip - IPv4 address string to check (e.g., "192.168.1.1")
 * @returns True if IP is in a blocked range (loopback, private, link-local, cloud metadata), false if public
 */
function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;

  const octets = parts.map(Number);
  if (octets.some((o) => isNaN(o) || o < 0 || o > 255)) return false;

  // 127.0.0.0/8 — loopback
  if (octets[0] === 127) return true;
  // 10.0.0.0/8 — private
  if (octets[0] === 10) return true;
  // 172.16.0.0/12 — private
  if (
    octets[0] === 172 &&
    octets[1] !== undefined &&
    octets[1] >= 16 &&
    octets[1] <= 31
  )
    return true;
  // 192.168.0.0/16 — private
  if (octets[0] === 192 && octets[1] === 168) return true;
  // 169.254.0.0/16 — link-local / cloud metadata (AWS: 169.254.169.254)
  if (octets[0] === 169 && octets[1] === 254) return true;
  // 0.0.0.0 — unspecified address
  if (octets[0] === 0 && octets[1] === 0 && octets[2] === 0 && octets[3] === 0)
    return true;

  return false;
}

/**
 * Checks whether an IPv6 address is in a blocked/private range.
 * SECURITY: Validates loopback (::1), link-local (fe80::/10), ULA (fc00::/7), and IPv4-mapped IPv6.
 * Helper function for isBlockedUrl().
 *
 * @param ip - IPv6 address string without brackets (e.g., "::1", "fe80::1")
 * @returns True if IP is in a blocked range, false if public
 */
function isBlockedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // ::1 loopback
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;

  // ::ffff:x.x.x.x — IPv4-mapped IPv6: extract IPv4 part and validate
  if (normalized.startsWith("::ffff:")) {
    const ipv4Part = normalized.slice(7);
    if (isBlockedIPv4(ipv4Part)) return true;
  }

  // fe80::/10 — link-local IPv6
  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  )
    return true;

  // fc00::/7 — first 16-bit group is fc__ or fd__
  const firstGroup = normalized.split(":")[0] ?? "";
  if (firstGroup.length > 0) {
    const val = parseInt(firstGroup, 16);
    if (!isNaN(val) && (val & 0xfe00) === 0xfc00) return true;
  }

  return false;
}
