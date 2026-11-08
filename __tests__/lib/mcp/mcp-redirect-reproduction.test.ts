import { describe, expect, it, vi } from "vitest";

const isBlockedUrlMock = vi.hoisted(() => vi.fn().mockResolvedValue(false));
vi.mock("@/lib/mcp/url-guard/is-blocked-url", () => ({
  isBlockedUrl: isBlockedUrlMock,
}));

import { buildTransport } from "@/lib/mcp/build-transport";
import { McpOAuthProvider } from "@/lib/mcp/oauth/mcp-oauth-provider";
import { safeMcpFetch } from "@/lib/mcp/safe-mcp-fetch";
import { auth, createMCPClient } from "@ai-sdk/mcp";

describe("MCP redirect bug reproduction", () => {
  it("sanitizes cross-origin resource_metadata from WWW-Authenticate on redirected 401s in safeMcpFetch", async () => {
    isBlockedUrlMock.mockResolvedValue(false);

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr === "https://hf.co/mcp") {
          return new Response(null, {
            status: 307,
            headers: { location: "https://huggingface.co/mcp" },
          });
        }
        if (urlStr === "https://huggingface.co/mcp") {
          return new Response("Unauthorized", {
            status: 401,
            headers: {
              "www-authenticate":
                'Bearer error="invalid_token", resource_metadata="https://huggingface.co/.well-known/oauth-protected-resource/mcp", scope="read"',
            },
          });
        }
        return new Response("Not Found", { status: 404 });
      });

    try {
      const res = await safeMcpFetch("https://hf.co/mcp");
      expect(res.status).toBe(401);
      const authHeader = res.headers.get("www-authenticate");
      expect(authHeader).toBeDefined();
      expect(authHeader).not.toContain("resource_metadata");
      expect(authHeader).toContain('error="invalid_token"');
      expect(authHeader).toContain('scope="read"');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("preserves same-origin resource_metadata in WWW-Authenticate on 401 in safeMcpFetch", async () => {
    isBlockedUrlMock.mockResolvedValue(false);

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr === "https://huggingface.co/mcp") {
          return new Response("Unauthorized", {
            status: 401,
            headers: {
              "www-authenticate":
                'Bearer resource_metadata="https://huggingface.co/.well-known/oauth-protected-resource/mcp"',
            },
          });
        }
        return new Response("Not Found", { status: 404 });
      });

    try {
      const res = await safeMcpFetch("https://huggingface.co/mcp");
      expect(res.status).toBe(401);
      const authHeader = res.headers.get("www-authenticate");
      expect(authHeader).toContain("resource_metadata=");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("completes OAuth auth() flow when MCP server redirects to different origin", async () => {
    isBlockedUrlMock.mockResolvedValue(false);

    const mockDb: any = {
      query: {
        mcpOAuthCredential: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue([{ id: "cred-1" }]),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: "cred-1" }]),
      }),
    };

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url) => {
        const urlStr = String(url);
        // Short URL redirect
        if (
          urlStr === "https://hf.co/mcp" ||
          urlStr === "https://hf.co/.well-known/oauth-protected-resource/mcp"
        ) {
          return new Response(null, {
            status: 307,
            headers: {
              location:
                "https://huggingface.co/.well-known/oauth-protected-resource/mcp",
            },
          });
        }

        if (
          urlStr ===
          "https://huggingface.co/.well-known/oauth-protected-resource/mcp"
        ) {
          return new Response(
            JSON.stringify({
              resource: "https://huggingface.co/mcp",
              authorization_servers: ["https://huggingface.co"],
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }

        if (
          urlStr ===
            "https://huggingface.co/.well-known/oauth-authorization-server" ||
          urlStr ===
            "https://huggingface.co/.well-known/openid-configuration"
        ) {
          return new Response(
            JSON.stringify({
              issuer: "https://huggingface.co",
              authorization_endpoint: "https://huggingface.co/oauth/authorize",
              token_endpoint: "https://huggingface.co/oauth/token",
              response_types_supported: ["code"],
              code_challenge_methods_supported: ["S256"],
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }

        return new Response("Not Found", { status: 404 });
      });

    try {
      const provider = new McpOAuthProvider({
        server: {
          id: "hf-server",
          name: "Hugging Face",
          url: "https://hf.co/mcp",
          authType: "oauth",
          oauthClientId: "hf-client-id",
          oauthClientSecret: "hf-client-secret",
        },
        userId: "user-1",
        db: mockDb,
      });

      const authResult = await auth(provider, {
        serverUrl: "https://hf.co/mcp",
        fetchFn: safeMcpFetch,
      });

      expect(authResult).toBe("REDIRECT");
      expect(provider.lastAuthorizationUrl).toBeDefined();
      expect(provider.lastAuthorizationUrl?.origin).toBe("https://huggingface.co");
      expect(provider.lastAuthorizationUrl?.searchParams.get("resource")).toBe(
        "https://huggingface.co/mcp",
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });
  it("fails to connect to redirecting MCP server with current transport", async () => {
    isBlockedUrlMock.mockResolvedValue(false);

    // Mock fetch that simulates a 308 redirect followed by standard 200 response
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url, init) => {
        const urlStr = String(url);
        if (urlStr === "https://redirect.example.com/api/mcp") {
          if (init?.redirect === "error") {
            const err = new TypeError("fetch failed");
            (err as any).cause = new Error("unexpected redirect");
            throw err;
          }
          return new Response(null, {
            status: 308,
            headers: { location: "https://destination.example.com/api/mcp" },
          });
        }

        const body = init?.body ? JSON.parse(String(init.body)) : null;
        const id = body?.id ?? 1;

        if (body?.method === "tools/list") {
          return new Response(
            `event: message\ndata: ${JSON.stringify({
              result: {
                tools: [
                  {
                    name: "my_tool",
                    description: "test tool",
                    inputSchema: { type: "object" },
                  },
                ],
              },
              jsonrpc: "2.0",
              id,
            })}\n\n`,
            {
              status: 200,
              headers: { "content-type": "text/event-stream" },
            },
          );
        }

        return new Response(
          `event: message\ndata: ${JSON.stringify({
            result: {
              protocolVersion: "2024-11-05",
              capabilities: { tools: {} },
              serverInfo: { name: "test", version: "1.0.0" },
            },
            jsonrpc: "2.0",
            id,
          })}\n\n`,
          {
            status: 200,
            headers: { "content-type": "text/event-stream" },
          },
        );
      });

    try {
      const transportRes = await buildTransport({
        id: "srv-redir",
        name: "Redirecting MCP",
        url: "https://redirect.example.com/api/mcp",
      });

      expect(transportRes.ok).toBe(true);
      if (!transportRes.ok) return;

      const client = await createMCPClient({ transport: transportRes.value });
      await client.tools();
      await client.close();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
