import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: requireSessionMock,
}));

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));
vi.mock("@/drizzle/db", () => ({ db: dbMock }));

const discoverToolsAndResourcesMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/mcp/discover-tools-and-resources", () => ({
  discoverToolsAndResources: discoverToolsAndResourcesMock,
}));

import { discoverMcpServerTools } from "@/lib/mcp/discover-mcp-server-tools";

describe("discoverMcpServerTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("throws Not Found when server does not exist", async () => {
    const mockSelectServer = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    const mockSelectInstall = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };

    dbMock.select
      .mockReturnValueOnce(mockSelectServer)
      .mockReturnValueOnce(mockSelectInstall);

    await expect(discoverMcpServerTools("srv-1")).rejects.toThrow("Not Found");
  });

  it("discovers tools and resources with server headers when installRow is not present", async () => {
    const serverRow = {
      id: "srv-1",
      userId: "user-1",
      name: "Test Server",
      url: "http://localhost:8080/sse",
      type: "sse",
      headers: JSON.stringify({ Authorization: "Bearer server-token" }),
      enabled: true,
      isPublic: false,
    };

    const mockSelectServer = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([serverRow]),
    };
    const mockSelectInstall = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };

    dbMock.select
      .mockReturnValueOnce(mockSelectServer)
      .mockReturnValueOnce(mockSelectInstall);

    const mockDiscovered = {
      tools: [{ name: "t1", description: "d1", inputSchema: {} }],
      resources: [],
      prompts: [],
    };
    discoverToolsAndResourcesMock.mockResolvedValue(mockDiscovered);

    const result = await discoverMcpServerTools("srv-1");
    expect(result).toEqual(mockDiscovered);
    expect(discoverToolsAndResourcesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "srv-1",
        url: "http://localhost:8080/sse",
      }),
    );
  });

  it("overrides headers with installRow headers when installed by user", async () => {
    const serverRow = {
      id: "srv-pub",
      userId: "other-user",
      name: "Public Server",
      url: "http://localhost:8080/sse",
      type: "sse",
      headers: null,
      enabled: true,
      isPublic: true,
    };
    const installRow = {
      headers: JSON.stringify({ "X-Custom": "install-header" }),
    };

    const mockSelectServer = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([serverRow]),
    };
    const mockSelectInstall = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([installRow]),
    };

    dbMock.select
      .mockReturnValueOnce(mockSelectServer)
      .mockReturnValueOnce(mockSelectInstall);

    const mockDiscovered = {
      tools: [],
      resources: [],
      prompts: [],
    };
    discoverToolsAndResourcesMock.mockResolvedValue(mockDiscovered);

    const result = await discoverMcpServerTools("srv-pub");
    expect(result).toEqual(mockDiscovered);
    expect(discoverToolsAndResourcesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: JSON.stringify({ "X-Custom": "install-header" }),
      }),
    );
  });
});
