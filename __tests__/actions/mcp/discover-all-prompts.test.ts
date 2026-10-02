// ── env must be mocked before any module that reads it ──────────────────────
vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY: "test",
    S3_SECRET_KEY: "test",
    S3_BUCKET: "test-bucket",
    POSTMARK_SERVER_TOKEN: "test-token",
    POSTMARK_FROM_EMAIL: "noreply@example.com",
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

const discoverToolsMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/mcp/discover-tools-and-resources", () => ({
  discoverToolsAndResources: discoverToolsMock,
}));

vi.mock("@/lib/mcp/mappers", () => ({
  mcpServerRowToConfig: vi.fn((row) => ({ id: row.id, name: row.name })),
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { discoverAllPrompts } from "@/actions/mcp/discover-all-prompts";

describe("discoverAllPrompts action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.select.mockReturnValue(chainable);
    chainable.from.mockReturnValue(chainable);
  });

  it("successfully discovers and aggregates prompts from enabled servers", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "server-1", name: "Server One", enabled: true, userId: "user-1" },
      { id: "server-2", name: "Server Two", enabled: true, isPublic: true },
    ]);

    discoverToolsMock.mockResolvedValueOnce({
      prompts: [{ name: "prompt-1", description: "Desc 1" }],
    });
    discoverToolsMock.mockResolvedValueOnce({
      prompts: [{ name: "prompt-2", description: "Desc 2" }],
    });

    const result = await discoverAllPrompts();

    expect(result).toEqual([
      { name: "prompt-1", description: "Desc 1" },
      { name: "prompt-2", description: "Desc 2" },
    ]);
  });

  it("handles per-server discovery failure gracefully without failing all", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "server-1", name: "Server One", enabled: true, userId: "user-1" },
      { id: "server-2", name: "Server Two", enabled: true, isPublic: true },
    ]);

    discoverToolsMock.mockRejectedValueOnce(new Error("Server timeout"));
    discoverToolsMock.mockResolvedValueOnce({
      prompts: [{ name: "prompt-2", description: "Desc 2" }],
    });

    const result = await discoverAllPrompts();

    expect(result).toEqual([{ name: "prompt-2", description: "Desc 2" }]);
  });

  it("handles non-Error server rejection gracefully", async () => {
    chainable.where.mockResolvedValueOnce([
      { id: "server-1", name: "Server One", enabled: true, userId: "user-1" },
    ]);

    discoverToolsMock.mockRejectedValueOnce("Non-error string rejection");

    const result = await discoverAllPrompts();
    expect(result).toEqual([]);
  });

  it("returns empty array if no servers are enabled", async () => {
    chainable.where.mockResolvedValueOnce([]);

    const result = await discoverAllPrompts();
    expect(result).toEqual([]);
  });
});
