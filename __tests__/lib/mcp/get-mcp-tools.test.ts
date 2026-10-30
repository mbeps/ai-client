import { describe, expect, it, vi } from "vitest";
import { getMcpTools } from "@/lib/mcp/get-mcp-tools";
import type { McpServerConfig } from "@/types/mcp/mcp-server-config";

const connectServerMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/mcp/connect-server", () => ({
  connectServer: connectServerMock,
}));

describe("getMcpTools", () => {
  it("connects to multiple servers, merges tools, handles collisions, and provides cleanup", async () => {
    const close1 = vi.fn().mockResolvedValue(undefined);
    const close2 = vi.fn().mockResolvedValue(undefined);

    connectServerMock.mockImplementation(async (server: McpServerConfig) => {
      if (server.id === "s1") {
        return {
          serverId: "s1",
          serverName: "server-1",
          tools: {
            toolA: { description: "Tool A" },
            toolCommon: { description: "Server 1 Common" },
          },
          close: close1,
        };
      }
      if (server.id === "s2") {
        return {
          serverId: "s2",
          serverName: "server-2",
          tools: {
            toolB: { description: "Tool B" },
            toolCommon: { description: "Server 2 Common (conflict)" },
          },
          close: close2,
        };
      }
      throw new Error("Server 3 connection failed");
    });

    const servers = [
      { id: "s1", name: "server-1" },
      { id: "s2", name: "server-2" },
      { id: "s3", name: "server-3" },
    ] as McpServerConfig[];

    const { tools, toolSourceMap, toolServerIdMap, cleanup } = await getMcpTools(servers);

    expect(Object.keys(tools)).toEqual(["toolA", "toolCommon", "toolB"]);
    expect(tools.toolCommon.description).toBe("Server 1 Common");
    expect(toolSourceMap).toEqual({
      toolA: "server-1",
      toolCommon: "server-1",
      toolB: "server-2",
    });
    expect(toolServerIdMap).toEqual({
      toolA: "s1",
      toolCommon: "s1",
      toolB: "s2",
    });

    await cleanup();
    expect(close1).toHaveBeenCalled();
    expect(close2).toHaveBeenCalled();
  });

  it("handles non-Error rejection reasons during connectServer", async () => {
    connectServerMock.mockRejectedValueOnce("Plain string rejection error");

    const servers = [{ id: "s4", name: "server-4" }] as McpServerConfig[];

    const { tools, toolSourceMap, cleanup } = await getMcpTools(servers);

    expect(tools).toEqual({});
    expect(toolSourceMap).toEqual({});

    await cleanup();
  });

  it("filters per-server when selectedTools is provided so unselected tool on server 1 does not block selected tool on server 2", async () => {
    connectServerMock.mockImplementation(async (server: McpServerConfig) => {
      if (server.id === "s1") {
        return {
          serverId: "s1",
          serverName: "server-1",
          tools: {
            duplicateTool: { description: "Server 1 Duplicate (unselected)" },
          },
          close: vi.fn(),
        };
      }
      if (server.id === "s2") {
        return {
          serverId: "s2",
          serverName: "server-2",
          tools: {
            duplicateTool: { description: "Server 2 Duplicate (selected)" },
          },
          close: vi.fn(),
        };
      }
      throw new Error("Unknown server");
    });

    const servers = [
      { id: "s1", name: "server-1" },
      { id: "s2", name: "server-2" },
    ] as McpServerConfig[];

    // Only server-2's duplicateTool is selected
    const selectedTools = ["s2:tool:duplicateTool"];
    const { tools, toolSourceMap, toolServerIdMap } = await getMcpTools(
      servers,
      selectedTools,
    );

    expect(tools.duplicateTool).toBeDefined();
    expect(tools.duplicateTool.description).toBe("Server 2 Duplicate (selected)");
    expect(toolSourceMap.duplicateTool).toBe("server-2");
    expect(toolServerIdMap.duplicateTool).toBe("s2");
  });
});

