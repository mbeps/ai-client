import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_CODE } from "@/lib/error/error-code";

const {
  mockRequireSession,
  mockUpdateSet,
  mockUpdateWhere,
  mockUpdateReturning,
  mockSelectFrom,
  mockSelectWhere,
} = vi.hoisted(() => {
  const mockUpdateReturning = vi.fn();
  const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }));
  const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
  const mockSelectWhere = vi.fn();
  const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
  const mockRequireSession = vi.fn();

  return {
    mockRequireSession,
    mockUpdateSet,
    mockUpdateWhere,
    mockUpdateReturning,
    mockSelectFrom,
    mockSelectWhere,
  };
});

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: () => mockRequireSession(),
}));

vi.mock("@/drizzle/db", () => ({
  db: {
    update: vi.fn(() => ({ set: mockUpdateSet })),
    select: vi.fn(() => ({ from: mockSelectFrom })),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { updateMcpToolApprovals } from "@/actions/mcp-servers/update-mcp-tool-approvals";

describe("updateMcpToolApprovals", () => {
  const userId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ user: { id: userId } });
    mockUpdateReturning.mockResolvedValue([]);
    mockSelectWhere.mockResolvedValue([]);
  });

  it("updates autoApprovedTools on an owned personal server, trimming and deduplicating", async () => {
    const updatedRow = {
      id: "srv-1",
      userId,
      name: "My Server",
      url: "https://example.com/mcp",
      headers: null,
      authType: "none",
      oauthClientId: null,
      oauthClientSecret: null,
      oauthScope: null,
      enabled: true,
      isPublic: false,
      autoApprovedTools: ["search", "fetch"],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockUpdateReturning.mockResolvedValueOnce([updatedRow]);

    const result = await updateMcpToolApprovals({
      serverId: "srv-1",
      autoApprovedTools: [" search ", "fetch", "search", "", "  "],
    });

    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        autoApprovedTools: ["search", "fetch"],
        updatedAt: expect.any(Date),
      }),
    );
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        id: "srv-1",
        autoApprovedTools: ["search", "fetch"],
        isInstalled: false,
      }),
    });
  });

  it("updates autoApprovedTools on an installed public server when not owned", async () => {
    const installRow = {
      id: "inst-1",
      userId,
      serverId: "srv-pub",
      headers: null,
      oauthClientId: null,
      oauthClientSecret: null,
      enabled: true,
      autoApprovedTools: ["read_docs"],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const sourceServer = {
      id: "srv-pub",
      userId: "owner-1",
      name: "Public Server",
      url: "https://public.example.com/mcp",
      authType: "none",
      oauthScope: null,
      oauthClientId: null,
      oauthClientSecret: null,
    };

    mockUpdateReturning
      .mockResolvedValueOnce([]) // personal server update returns empty
      .mockResolvedValueOnce([installRow]); // install update succeeds
    mockSelectWhere.mockResolvedValueOnce([sourceServer]);

    const result = await updateMcpToolApprovals({
      serverId: "srv-pub",
      autoApprovedTools: ["read_docs"],
    });

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        id: "srv-pub",
        name: "Public Server",
        oauthClientSecret: null,
        autoApprovedTools: ["read_docs"],
        isInstalled: true,
        installId: "inst-1",
        isPublic: false,
      }),
    });
  });

  it("redacts publisher and subscriber oauthClientSecret on installed public server responses", async () => {
    const installRow = {
      id: "inst-1",
      userId,
      serverId: "srv-pub-secret",
      headers: null,
      oauthClientId: null,
      oauthClientSecret: null,
      enabled: true,
      autoApprovedTools: ["read_docs"],
      blockedTools: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const sourceServer = {
      id: "srv-pub-secret",
      userId: "owner-1",
      name: "Public OAuth Server",
      url: "https://public.example.com/mcp",
      authType: "oauth",
      oauthScope: "read",
      oauthClientId: "pub-client-id",
      oauthClientSecret: "publisher-super-secret",
    };

    mockUpdateReturning
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([installRow])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...installRow, oauthClientSecret: "user-secret" }]);
    mockSelectWhere
      .mockResolvedValueOnce([sourceServer])
      .mockResolvedValueOnce([{ ...sourceServer, oauthClientSecret: null }]);

    const fromSource = await updateMcpToolApprovals({
      serverId: "srv-pub-secret",
      autoApprovedTools: ["read_docs"],
    });
    expect(fromSource.ok).toBe(true);
    if (fromSource.ok) {
      expect(fromSource.value.oauthClientSecret).toBe("[REDACTED]");
      expect(fromSource.value.oauthClientSecret).not.toBe(
        "publisher-super-secret",
      );
    }

    const fromInstall = await updateMcpToolApprovals({
      serverId: "srv-pub-secret",
      autoApprovedTools: ["read_docs"],
    });
    expect(fromInstall.ok).toBe(true);
    if (fromInstall.ok) {
      expect(fromInstall.value.oauthClientSecret).toBe("[REDACTED]");
      expect(fromInstall.value.oauthClientSecret).not.toBe("user-secret");
    }
  });

  it("updates blockedTools on an owned personal server and removes blocked tools from autoApprovedTools", async () => {
    const updatedRow = {
      id: "srv-1",
      userId,
      name: "My Server",
      url: "https://example.com/mcp",
      headers: null,
      authType: "none",
      oauthClientId: null,
      oauthClientSecret: null,
      oauthScope: null,
      enabled: true,
      isPublic: false,
      autoApprovedTools: ["fetch"],
      blockedTools: ["search"],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockUpdateReturning.mockResolvedValueOnce([updatedRow]);

    const result = await updateMcpToolApprovals({
      serverId: "srv-1",
      autoApprovedTools: ["search", "fetch"],
      blockedTools: [" search ", "search", ""],
    });

    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        autoApprovedTools: ["fetch"],
        blockedTools: ["search"],
        updatedAt: expect.any(Date),
      }),
    );
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        id: "srv-1",
        autoApprovedTools: ["fetch"],
        blockedTools: ["search"],
        isInstalled: false,
      }),
    });
  });

  it("returns NOT_FOUND if neither owned server nor installation exists", async () => {
    mockUpdateReturning.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await updateMcpToolApprovals({
      serverId: "missing-srv",
      autoApprovedTools: ["tool_a"],
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: ERROR_CODE.NOT_FOUND,
      }),
    });
  });

  it("returns NOT_FOUND if installation exists but source public server is missing", async () => {
    mockUpdateReturning
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "inst-1", serverId: "srv-gone" }]);
    mockSelectWhere.mockResolvedValueOnce([]);

    const result = await updateMcpToolApprovals({
      serverId: "srv-gone",
      autoApprovedTools: ["tool_a"],
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: ERROR_CODE.NOT_FOUND,
      }),
    });
  });
});
