import { asSchema } from "ai";
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

  it("enforces lockedWorkflowId by rejecting create and foreign workflow ids", async () => {
    const OTHER_WF_ID = "22222222-2222-4222-8222-222222222222";
    const { manage_workflow } = registerManageWorkflowTool("user-1", {
      deferLoading: false,
      lockedWorkflowId: WF_ID,
    });

    const createRes = await manage_workflow.execute!(
      { action: "create", name: "New Workflow" },
      { toolCallId: "tc-lock-1", messages: [] },
    );
    expect(createRes).toEqual({
      success: false,
      error: "This assistant can only edit the currently open workflow.",
    });
    expect(mockCreateWorkflowForUser).not.toHaveBeenCalled();

    const foreignRes = await manage_workflow.execute!(
      { action: "update", id: OTHER_WF_ID, name: "Hijack" },
      { toolCallId: "tc-lock-2", messages: [] },
    );
    expect(foreignRes).toEqual({
      success: false,
      error: "This assistant can only edit the currently open workflow.",
    });
    expect(mockUpdateWorkflowForUser).not.toHaveBeenCalled();

    mockUpdateWorkflowForUser.mockResolvedValueOnce({
      ok: true,
      value: {
        id: WF_ID,
        name: "Updated Locked",
      },
    });
    const okRes = await manage_workflow.execute!(
      { action: "update", id: WF_ID, name: "Updated Locked" },
      { toolCallId: "tc-lock-3", messages: [] },
    );
    expect(okRes).toEqual({
      success: true,
      action: "update",
      id: WF_ID,
      name: "Updated Locked",
      route: ROUTES.WORKFLOWS.AUTOMATIONS.detail(WF_ID),
    });
  });

  it("advertises a single-object schema without top-level anyOf and normalises stringified fields and null optionals", async () => {
    const { manage_workflow } = registerManageWorkflowTool("user-1", {
      deferLoading: false,
      lockedWorkflowId: WF_ID,
    });

    const toolSchema = asSchema(manage_workflow.inputSchema);
    const jsonSchema = await toolSchema.jsonSchema;
    expect(jsonSchema.type).toBe("object");
    expect(jsonSchema).not.toHaveProperty("anyOf");

    const nodes = [
      {
        id: "initial-trigger",
        name: "Manual Trigger",
        type: "manual_trigger",
        position: { x: 78, y: 109 },
        data: {
          kind: "manual_trigger",
          variableName: "trigger",
          requiresFileUpload: true,
        },
      },
      {
        id: "http-request-node",
        name: "Get Post 1",
        type: "http_request",
        position: { x: 420, y: 100 },
        data: {
          kind: "http_request",
          variableName: "step3",
          method: "GET",
          url: "https://jsonplaceholder.typicode.com/posts/1",
          headers: [],
          body: null,
          requiresReview: false,
        },
      },
    ];
    const edges = [
      {
        id: "edge-1",
        sourceNodeId: "initial-trigger",
        targetNodeId: "http-request-node",
        sourceHandle: "main",
        targetHandle: "main",
      },
    ];

    const parsedFromStrings = await toolSchema.validate!({
      action: "update",
      id: WF_ID,
      name: "Spreadsheets",
      description: null,
      reasoningEffort: null,
      tools: JSON.stringify(["internal:tool:manage_artifact"]),
      canvasConfig: JSON.stringify({
        enabled: true,
        allowedTypes: ["spreadsheet"],
        defaultType: "spreadsheet",
      }),
      nodes: JSON.stringify(nodes),
      edges: JSON.stringify(edges),
    });
    expect(parsedFromStrings.success).toBe(true);
    if (parsedFromStrings.success) {
      expect(parsedFromStrings.value.reasoningEffort).toBeNull();
      expect(parsedFromStrings.value.description).toBeUndefined();
      expect(parsedFromStrings.value.nodes).toHaveLength(2);
      expect(parsedFromStrings.value.nodes?.[1]?.data).not.toHaveProperty(
        "body",
      );
      expect(parsedFromStrings.value.edges).toHaveLength(1);
    }

    const parsedWholeString = await toolSchema.validate!(
      JSON.stringify({
        action: "create",
        name: "Created From String",
        nodes: JSON.stringify(nodes),
        edges: JSON.stringify(edges),
      }),
    );
    expect(parsedWholeString.success).toBe(true);

    const missingCreateName = await toolSchema.validate!({
      action: "create",
    });
    expect(missingCreateName.success).toBe(false);

    const missingUpdateId = await toolSchema.validate!({
      action: "update",
      name: "No ID",
    });
    expect(missingUpdateId.success).toBe(false);

    const invalidJsonField = await toolSchema.validate!({
      action: "update",
      id: WF_ID,
      nodes: "{not-valid-json",
    });
    expect(invalidJsonField.success).toBe(false);

    const invalidWholeString = await toolSchema.validate!("{not-valid-json");
    expect(invalidWholeString.success).toBe(false);
  });
});
