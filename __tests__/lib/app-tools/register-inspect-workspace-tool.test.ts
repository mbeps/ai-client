import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockListWorkspaceResource, mockGetWorkspaceResource } = vi.hoisted(() => ({
  mockListWorkspaceResource: vi.fn(),
  mockGetWorkspaceResource: vi.fn(),
}));

vi.mock("@/lib/app-tools/inspect-workspace-queries", () => ({
  INSPECTABLE_RESOURCES: [
    "skills",
    "projects",
    "agents",
    "prompts",
    "workflows",
    "memories",
    "models",
    "knowledgebases",
    "connectors",
  ],
  listWorkspaceResource: (...args: unknown[]) =>
    mockListWorkspaceResource(...args),
  getWorkspaceResource: (...args: unknown[]) =>
    mockGetWorkspaceResource(...args),
}));

import { registerInspectWorkspaceTool } from "@/lib/app-tools/register-inspect-workspace-tool";

describe("registerInspectWorkspaceTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers inspect_workspace with deferLoading: true by default and allows overriding", () => {
    const deferred = registerInspectWorkspaceTool("user-1");
    expect(
      (deferred.inspect_workspace as { deferLoading?: boolean }).deferLoading,
    ).toBe(true);

    const immediate = registerInspectWorkspaceTool("user-1", {
      deferLoading: false,
    });
    expect(
      (immediate.inspect_workspace as { deferLoading?: boolean }).deferLoading,
    ).toBe(false);
  });

  it("executes list and get actions and returns structured not-found error", async () => {
    const { inspect_workspace } = registerInspectWorkspaceTool("user-1");

    mockListWorkspaceResource.mockResolvedValueOnce([{ id: "p1", name: "P1" }]);
    const listRes = await inspect_workspace.execute!(
      { action: "list", resource: "projects", limit: 10 },
      { toolCallId: "tc-1", messages: [] },
    );
    expect(listRes).toEqual({
      success: true,
      action: "list",
      resource: "projects",
      items: [{ id: "p1", name: "P1" }],
      count: 1,
    });

    mockGetWorkspaceResource.mockResolvedValueOnce({ id: "p1", name: "P1" });
    const getRes = await inspect_workspace.execute!(
      { action: "get", resource: "projects", identifier: "p1" },
      { toolCallId: "tc-2", messages: [] },
    );
    expect(getRes).toEqual({
      success: true,
      action: "get",
      resource: "projects",
      item: { id: "p1", name: "P1" },
    });

    mockGetWorkspaceResource.mockResolvedValueOnce(null);
    const missingRes = await inspect_workspace.execute!(
      { action: "get", resource: "projects", identifier: "missing" },
      { toolCallId: "tc-3", messages: [] },
    );
    expect(missingRes).toEqual({
      success: false,
      error: 'projects "missing" not found.',
    });
  });
});
