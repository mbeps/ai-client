import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "@/config/routes";

const { mockCreateWorkflowForUser, mockUpdateWorkflowForUser } = vi.hoisted(
  () => ({
    mockCreateWorkflowForUser: vi.fn(),
    mockUpdateWorkflowForUser: vi.fn(),
  }),
);

vi.mock("@/lib/workflows/workflow-service", () => ({
  createWorkflowForUser: (...args: unknown[]) =>
    mockCreateWorkflowForUser(...args),
  updateWorkflowForUser: (...args: unknown[]) =>
    mockUpdateWorkflowForUser(...args),
}));

import { registerManageWorkflowTool } from "@/lib/app-tools/register-manage-workflow-tool";

const WF_ID = "11111111-1111-4111-8111-111111111111";

describe("registerManageWorkflowTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("respects deferLoading option (default true)", () => {
    expect(
      (
        registerManageWorkflowTool("user-1").manage_workflow as {
          deferLoading?: boolean;
        }
      ).deferLoading,
    ).toBe(true);
    expect(
      (
        registerManageWorkflowTool("user-1", { deferLoading: false })
          .manage_workflow as { deferLoading?: boolean }
      ).deferLoading,
    ).toBe(false);
  });

  it("delegates create and update without leaking webhookSecret", async () => {
    const { manage_workflow } = registerManageWorkflowTool("user-1");

    mockCreateWorkflowForUser.mockResolvedValueOnce({
      ok: true,
      value: {
        id: WF_ID,
        name: "Daily Digest",
        webhookSecret: "super-secret-do-not-leak",
      },
    });
    const created = await manage_workflow.execute!(
      { action: "create", name: "Daily Digest" },
      { toolCallId: "tc-1", messages: [] },
    );
    expect(created).toEqual({
      success: true,
      action: "create",
      id: WF_ID,
      name: "Daily Digest",
      route: ROUTES.WORKFLOWS.AUTOMATIONS.detail(WF_ID),
    });
    expect(created).not.toHaveProperty("webhookSecret");

    mockCreateWorkflowForUser.mockResolvedValueOnce({
      ok: false,
      error: { code: "INVALID_INPUT", message: "Bad workflow" },
    });
    expect(
      await manage_workflow.execute!(
        { action: "create", name: "Bad" },
        { toolCallId: "tc-1b", messages: [] },
      ),
    ).toEqual({ success: false, error: "Bad workflow" });

    mockUpdateWorkflowForUser.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "Workflow graph contains a cycle",
        issues: ["cycle"],
      },
    });
    expect(
      await manage_workflow.execute!(
        { action: "update", id: WF_ID, name: "Bad" },
        { toolCallId: "tc-2", messages: [] },
      ),
    ).toEqual({
      success: false,
      error: "Workflow graph contains a cycle",
      issues: ["cycle"],
    });

    mockCreateWorkflowForUser.mockResolvedValueOnce({
      ok: false,
      error: { code: "INVALID_INPUT", message: "Bad workflow" },
    });
    expect(
      await manage_workflow.execute!(
        { action: "create", name: "Bad" },
        { toolCallId: "tc-1b", messages: [] },
      ),
    ).toEqual({ success: false, error: "Bad workflow" });

    mockUpdateWorkflowForUser.mockResolvedValueOnce({
      ok: true,
      value: {
        id: WF_ID,
        name: "Daily Digest v2",
        webhookSecret: "super-secret-do-not-leak",
      },
    });
    const updated = await manage_workflow.execute!(
      { action: "update", id: WF_ID, name: "Daily Digest v2" },
      { toolCallId: "tc-3", messages: [] },
    );
    expect(updated).toEqual({
      success: true,
      action: "update",
      id: WF_ID,
      name: "Daily Digest v2",
      route: ROUTES.WORKFLOWS.AUTOMATIONS.detail(WF_ID),
    });
    expect(updated).not.toHaveProperty("webhookSecret");
  });
});
