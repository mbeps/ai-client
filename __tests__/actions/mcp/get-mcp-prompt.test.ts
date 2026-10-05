vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NODE_ENV: "test",
  },
}));

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of ["select", "from", "where"]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

const withMcpServerMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/mcp/with-mcp-server", () => ({
  withMcpServer: withMcpServerMock,
}));

vi.mock("@/lib/mcp/with-timeout", () => ({
  withTimeout: vi.fn().mockImplementation((p) => p),
}));

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMcpPrompt } from "@/actions/mcp/get-mcp-prompt";

describe("getMcpPrompt action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
  });

  it("throws error if MCP server record is not found", async () => {
    chainable.where.mockResolvedValueOnce([]);

    await expect(getMcpPrompt("srv-1", "my-prompt")).rejects.toThrow("Not Found");
  });

  it("throws error if MCP server is disabled", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "srv-1", enabled: false, name: "Test Server" },
    ]);

    await expect(getMcpPrompt("srv-1", "my-prompt")).rejects.toThrow("MCP server is disabled");
  });

  it("connects to MCP client and returns retrieved prompt", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "srv-1", enabled: true, name: "Test Server", transport: "sse", url: "http://localhost", isPublic: true },
    ]);

    const mockPromptResult = { messages: [{ role: "user", content: { type: "text", text: "hello" } }] };
    withMcpServerMock.mockImplementation(async (_, cb) => {
      const mockClient = {
        experimental_getPrompt: vi.fn().mockResolvedValue(mockPromptResult),
      };
      return cb(mockClient);
    });

    const res = await getMcpPrompt("srv-1", "my-prompt", { arg1: "val" });
    expect(res).toEqual(mockPromptResult);
  });

  it("handles error during prompt retrieval inside withMcpServer callback (Error and non-Error)", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "srv-1", enabled: true, name: "Test Server", transport: "sse", url: "http://localhost" },
    ]);

    withMcpServerMock.mockImplementation(async (_, cb) => {
      const mockClient = {
        experimental_getPrompt: vi.fn().mockRejectedValue(new Error("Prompt not found")),
      };
      return cb(mockClient);
    });

    await expect(getMcpPrompt("srv-1", "my-prompt")).rejects.toThrow("Prompt not found");

    // Non-error throw inside callback
    chainable.where.mockResolvedValueOnce([
      { id: "srv-1", enabled: true, name: "Test Server", transport: "sse", url: "http://localhost" },
    ]);
    withMcpServerMock.mockImplementation(async (_, cb) => {
      const mockClient = {
        experimental_getPrompt: vi.fn().mockRejectedValue("String error inside client"),
      };
      return cb(mockClient);
    });
    await expect(getMcpPrompt("srv-1", "my-prompt")).rejects.toThrow();
  });

  it("handles outer connection error when withMcpServer itself fails", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "srv-1", enabled: true, name: "Test Server", transport: "sse", url: "http://localhost" },
    ]);

    withMcpServerMock.mockRejectedValueOnce(new Error("Connection refused"));

    await expect(getMcpPrompt("srv-1", "my-prompt")).rejects.toThrow("Connection refused");

    // Outer non-error throw
    chainable.where.mockResolvedValueOnce([
      { id: "srv-1", enabled: true, name: "Test Server", transport: "sse", url: "http://localhost" },
    ]);
    withMcpServerMock.mockRejectedValueOnce("Outer string error");
    await expect(getMcpPrompt("srv-1", "my-prompt")).rejects.toThrow();
  });
});
