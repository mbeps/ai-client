import { describe, expect, it, vi } from "vitest";

const isBlockedUrlMock = vi.hoisted(() => vi.fn().mockResolvedValue(false));
vi.mock("@/lib/mcp/url-guard/is-blocked-url", () => ({
  isBlockedUrl: isBlockedUrlMock,
}));

import { buildTransport } from "@/lib/mcp/build-transport";
import { createMCPClient } from "@ai-sdk/mcp";

describe("MCP redirect bug reproduction", () => {
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
      const transport = await buildTransport({
        id: "srv-redir",
        name: "Redirecting MCP",
        url: "https://redirect.example.com/api/mcp",
      });

      const client = await createMCPClient({ transport });
      await client.tools();
      await client.close();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
