import { describe, expect, it, vi } from "vitest";
import { discoverToolsAndResources } from "@/lib/mcp/discover-tools-and-resources";

const withMcpServerMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/mcp/with-mcp-server", () => ({
  withMcpServer: withMcpServerMock,
}));

const withTimeoutMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/mcp/with-timeout", () => ({
  withTimeout: withTimeoutMock,
}));

describe("discoverToolsAndResources", () => {
  it("discovers tools, resources, resource templates, and prompts successfully", async () => {
    withMcpServerMock.mockImplementation(async (config, cb) => {
      const client = {
        listTools: vi.fn(),
        listResources: vi.fn(),
        listResourceTemplates: vi.fn(),
        experimental_listPrompts: vi.fn(),
      };
      return cb(client);
    });

    withTimeoutMock
      .mockResolvedValueOnce({
        tools: [
          { name: "t1", description: "Tool 1", inputSchema: {} },
          { name: "t2", inputSchema: {} },
        ],
        nextCursor: "cursor-1",
      })
      .mockResolvedValueOnce({
        tools: [{ name: "t3", description: "Tool 3", inputSchema: {} }],
        nextCursor: undefined,
      })
      .mockResolvedValueOnce({
        resources: [
          { uri: "res://1", name: "Res 1" },
          { uri: "res://2", name: "Res 2", description: "Desc 2", mimeType: "text/plain" },
        ],
        nextCursor: "res-cursor-1",
      })
      .mockResolvedValueOnce({
        resources: undefined,
        nextCursor: undefined,
      })
      .mockResolvedValueOnce({
        resourceTemplates: [
          { uriTemplate: "res://{id}", name: "Template 1" },
          { uriTemplate: "res://{id2}", name: "Template 2", description: "Tmpl 2", mimeType: "application/json" },
        ],
      })
      .mockResolvedValueOnce({
        prompts: [
          {
            name: "p1",
            description: "Prompt 1",
            arguments: [
              { name: "arg1", description: "Arg 1", required: true },
              { name: "arg2" },
            ],
          },
          { name: "p2" },
        ],
        nextCursor: "prompt-cursor-1",
      })
      .mockResolvedValueOnce({
        prompts: undefined,
        nextCursor: undefined,
      });

    const result = await discoverToolsAndResources({ id: "s1", name: "Server" } as any);

    expect(result.tools).toHaveLength(3);
    expect(result.tools[1].description).toBe("");
    expect(result.resources).toHaveLength(4);
    expect(result.resources[0].description).toBe("");
    expect(result.resources[2].description).toBe("Resource Template");
    expect(result.prompts).toHaveLength(2);
    expect(result.prompts[0].arguments?.[1].description).toBe("");
    expect(result.prompts[0].arguments?.[1].required).toBe(false);
    expect(result.prompts[1].description).toBe("");
    expect(result.prompts[1].arguments).toBeUndefined();
  });

  it("handles server not supporting capabilities gracefully with Method not found / Server does not support", async () => {
    withMcpServerMock.mockImplementation(async (config, cb) => {
      const client = {
        listTools: vi.fn(),
        listResources: vi.fn(),
        listResourceTemplates: vi.fn(),
        experimental_listPrompts: vi.fn(),
      };
      return cb(client as any);
    });

    withTimeoutMock
      .mockRejectedValueOnce(new Error("Server does not support tools"))
      .mockRejectedValueOnce(new Error("Method not found"))
      .mockRejectedValueOnce(new Error("Server does not support resources"))
      .mockRejectedValueOnce(new Error("Server does not support prompts"));

    const result = await discoverToolsAndResources({ id: "s1", name: "Server" } as any);
    expect(result).toEqual({ tools: [], resources: [], prompts: [] });
  });

  it("handles generic unexpected errors for all discovery steps", async () => {
    withMcpServerMock.mockImplementation(async (config, cb) => {
      const client = {
        listTools: vi.fn(),
        listResources: vi.fn(),
        listResourceTemplates: vi.fn(),
        experimental_listPrompts: vi.fn(),
      };
      return cb(client as any);
    });

    withTimeoutMock
      .mockRejectedValueOnce("Network timeout string")
      .mockRejectedValueOnce("Socket hangup string")
      .mockRejectedValueOnce("String error in resource templates")
      .mockRejectedValueOnce("Prompt crash string");

    const result = await discoverToolsAndResources({ id: "s1", name: "Server" } as any);
    expect(result).toEqual({ tools: [], resources: [], prompts: [] });
  });

  it("handles resourceTemplates result without resourceTemplates field", async () => {
    withMcpServerMock.mockImplementation(async (config, cb) => {
      const client = {
        listTools: vi.fn(),
        listResources: vi.fn(),
        listResourceTemplates: vi.fn(),
        experimental_listPrompts: vi.fn(),
      };
      return cb(client as any);
    });

    withTimeoutMock
      .mockResolvedValueOnce({ tools: [] })
      .mockResolvedValueOnce({ resources: [] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ prompts: [] });

    const result = await discoverToolsAndResources({ id: "s1", name: "Server" } as any);
    expect(result).toEqual({ tools: [], resources: [], prompts: [] });
  });
});
