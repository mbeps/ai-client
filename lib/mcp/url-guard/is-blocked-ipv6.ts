import { isBlockedIPv4 } from "./is-blocked-ipv4";

/**
 * Checks whether an IPv6 address is in a blocked/private range.
 *
 * @param ip - IPv6 address string without brackets (e.g., "::1", "fe80::1")
 * @returns True if IP is in a blocked range, false if public
 */
export function isBlockedIPv6(ip: string): boolean {
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
    if (!Number.isNaN(val) && (val & 0xfe00) === 0xfc00) return true;
  }

  return false;
}
