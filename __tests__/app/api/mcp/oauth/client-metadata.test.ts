import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/mcp/oauth/client-metadata/route";

describe("GET /api/mcp/oauth/client-metadata", () => {
  it("returns CIMD metadata with valid redirect URIs and grant types", async () => {
    const req = new Request("http://localhost:3000/api/mcp/oauth/client-metadata");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.client_name).toBe("Antigravity AI Client");
    expect(json.grant_types).toContain("authorization_code");
    expect(json.grant_types).toContain("refresh_token");
    expect(json.redirect_uris[0]).toContain("/api/mcp/oauth/callback");
  });

  it("falls back to request origin when BETTER_AUTH_URL is unset", async () => {
    const prev = process.env.BETTER_AUTH_URL;
    delete process.env.BETTER_AUTH_URL;
    try {
      const req = new Request("https://example.com/api/mcp/oauth/client-metadata");
      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.client_uri).toBe("https://example.com/api/mcp/oauth/client-metadata");
    } finally {
      if (prev !== undefined) process.env.BETTER_AUTH_URL = prev;
    }
  });
});
