import { beforeEach, describe, expect, it, vi } from "vitest";

// ── env mock ─────────────────────────────────────────────────────────────────
vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    ENCRYPTION_SECRET: "test-encryption-secret-12345678",
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

import { decrypt } from "@/lib/encryption/decrypt";
import { addPublicServer } from "@/actions/mcp-servers/add-public-server";
import { listMcpServers } from "@/actions/mcp-servers/list-mcp-servers";
import { listPublicMcpServers } from "@/actions/mcp-servers/list-public-mcp-servers";
import { toggleMcpServerPublic } from "@/actions/mcp-servers/toggle-mcp-server-public";
import { updateInstalledServerHeaders } from "@/actions/mcp-servers/update-installed-server-headers";
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
  it("installs a public MCP server referencing userMcpServerInstall without cloning mcpServer and encrypts headers", async () => {
    // 1. Return public server
    chainable.where
      .mockImplementationOnce(() => Promise.resolve([MOCK_PUBLIC_SERVER]))
      // 2. Check existing install -> not found
      .mockImplementationOnce(() => Promise.resolve([]));

    chainable.returning.mockResolvedValueOnce([{ id: "install-123" }]);

    const result = await addPublicServer("srv-pub-1", '{"Auth": "sub-key"}');

    expect(result).toBe("install-123");
    expect(chainable.insert).toHaveBeenCalledTimes(1);
    const passedValues = chainable.values.mock.calls[0][0];
    expect(passedValues.userId).toBe("user-1");
    expect(passedValues.serverId).toBe("srv-pub-1");
    expect(decrypt(passedValues.headers)).toBe('{"Auth": "sub-key"}');
    expect(passedValues.enabled).toBe(true);
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

  it("throws if public server is not found or not enabled", async () => {
    chainable.where.mockImplementationOnce(() => Promise.resolve([]));
    await expect(addPublicServer("missing-pub-srv")).rejects.toThrow(
      "The requested public server was not found or is currently unavailable.",
    );
  });

  it("installs without headers when headers param is empty/whitespace", async () => {
    chainable.where
      .mockImplementationOnce(() => Promise.resolve([MOCK_PUBLIC_SERVER]))
      .mockImplementationOnce(() => Promise.resolve([]));

    chainable.returning.mockResolvedValueOnce([{ id: "install-no-hdr" }]);

    const result = await addPublicServer("srv-pub-1", "   ");
    expect(result).toBe("install-no-hdr");
    expect(chainable.values).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: null,
      }),
    );
  });
});

describe("updateInstalledServerHeaders", () => {
  it("updates subscriber headers for user_mcp_server_install and encrypts them", async () => {
    await updateInstalledServerHeaders("srv-pub-1", '{"token": "xyz"}');
    expect(chainable.update).toHaveBeenCalledTimes(1);
    const passedSet = chainable.set.mock.calls[0][0];
    expect(decrypt(passedSet.headers)).toBe('{"token": "xyz"}');
  });

  it("sets headers to null when empty or whitespace", async () => {
    await updateInstalledServerHeaders("srv-pub-1", "   ");
    expect(chainable.set).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: null,
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

  it("toggles and returns updated server for owner", async () => {
    const updatedServer = { ...MOCK_PUBLIC_SERVER, isPublic: false };
    chainable.returning.mockResolvedValueOnce([updatedServer]);
    const result = await toggleMcpServerPublic("srv-pub-1");
    expect(result).toEqual(updatedServer);
  });
});

describe("listMcpServers", () => {
  it("lists personal and installed servers merged and sorted by updatedAt descending with masked headers", async () => {
    const personalDate = new Date("2026-02-01");
    const installedDate = new Date("2026-03-01");

    const personalServer = {
      id: "pers-1",
      userId: "user-1",
      name: "Personal MCP",
      url: "http://localhost:8000",
      headers: "iv:auth:ciphertext-personal",
      enabled: true,
      isPublic: false,
      createdAt: new Date("2026-01-01"),
      updatedAt: personalDate,
    };

    const installedServer = {
      id: "inst-srv-1",
      userId: "author-user-2",
      name: "Installed MCP",
      url: "https://mcp.com",
      headers: "iv:auth:ciphertext-subscriber",
      enabled: true,
      isPublic: true,
      createdAt: new Date("2026-01-01"),
      updatedAt: installedDate,
      installId: "install-rec-1",
    };

    chainable.orderBy
      .mockResolvedValueOnce([personalServer])
      .mockResolvedValueOnce([installedServer]);

    const result = await listMcpServers();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("inst-srv-1");
    expect(result[0].isInstalled).toBe(true);
    expect(result[0].headers).toBe("[REDACTED]");
    expect(result[1].id).toBe("pers-1");
    expect(result[1].isInstalled).toBe(false);
    expect(result[1].headers).toBe("[REDACTED]");
  });

  it("preserves null headers when server has no headers configured", async () => {
    const personalServer = {
      id: "pers-2",
      userId: "user-1",
      name: "No Headers MCP",
      url: "http://localhost:8000",
      headers: null,
      enabled: true,
      isPublic: false,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    };

    const installedServer = {
      id: "inst-srv-2",
      userId: "author-user-3",
      name: "Installed MCP No Headers",
      url: "https://mcp.com",
      headers: null,
      enabled: true,
      isPublic: true,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-02"),
      installId: "install-rec-2",
    };

    chainable.orderBy
      .mockResolvedValueOnce([personalServer])
      .mockResolvedValueOnce([installedServer]);

    const result = await listMcpServers();
    expect(result).toHaveLength(2);
    expect(result[0].headers).toBeNull();
    expect(result[1].headers).toBeNull();
  });
});

describe("listPublicMcpServers", () => {
  it("lists public servers marking whether they are already installed by the user", async () => {
    const publicServer1 = {
      id: "pub-1",
      userId: "author-1",
      name: "Public Tool 1",
      url: "https://tool1.com",
      enabled: true,
      isPublic: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const publicServer2 = {
      id: "pub-2",
      userId: "author-2",
      name: "Public Tool 2",
      url: "https://tool2.com",
      enabled: true,
      isPublic: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    chainable.where
      .mockImplementationOnce(() => Promise.resolve([publicServer1, publicServer2]))
      .mockImplementationOnce(() => Promise.resolve([{ id: "inst-1", serverId: "pub-1" }]));

    const result = await listPublicMcpServers();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: "pub-1",
      isInstalled: true,
      installId: "inst-1",
      isPublic: true,
    });
    expect(result[1]).toMatchObject({
      id: "pub-2",
      isInstalled: false,
      installId: undefined,
      isPublic: true,
    });
  });
});



