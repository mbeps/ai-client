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

  it("wraps tool execute function with timeout and supports parent abortSignal", async () => {
    const rawExecuteMock = vi.fn().mockResolvedValue({ content: [{ type: "text", text: "ok" }] });
    const rawTools = {
      calculator: {
        description: "Calculate math",
        execute: rawExecuteMock,
      },
      passiveTool: {
        description: "Static tool without execute",
      },
    };

    const clientMock = {
      tools: vi.fn().mockResolvedValue(rawTools),
      close: vi.fn().mockResolvedValue(undefined),
    };
    createConnectedClientMock.mockResolvedValue(clientMock);
    withTimeoutMock.mockImplementation((promise: any) => promise);

    const serverConfig = { id: "srv-1", name: "Test Server", url: "http://localhost" };
    const connection = await connectServer(serverConfig as any);

    expect(connection.tools.passiveTool).toEqual(rawTools.passiveTool);
    expect(connection.tools.calculator.execute).toBeTypeOf("function");

    // Execute without abortSignal
    const result1 = await connection.tools.calculator.execute({ expr: "1+1" });
    expect(result1).toEqual({ content: [{ type: "text", text: "ok" }] });
    expect(rawExecuteMock).toHaveBeenCalledWith(
      { expr: "1+1" },
      expect.objectContaining({ abortSignal: expect.any(AbortSignal) }),
    );

    // Execute with parent abortSignal
    const controller = new AbortController();
    await connection.tools.calculator.execute({ expr: "2+2" }, { abortSignal: controller.signal });
    expect(rawExecuteMock).toHaveBeenCalledWith(
      { expr: "2+2" },
      expect.objectContaining({ abortSignal: expect.any(AbortSignal) }),
    );
  });

  it("returns async iterable directly when tool execute returns an async iterable", async () => {
    async function* generateStream() {
      yield { content: [{ type: "text", text: "chunk" }] };
    }
    const streamingExecuteMock = vi.fn().mockReturnValue(generateStream());
    const rawTools = {
      streamer: {
        description: "Streaming tool",
        execute: streamingExecuteMock,
      },
    };

    const clientMock = {
      tools: vi.fn().mockResolvedValue(rawTools),
      close: vi.fn().mockResolvedValue(undefined),
    };
    createConnectedClientMock.mockResolvedValue(clientMock);
    withTimeoutMock.mockImplementation((promise: any) => promise);

    const serverConfig = { id: "srv-1", name: "Test Server", url: "http://localhost" };
    const connection = await connectServer(serverConfig as any);

    const streamResult = await connection.tools.streamer.execute({});
    expect(streamResult[Symbol.asyncIterator]).toBeTypeOf("function");
  });
});
