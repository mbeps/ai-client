import { beforeEach, describe, expect, it, vi } from "vitest";

// ── env mock ─────────────────────────────────────────────────────────────────
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NODE_ENV: "test",
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }));

// ── chainable DB mock ─────────────────────────────────────────────────────────
const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of [
    "select",
    "from",
    "innerJoin",
    "leftJoin",
    "limit",
    "insert",
    "values",
    "update",
    "set",
    "delete",
  ]) {
    c[m] = vi.fn();
  }
  c.where = vi.fn().mockImplementation(() => c);
  c.orderBy = vi.fn().mockImplementation(() => c);
  c.returning = vi.fn();
  c.transaction = vi.fn();

  for (const m of [
    "select",
    "from",
    "innerJoin",
    "leftJoin",
    "insert",
    "values",
    "update",
    "set",
    "delete",
  ]) {
    c[m].mockImplementation(() => c);
  }
  c.orderBy.mockResolvedValue([]);
  c.returning.mockResolvedValue([]);
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

import { addPublicServer } from "@/lib/actions/mcp-servers/add-public-server";
import { deleteMcpServer } from "@/lib/actions/mcp-servers/delete-mcp-server";
import { listMcpServers } from "@/lib/actions/mcp-servers/list-mcp-servers";
import { listPublicMcpServers } from "@/lib/actions/mcp-servers/list-public-mcp-servers";
import { toggleMcpServerPublic } from "@/lib/actions/mcp-servers/toggle-mcp-server-public";
import { uninstallPublicServer } from "@/lib/actions/mcp-servers/uninstall-public-server";
import { updateInstalledServerHeaders } from "@/lib/actions/mcp-servers/update-installed-server-headers";
import { requireSession } from "@/lib/auth/require-session";

const MOCK_PUBLIC_SERVER = {
  id: "srv-pub-1",
  userId: "author-user-2",
  name: "Community Tool",
  url: "https://mcp.community.com/sse",
  headers: '{"secret": "author-key"}',
  enabled: true,
  isPublic: true,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

beforeEach(() => {
  vi.clearAllMocks();
  chainable.select.mockReturnValue(chainable);
  chainable.from.mockReturnValue(chainable);
  chainable.innerJoin.mockReturnValue(chainable);
  chainable.where.mockImplementation(() => chainable);
  chainable.orderBy.mockImplementation(() => Promise.resolve([]));
  chainable.returning.mockResolvedValue([]);
  chainable.insert.mockReturnValue(chainable);
  chainable.values.mockReturnValue(chainable);
  chainable.update.mockReturnValue(chainable);
  chainable.set.mockReturnValue(chainable);
  chainable.delete.mockReturnValue(chainable);

  vi.mocked(requireSession).mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: {
      id: "session-1",
      token: "tok",
      userId: "user-1",
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: null,
      userAgent: null,
    },
  } as Awaited<ReturnType<typeof requireSession>>);
});

describe("addPublicServer", () => {
  it("installs a public MCP server referencing userMcpServerInstall without cloning mcpServer", async () => {
    // 1. Return public server
    chainable.where
      .mockImplementationOnce(() => Promise.resolve([MOCK_PUBLIC_SERVER]))
      // 2. Check existing install -> not found
      .mockImplementationOnce(() => Promise.resolve([]));

    chainable.returning.mockResolvedValueOnce([{ id: "install-123" }]);

    const result = await addPublicServer("srv-pub-1", '{"Auth": "sub-key"}');

    expect(result).toBe("install-123");
    expect(chainable.insert).toHaveBeenCalledTimes(1);
    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        serverId: "srv-pub-1",
        headers: '{"Auth": "sub-key"}',
        enabled: true,
      }),
    );
  });

  it("throws error if user attempts to install their own public server", async () => {
    chainable.where.mockImplementationOnce(() =>
      Promise.resolve([{ ...MOCK_PUBLIC_SERVER, userId: "user-1" }]),
    );

    await expect(addPublicServer("srv-pub-1")).rejects.toThrow(
      "You already own this server in your personal list.",
    );
  });

  it("returns existing install id if already installed", async () => {
    chainable.where
      .mockImplementationOnce(() => Promise.resolve([MOCK_PUBLIC_SERVER]))
      .mockImplementationOnce(() => Promise.resolve([{ id: "existing-install-1" }]));

    const result = await addPublicServer("srv-pub-1");
    expect(result).toBe("existing-install-1");
    expect(chainable.insert).not.toHaveBeenCalled();
  });
});

describe("uninstallPublicServer", () => {
  it("deletes installation record from userMcpServerInstall", async () => {
    await uninstallPublicServer("srv-pub-1");
    expect(chainable.delete).toHaveBeenCalledTimes(1);
  });
});

describe("updateInstalledServerHeaders", () => {
  it("updates subscriber headers for user_mcp_server_install", async () => {
    await updateInstalledServerHeaders("srv-pub-1", '{"token": "xyz"}');
    expect(chainable.update).toHaveBeenCalledTimes(1);
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: '{"token": "xyz"}',
      }),
    );
  });
});

describe("toggleMcpServerPublic", () => {
  it("prevents non-owners (e.g. subscriber of installed tool) from setting public", async () => {
    // If not owner, db.update returns empty
    chainable.returning.mockResolvedValueOnce([]);
    await expect(toggleMcpServerPublic("srv-pub-1")).rejects.toThrow("Not Found");
  });
});

