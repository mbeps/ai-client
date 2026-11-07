import { describe, expect, it } from "vitest";
import { decrypt } from "@/lib/encryption/decrypt";
import { buildServerConfig } from "@/lib/mcp/build-server-config";

describe("buildServerConfig", () => {
  it("builds config with provided values and encrypts headers", () => {
    const config = buildServerConfig({
      name: "Server 1",
      url: "http://localhost:3000/sse",
      headers: '{"Authorization":"Bearer 123"}',
      isPublic: true,
    });

    expect(config.name).toBe("Server 1");
    expect(config.url).toBe("http://localhost:3000/sse");
    expect(config.isPublic).toBe(true);
    expect(decrypt(config.headers!)).toBe('{"Authorization":"Bearer 123"}');
  });

  it("handles empty headers and undefined isPublic with fallbacks", () => {
    const config = buildServerConfig({
      name: "Server 2",
      url: "http://localhost:3000/sse",
      headers: "",
      isPublic: undefined,
    });

    expect(config).toEqual({
      name: "Server 2",
      url: "http://localhost:3000/sse",
      headers: null,
      isPublic: false,
      authType: "none",
      oauthClientId: null,
      oauthClientSecret: null,
      oauthScope: null,
    });
  });

  it("handles falsy headers and explicit false isPublic", () => {
    const config = buildServerConfig({
      name: "Server 3",
      url: "http://localhost:3000/sse",
      headers: null as any,
      isPublic: false,
    });

    expect(config).toEqual({
      name: "Server 3",
      url: "http://localhost:3000/sse",
      headers: null,
      isPublic: false,
      authType: "none",
      oauthClientId: null,
      oauthClientSecret: null,
      oauthScope: null,
    });
  });

  it("handles oauth authType and encrypts oauthClientSecret", () => {
    const config = buildServerConfig({
      name: "OAuth Server",
      url: "https://example.com/sse",
      authType: "oauth",
      oauthClientId: "client-123",
      oauthClientSecret: "secret-abc",
      oauthScope: "openid email",
    });

    expect(config.authType).toBe("oauth");
    expect(config.oauthClientId).toBe("client-123");
    expect(config.oauthScope).toBe("openid email");
    expect(decrypt(config.oauthClientSecret!)).toBe("secret-abc");
  });
});

