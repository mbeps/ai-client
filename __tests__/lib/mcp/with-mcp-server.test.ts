import { describe, expect, it, vi } from "vitest";
import { withMcpServer } from "@/lib/mcp/with-mcp-server";

const createConnectedClientMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/mcp/create-connected-client", () => ({
  createConnectedClient: createConnectedClientMock,
}));

describe("withMcpServer", () => {
  it("executes callback with connected client and closes client in finally block", async () => {
    const closeMock = vi.fn().mockResolvedValue(undefined);
    const clientMock = { close: closeMock };
    createConnectedClientMock.mockResolvedValue(clientMock);

    const cb = vi.fn().mockResolvedValue("success-result");

    const result = await withMcpServer({ id: "s1" } as any, cb);

    expect(result).toBe("success-result");
    expect(cb).toHaveBeenCalledWith(clientMock);
    expect(closeMock).toHaveBeenCalledOnce();
  });

  it("closes client even if callback throws an error", async () => {
    const closeMock = vi.fn().mockResolvedValue(undefined);
    const clientMock = { close: closeMock };
    createConnectedClientMock.mockResolvedValue(clientMock);

    const cb = vi.fn().mockRejectedValue(new Error("Callback error"));

    await expect(withMcpServer({ id: "s1" } as any, cb)).rejects.toThrow("Callback error");
    expect(closeMock).toHaveBeenCalledOnce();
  });

  it("handles client.close() rejection gracefully", async () => {
    const closeMock = vi.fn().mockRejectedValue(new Error("Close failed"));
    const clientMock = { close: closeMock };
    createConnectedClientMock.mockResolvedValue(clientMock);

    const cb = vi.fn().mockResolvedValue("done");

    const result = await withMcpServer({ id: "s1" } as any, cb);
    expect(result).toBe("done");
    expect(closeMock).toHaveBeenCalledOnce();
  });

  it("handles createConnectedClient throwing before client is initialized", async () => {
    createConnectedClientMock.mockRejectedValue(new Error("Connect failed"));

    const cb = vi.fn();

    await expect(withMcpServer({ id: "s1" } as any, cb)).rejects.toThrow("Connect failed");
    expect(cb).not.toHaveBeenCalled();
  });
});
