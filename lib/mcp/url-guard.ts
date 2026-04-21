/**
 * SSRF protection: checks if a URL points to a blocked/internal address.
 * Returns true if the URL should be blocked.
 */
export function isBlockedUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return true; // unparseable URLs are blocked
  }

  const hostname = parsed.hostname.toLowerCase();

  if (hostname === "localhost") return true;

  // IPv6 literal — hostname includes brackets, e.g. "[::1]"
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return isBlockedIPv6(hostname.slice(1, -1));
  }

  return isBlockedIPv4(hostname);
}

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
