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

const mcpServerRowToConfigMock = vi.hoisted(() =>
  vi.fn((row) => ({ id: row.id, name: row.name, headers: row.headers })),
);
vi.mock("@/lib/mcp/mcp-server-row-to-config", () => ({
  mcpServerRowToConfig: mcpServerRowToConfigMock,
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
    chainable.where
      .mockResolvedValueOnce([]) // server query
      .mockResolvedValueOnce([]); // install query

    const res = await getMcpPrompt("srv-1", "my-prompt");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toBe("Not Found");
    }
  });

  it("throws Not Found if server is public but user has not installed it", async () => {
    chainable.where
      .mockResolvedValueOnce([
        { id: "srv-pub", userId: "other-user", isPublic: true, enabled: true },
      ])
      .mockResolvedValueOnce([]); // install not found

    const res = await getMcpPrompt("srv-pub", "my-prompt");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toBe("Not Found");
    }
  });

  it("throws Not Found if server is private and owned by another user", async () => {
    chainable.where
      .mockResolvedValueOnce([
        { id: "srv-priv", userId: "other-user", isPublic: false, enabled: true },
      ])
      .mockResolvedValueOnce([]);

    const res = await getMcpPrompt("srv-priv", "my-prompt");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toBe("Not Found");
    }
  });

  it("throws MCP server is disabled if user-owned server is disabled", async () => {
    chainable.where
      .mockResolvedValueOnce([
        { id: "srv-1", userId: "user-1", enabled: false, name: "Test Server" },
      ])
      .mockResolvedValueOnce([]);

    const res = await getMcpPrompt("srv-1", "my-prompt");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toBe("MCP server is disabled");
    }
  });

  it("throws MCP server is disabled if installed public server has install disabled", async () => {
    chainable.where
      .mockResolvedValueOnce([
        { id: "srv-pub", userId: "other-user", isPublic: true, enabled: true },
      ])
      .mockResolvedValueOnce([
        { enabled: false, headers: null },
      ]);

    const res = await getMcpPrompt("srv-pub", "my-prompt");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toBe("MCP server is disabled");
    }
  });

  it("throws MCP server is disabled if installed public server itself is disabled", async () => {
    chainable.where
      .mockResolvedValueOnce([
        { id: "srv-pub", userId: "other-user", isPublic: true, enabled: false },
      ])
      .mockResolvedValueOnce([
        { enabled: true, headers: null },
      ]);

    const res = await getMcpPrompt("srv-pub", "my-prompt");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toBe("MCP server is disabled");
    }
  });

  it("connects to MCP client and returns retrieved prompt for owned server", async () => {
    chainable.where
      .mockResolvedValueOnce([
        {
          id: "srv-1",
          userId: "user-1",
          enabled: true,
          name: "Test Server",
          transport: "sse",
          url: "http://localhost",
          isPublic: false,
          headers: "owner-headers",
        },
      ])
      .mockResolvedValueOnce([]);

    const mockPromptResult = { messages: [{ role: "user", content: { type: "text", text: "hello" } }] };
    withMcpServerMock.mockImplementation(async (_, cb) => {
      const mockClient = {
        experimental_getPrompt: vi.fn().mockResolvedValue(mockPromptResult),
      };
      return cb(mockClient);
    });

    const res = await getMcpPrompt("srv-1", "my-prompt", { arg1: "val" });
    expect(res).toEqual({ ok: true, value: mockPromptResult });
    expect(mcpServerRowToConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: "owner-headers",
      }),
      "user-1",
    );
  });

  it("connects with subscriber headers for installed public server", async () => {
    chainable.where
      .mockResolvedValueOnce([
        {
          id: "srv-pub",
          userId: "other-user",
          enabled: true,
          name: "Public Server",
          transport: "sse",
          url: "http://localhost",
          isPublic: true,
          headers: "author-secret-headers",
        },
      ])
      .mockResolvedValueOnce([
        { enabled: true, headers: "subscriber-headers" },
      ]);

    const mockPromptResult = { messages: [{ role: "user", content: { type: "text", text: "hello" } }] };
    withMcpServerMock.mockImplementation(async (_, cb) => {
      const mockClient = {
        experimental_getPrompt: vi.fn().mockResolvedValue(mockPromptResult),
      };
      return cb(mockClient);
    });

    const res = await getMcpPrompt("srv-pub", "my-prompt");
    expect(res).toEqual({ ok: true, value: mockPromptResult });
    expect(mcpServerRowToConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: "subscriber-headers",
      }),
      "user-1",
    );
  });

  it("connects with null headers for installed public server when subscriber configured no headers", async () => {
    chainable.where
      .mockResolvedValueOnce([
        {
          id: "srv-pub-null",
          userId: "other-user",
          enabled: true,
          name: "Public Server",
          transport: "sse",
          url: "http://localhost",
          isPublic: true,
          headers: "author-secret-headers",
        },
      ])
      .mockResolvedValueOnce([
        { enabled: true, headers: null },
      ]);

    const mockPromptResult = { messages: [{ role: "user", content: { type: "text", text: "hello" } }] };
    withMcpServerMock.mockImplementation(async (_, cb) => {
      const mockClient = {
        experimental_getPrompt: vi.fn().mockResolvedValue(mockPromptResult),
      };
      return cb(mockClient);
    });

    const res = await getMcpPrompt("srv-pub-null", "my-prompt");
    expect(res).toEqual({ ok: true, value: mockPromptResult });
    expect(mcpServerRowToConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: null,
      }),
      "user-1",
    );
  });

  it("handles error during prompt retrieval inside withMcpServer callback (Error and non-Error)", async () => {
    chainable.where
      .mockResolvedValueOnce([
        { id: "srv-1", userId: "user-1", enabled: true, name: "Test Server", transport: "sse", url: "http://localhost" },
      ])
      .mockResolvedValueOnce([]);

    withMcpServerMock.mockImplementation(async (_, cb) => {
      const mockClient = {
        experimental_getPrompt: vi.fn().mockRejectedValue(new Error("Prompt not found")),
      };
      return cb(mockClient);
    });

    const res1 = await getMcpPrompt("srv-1", "my-prompt");
    expect(res1.ok).toBe(false);

    // Non-error throw inside callback
    chainable.where
      .mockResolvedValueOnce([
        { id: "srv-1", userId: "user-1", enabled: true, name: "Test Server", transport: "sse", url: "http://localhost" },
      ])
      .mockResolvedValueOnce([]);
    withMcpServerMock.mockImplementation(async (_, cb) => {
      const mockClient = {
        experimental_getPrompt: vi.fn().mockRejectedValue("String error inside client"),
      };
      return cb(mockClient);
    });
    const res2 = await getMcpPrompt("srv-1", "my-prompt");
    expect(res2.ok).toBe(false);
  });

  it("handles outer connection error when withMcpServer itself fails", async () => {
    chainable.where
      .mockResolvedValueOnce([
        { id: "srv-1", userId: "user-1", enabled: true, name: "Test Server", transport: "sse", url: "http://localhost" },
      ])
      .mockResolvedValueOnce([]);

    withMcpServerMock.mockRejectedValueOnce(new Error("Connection refused"));

    const res1 = await getMcpPrompt("srv-1", "my-prompt");
    expect(res1.ok).toBe(false);

    // Outer non-error throw
    chainable.where
      .mockResolvedValueOnce([
        { id: "srv-1", userId: "user-1", enabled: true, name: "Test Server", transport: "sse", url: "http://localhost" },
      ])
      .mockResolvedValueOnce([]);
    withMcpServerMock.mockRejectedValueOnce("Outer string error");
    const res2 = await getMcpPrompt("srv-1", "my-prompt");
    expect(res2.ok).toBe(false);
  });
});
