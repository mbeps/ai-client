/**
 * Thin wrapper around Node.js DNS resolution.
 * Uses dynamic import to avoid build-time errors in browser/edge runtimes.
 * Always gracefully falls back to no-resolution if DNS is unavailable.
 *
 * @param hostname - Hostname to resolve (e.g., "example.com")
 * @returns Array of resolved IPv4 and IPv6 address strings (empty if DNS unavailable)
 */
export async function resolveHostname(hostname: string): Promise<string[]> {
  let dns: (typeof import("dns"))["promises"];
  try {
    dns = (await import("dns")).promises;
  } catch {
    // DNS module unavailable (browser/edge runtime) — return empty
    return [];
  }

  const [v4Addresses, v6Addresses] = await Promise.allSettled([
    dns.resolve4(hostname),
    dns.resolve6(hostname),
  ]);

  const addresses: string[] = [];
  if (v4Addresses.status === "fulfilled") addresses.push(...v4Addresses.value);
  if (v6Addresses.status === "fulfilled") addresses.push(...v6Addresses.value);

  return addresses;
}
