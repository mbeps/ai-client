import { describe, expect, it, vi } from "vitest";
import { connectServer } from "@/lib/mcp/connect-server";

const createConnectedClientMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/mcp/create-connected-client", () => ({
  createConnectedClient: createConnectedClientMock,
}));

const withTimeoutMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/mcp/with-timeout", () => ({
  withTimeout: withTimeoutMock,
}));

describe("connectServer", () => {
  it("connects successfully and returns connection object with tools and close fn", async () => {
    const closeMock = vi.fn().mockResolvedValue(undefined);
    const clientMock = {
      tools: vi.fn(),
      close: closeMock,
    };
    createConnectedClientMock.mockResolvedValue(clientMock);

    const tools = { toolA: { description: "A" } };
    withTimeoutMock.mockResolvedValue(tools);

    const serverConfig = { id: "srv-1", name: "Test Server", url: "http://localhost" };
    const connection = await connectServer(serverConfig as any);

    expect(connection).toMatchObject({
      serverId: "srv-1",
      serverName: "Test Server",
      tools,
    });

    await connection.close();
    expect(closeMock).toHaveBeenCalledOnce();
  });

  it("closes client and rethrows when tool discovery times out or fails (even if close rejects)", async () => {
    const closeMock = vi.fn().mockRejectedValue(new Error("Close error"));
    const clientMock = {
      tools: vi.fn(),
      close: closeMock,
    };
    createConnectedClientMock.mockResolvedValue(clientMock);
    withTimeoutMock.mockRejectedValue(new Error("Timeout"));

    const serverConfig = { id: "srv-1", name: "Test Server", url: "http://localhost" };

    await expect(connectServer(serverConfig as any)).rejects.toThrow("Timeout");
    expect(closeMock).toHaveBeenCalledOnce();
  });
});
