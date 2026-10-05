import { beforeEach, describe, expect, it, vi } from "vitest";

const buildTransportMock = vi.hoisted(() => vi.fn());
const createMCPClientMock = vi.hoisted(() => vi.fn());
const withTimeoutMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/mcp/build-transport", () => ({
  buildTransport: buildTransportMock,
}));

vi.mock("@ai-sdk/mcp", () => ({
  createMCPClient: createMCPClientMock,
}));

vi.mock("@/lib/mcp/with-timeout", () => ({
  withTimeout: withTimeoutMock,
}));

import { createConnectedClient } from "@/lib/mcp/create-connected-client";
import type { McpServerConfig } from "@/types/mcp/mcp-server-config";

describe("createConnectedClient", () => {
  const server: McpServerConfig = {
    id: "srv-1",
    name: "Weather Server",
    url: "https://weather.example.com",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds transport and creates client with default label", async () => {
    const mockTransport = { type: "sse" };
    const mockClientPromise = Promise.resolve({ close: vi.fn() });
    const mockClient = { close: vi.fn() };

    buildTransportMock.mockResolvedValueOnce(mockTransport);
    createMCPClientMock.mockReturnValueOnce(mockClientPromise);
    withTimeoutMock.mockResolvedValueOnce(mockClient);

    const result = await createConnectedClient(server);

    expect(buildTransportMock).toHaveBeenCalledWith(server);
    expect(createMCPClientMock).toHaveBeenCalledWith({
      transport: mockTransport,
      onUncaughtError: expect.any(Function),
    });
    expect(withTimeoutMock).toHaveBeenCalledWith(
      mockClientPromise,
      expect.any(Number),
      "connect to Weather Server",
    );
    expect(result).toBe(mockClient);
  });

  it("handles uncaught errors through onUncaughtError callback", async () => {
    const mockTransport = { type: "sse" };
    buildTransportMock.mockResolvedValueOnce(mockTransport);
    createMCPClientMock.mockReturnValueOnce(Promise.resolve({}));
    withTimeoutMock.mockResolvedValueOnce({});

    await createConnectedClient(server);

    const clientCall = createMCPClientMock.mock.calls[0][0];
    expect(clientCall.onUncaughtError).toBeTypeOf("function");

    // Invoke with Error instance and non-Error instance
    clientCall.onUncaughtError(new Error("Stream terminated abruptly"));
    clientCall.onUncaughtError("Raw string failure");
  });

  it("uses custom label when provided", async () => {
    const mockTransport = { type: "sse" };
    const mockClientPromise = Promise.resolve({});

    buildTransportMock.mockResolvedValueOnce(mockTransport);
    createMCPClientMock.mockReturnValueOnce(mockClientPromise);
    withTimeoutMock.mockResolvedValueOnce({});

    await createConnectedClient(server, "custom-connect-label");

    expect(withTimeoutMock).toHaveBeenCalledWith(
      mockClientPromise,
      expect.any(Number),
      "custom-connect-label",
    );
  });
});

