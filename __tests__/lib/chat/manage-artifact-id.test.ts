import { describe, it, expect, vi } from "vitest";

// ─── Hoisted mocks ─────────────────────────────────────────────────────────
const { mockHybridSearch, mockGetMcpTools } = vi.hoisted(() => ({
  mockHybridSearch: vi.fn(),
  mockGetMcpTools: vi.fn(),
}));

vi.mock("@/lib/mcp/get-mcp-tools", () => ({
  getMcpTools: mockGetMcpTools,
}));

vi.mock("@/lib/rag/hybrid-search", () => ({
  hybridSearch: mockHybridSearch,
}));

import { registerMcpTools } from "@/lib/chat/register-mcp-tools";

describe("manage_artifact — artifact identity (ART-02)", () => {
  it("returns an artifact with a stable unique id", async () => {
    const { mcpTools } = await registerMcpTools(
      [],
      undefined,
      true,
      null,
      false,
      "user-1",
    );
    const tool = mcpTools["manage_artifact"];
    expect(tool).toBeDefined();

    // Pull the execute fn out of the AI SDK tool wrapper
    const execute = (tool as any).execute;
    const result = await execute({ type: "markdown", content: "# hi" });

    expect(result.artifact.id).toEqual(expect.any(String));
    expect(result.artifact.id.length).toBeGreaterThan(0);
  });

  it("assigns distinct ids to separate artifacts", async () => {
    const { mcpTools } = await registerMcpTools(
      [],
      undefined,
      true,
      null,
      false,
      "user-1",
    );
    const execute = (mcpTools["manage_artifact"] as any).execute;

    const a = await execute({ type: "markdown", content: "# a" });
    const b = await execute({ type: "markdown", content: "# b" });
    expect(a.artifact.id).not.toBe(b.artifact.id);
  });
});
