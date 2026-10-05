import { isBlockedIPv4 } from "./is-blocked-ipv4";

/**
 * Checks whether an IPv6 address is in a blocked/private range.
 *
 * @param ip - IPv6 address string without brackets (e.g., "::1", "fe80::1")
 * @returns True if IP is in a blocked range, false if public
 */
export function isBlockedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // :: unspecified address (RFC 4291)
  const groups = normalized.split(":");
  if (
    normalized === "::" ||
    (groups.length > 1 &&
      groups.every((g) => g === "" || parseInt(g, 16) === 0))
  ) {
    return true;
  }

  // ::1 loopback
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;

  // ::ffff:x.x.x.x or ::ffff:hhhh:hhhh — IPv4-mapped IPv6: extract IPv4 part and validate
  if (
    normalized.startsWith("::ffff:") ||
    normalized.startsWith("0:0:0:0:0:ffff:")
  ) {
    const tail = normalized.startsWith("::ffff:")
      ? normalized.slice(7)
      : normalized.slice(15);

    if (isBlockedIPv4(tail)) return true;

    // The WHATWG URL parser normalises dotted-decimal to two hex groups (e.g. ::ffff:7f00:1)
    const hexGroups = tail.split(":");
    if (hexGroups.length === 2) {
      const high = parseInt(hexGroups[0] ?? "", 16);
      const low = parseInt(hexGroups[1] ?? "", 16);
      if (
        !Number.isNaN(high) &&
        !Number.isNaN(low) &&
        high >= 0 &&
        high <= 0xffff &&
        low >= 0 &&
        low <= 0xffff
      ) {
        const reconstructed = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
        if (isBlockedIPv4(reconstructed)) return true;
      }
    }
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
