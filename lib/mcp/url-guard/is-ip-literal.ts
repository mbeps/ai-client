/**
 * Checks whether a hostname is an IP literal (IPv4 or IPv6).
 */
export function isIpLiteral(hostname: string): boolean {
  // IPv6 literal (with brackets, as parsed by URL)
  if (hostname.startsWith("[") && hostname.endsWith("]")) return true;
  // IPv4 literal
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
}
