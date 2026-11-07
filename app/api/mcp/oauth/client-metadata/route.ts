import { NextResponse } from "next/server";

/**
 * Public endpoint serving Client ID Metadata Document (CIMD / RFC 7591).
 * Allows OAuth authorization servers supporting CIMD to verify client identity,
 * callback URIs, and supported grant types without manual client pre-registration.
 *
 * @author Maruf Bepary
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const baseUrl = process.env.BETTER_AUTH_URL || `${url.protocol}//${url.host}`;
  const redirectUri = new URL("/api/mcp/oauth/callback", baseUrl).toString();
  const clientUri = new URL(
    "/api/mcp/oauth/client-metadata",
    baseUrl,
  ).toString();

  const metadata = {
    client_name: "Antigravity AI Client",
    client_uri: clientUri,
    redirect_uris: [redirectUri],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "client_secret_post",
  };

  return NextResponse.json(metadata, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
