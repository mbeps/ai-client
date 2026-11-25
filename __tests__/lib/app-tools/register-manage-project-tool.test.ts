import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "@/config/routes";

const { mockCreateProjectForUser, mockUpdateProjectForUser } = vi.hoisted(
  () => ({
    mockCreateProjectForUser: vi.fn(),
    mockUpdateProjectForUser: vi.fn(),
  }),
);

vi.mock("@/lib/projects/project-service", () => ({
  createProjectForUser: (...args: unknown[]) => mockCreateProjectForUser(...args),
  updateProjectForUser: (...args: unknown[]) => mockUpdateProjectForUser(...args),
}));

import { registerManageProjectTool } from "@/lib/app-tools/register-manage-project-tool";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

describe("registerManageProjectTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("respects deferLoading option (default true)", () => {
    expect(
      (registerManageProjectTool("user-1").manage_project as { deferLoading?: boolean })
        .deferLoading,
    ).toBe(true);
    expect(
      (
        registerManageProjectTool("user-1", { deferLoading: false })
          .manage_project as { deferLoading?: boolean }
      ).deferLoading,
    ).toBe(false);
  });

  it("delegates create and update to project-service and returns route or error", async () => {
    const { manage_project } = registerManageProjectTool("user-1");

    mockCreateProjectForUser.mockResolvedValueOnce({
      ok: true,
      value: { id: PROJECT_ID, name: "Q4 Research" },
    });
    const created = await manage_project.execute!(
      { action: "create", name: "Q4 Research" },
      { toolCallId: "tc-1", messages: [] },
    );
    expect(created).toEqual({
      success: true,
      action: "create",
      id: PROJECT_ID,
      name: "Q4 Research",
      route: ROUTES.PROJECTS.detail(PROJECT_ID),
    });

    mockCreateProjectForUser.mockResolvedValueOnce({
      ok: false,
      error: { code: "INVALID_INPUT", message: "Invalid name" },
    });
    expect(
      await manage_project.execute!(
        { action: "create", name: "Bad" },
        { toolCallId: "tc-1b", messages: [] },
      ),
    ).toEqual({ success: false, error: "Invalid name" });

    mockUpdateProjectForUser.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "Bad input",
        issues: ["name: Required"],
      },
    });
    const failed = await manage_project.execute!(
      { action: "update", id: PROJECT_ID, name: "" },
      { toolCallId: "tc-2", messages: [] },
    );
    expect(failed).toEqual({
      success: false,
      error: "Bad input",
      issues: ["name: Required"],
    });

    mockCreateProjectForUser.mockResolvedValueOnce({
      ok: false,
      error: { code: "INVALID_INPUT", message: "Invalid name" },
    });
    expect(
      await manage_project.execute!(
        { action: "create", name: "Bad" },
        { toolCallId: "tc-1b", messages: [] },
      ),
    ).toEqual({ success: false, error: "Invalid name" });

    mockUpdateProjectForUser.mockResolvedValueOnce({
      ok: true,
      value: { id: PROJECT_ID, name: "Renamed" },
    });
    const updated = await manage_project.execute!(
      { action: "update", id: PROJECT_ID, name: "Renamed" },
      { toolCallId: "tc-3", messages: [] },
    );
    expect(updated).toEqual({
      success: true,
      action: "update",
      id: PROJECT_ID,
      name: "Renamed",
      route: ROUTES.PROJECTS.detail(PROJECT_ID),
    });
  });
});
