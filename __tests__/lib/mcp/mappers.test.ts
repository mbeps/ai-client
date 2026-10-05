import { describe, expect, it } from "vitest";
import { mcpServerRowToConfig } from "@/lib/mcp/mappers";

describe("mcpServerRowToConfig", () => {
  it("maps McpServerRow to McpServerConfig correctly", () => {
    const row = {
      id: "uuid-1",
      userId: "user-1",
      name: "My MCP",
      url: "http://localhost:3000/sse",
      headers: { Authorization: "Bearer tok" },
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const config = mcpServerRowToConfig(row);

    expect(config).toEqual({
      id: "uuid-1",
      name: "My MCP",
      url: "http://localhost:3000/sse",
      headers: { Authorization: "Bearer tok" },
    });
  });
});
