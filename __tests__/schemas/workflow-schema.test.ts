import { describe, expect, it } from "vitest";
import {
  approveWorkflowRunSchema,
  createWorkflowRunSchema,
  createWorkflowSchema,
  renameWorkflowSchema,
  updateWorkflowSchema,
  variableNameField,
  workflowApprovalConfigSchema,
  workflowCanvasConfigSchema,
  workflowEdgeSchema,
  workflowNodeSchema,
} from "@/schemas/workflows/workflow";

describe("Workflow Schemas", () => {
  it("validates variableNameField identifiers", () => {
    expect(variableNameField.parse("step1")).toBe("step1");
    expect(variableNameField.parse("_trigger_1")).toBe("_trigger_1");
    expect(() => variableNameField.parse("1step")).toThrow();
    expect(() => variableNameField.parse("step-1")).toThrow();
    expect(() => variableNameField.parse("")).toThrow();
    expect(() => variableNameField.parse("a".repeat(65))).toThrow();
  });

  it("validates workflowCanvasConfigSchema and workflowApprovalConfigSchema", () => {
    const canvas = workflowCanvasConfigSchema.parse({
      enabled: true,
      allowedTypes: ["markdown", "spreadsheet"],
      defaultType: "markdown",
    });
    expect(canvas.enabled).toBe(true);
    expect(canvas.allowedTypes).toEqual(["markdown", "spreadsheet"]);

    const approval = workflowApprovalConfigSchema.parse({
      defaultReviewGate: "before",
      toolApprovalMode: "ask",
      autoApprovedTools: ["search_web"],
    });
    expect(approval.defaultReviewGate).toBe("before");
    expect(approval.toolApprovalMode).toBe("ask");
    expect(approval.autoApprovedTools).toEqual(["search_web"]);
  });

  it("validates all 5 workflow node types", () => {
    const nodes = [
      {
        id: "n1",
        type: "manual_trigger",
        name: "Manual Trigger",
        position: { x: 0, y: 0 },
        data: {
          kind: "manual_trigger",
          variableName: "manual",
          requiresFileUpload: false,
        },
      },
      {
        id: "n2",
        type: "webhook_trigger",
        name: "Webhook",
        position: { x: 100, y: 0 },
        data: {
          kind: "webhook_trigger",
          variableName: "webhook",
          secretHeaderName: "x-webhook-secret",
          samplePayload: '{"ok":true}',
        },
      },
      {
        id: "n3",
        type: "ai_step",
        name: "AI Step",
        position: { x: 200, y: 0 },
        data: {
          kind: "ai_step",
          variableName: "step1",
          prompt: "Summarize {{webhook.body}}",
          mcpServerIds: [],
          toolIds: [],
          requiresReview: true,
          reviewTiming: "after",
          toolApprovalMode: "ask",
          canvasMode: "markdown",
        },
      },
      {
        id: "n4",
        type: "if_condition",
        name: "Branch",
        position: { x: 300, y: 0 },
        data: {
          kind: "if_condition",
          variableName: "branch1",
          evaluationMode: "deterministic",
          logic: "and",
          rules: [
            {
              id: "r1",
              leftTemplate: "{{step1.text}}",
              operator: "contains",
              rightValue: "urgent",
            },
          ],
        },
      },
      {
        id: "n5",
        type: "http_request",
        name: "Notify",
        position: { x: 400, y: 0 },
        data: {
          kind: "http_request",
          variableName: "notify",
          method: "POST",
          url: "https://example.com/hook",
          headers: [{ key: "Content-Type", value: "application/json" }],
          body: '{"text":"{{step1.text}}"}',
          timeoutMs: 5000,
          requiresReview: false,
        },
      },
    ];

    for (const n of nodes) {
      expect(workflowNodeSchema.parse(n).id).toBe(n.id);
    }
  });

  it("rejects mismatched node type and data.kind", () => {
    expect(() =>
      workflowNodeSchema.parse({
        id: "n1",
        type: "ai_step",
        name: "Mismatch",
        position: { x: 0, y: 0 },
        data: { kind: "manual_trigger", variableName: "manual" },
      }),
    ).toThrow();
  });

  it("validates workflowEdgeSchema defaults", () => {
    const edge = workflowEdgeSchema.parse({
      id: "e1",
      sourceNodeId: "n1",
      targetNodeId: "n2",
    });
    expect(edge.sourceHandle).toBe("main");
    expect(edge.targetHandle).toBe("main");
  });

  it("rejects duplicate variableName across nodes in createWorkflowSchema and updateWorkflowSchema", () => {
    const duplicateNodes = [
      {
        id: "n1",
        type: "manual_trigger" as const,
        name: "Trigger",
        position: { x: 0, y: 0 },
        data: { kind: "manual_trigger" as const, variableName: "dupVar" },
      },
      {
        id: "n2",
        type: "ai_step" as const,
        name: "Step",
        position: { x: 200, y: 0 },
        data: {
          kind: "ai_step" as const,
          variableName: "dupVar",
          prompt: "Do it",
          mcpServerIds: [],
          toolIds: [],
          requiresReview: false,
        },
      },
    ];

    const createRes = createWorkflowSchema.safeParse({
      name: "Dup Workflow",
      nodes: duplicateNodes,
    });
    expect(createRes.success).toBe(false);

    const updateRes = updateWorkflowSchema.safeParse({
      nodes: duplicateNodes,
    });
    expect(updateRes.success).toBe(false);
  });

  it("does not inject default values on partial updateWorkflowSchema", () => {
    const parsed = updateWorkflowSchema.parse({ name: "Renamed Only" });
    expect(parsed.name).toBe("Renamed Only");
    expect(parsed.tools).toBeUndefined();
    expect(parsed.skillMode).toBeUndefined();
    expect(parsed.skillIds).toBeUndefined();
    expect(parsed.knowledgeBaseIds).toBeUndefined();
    expect(parsed.subagentIds).toBeUndefined();
    expect(parsed.requiresFileUpload).toBeUndefined();
    expect(parsed.canvasConfig).toBeUndefined();
    expect(parsed.approvalConfig).toBeUndefined();
    expect(parsed.nodes).toBeUndefined();
    expect(parsed.edges).toBeUndefined();
  });

  it("validates renameWorkflowSchema, createWorkflowRunSchema, and approveWorkflowRunSchema", () => {
    expect(renameWorkflowSchema.parse({ name: "My Flow" }).name).toBe(
      "My Flow",
    );
    expect(() => renameWorkflowSchema.parse({ name: "" })).toThrow();

    const run = createWorkflowRunSchema.parse({
      workflowId: "550e8400-e29b-41d4-a716-446655440000",
      dryRun: true,
    });
    expect(run.inputAttachmentIds).toEqual([]);
    expect(run.dryRun).toBe(true);

    const approval = approveWorkflowRunSchema.parse({
      runId: "550e8400-e29b-41d4-a716-446655440001",
      nodeId: "node-1",
      gateId: "gate-1",
      approved: true,
      feedback: "Looks good",
      toolDecisions: [{ approvalId: "app-1", approved: false }],
    });
    expect(approval.approved).toBe(true);
    expect(approval.gateId).toBe("gate-1");
    expect(approval.toolDecisions).toHaveLength(1);
  });

  it("enforces HTTP token rules for webhook secretHeaderName and requires nodes when updating edges", () => {
    expect(
      workflowNodeSchema.safeParse({
        id: "wh-1",
        type: "webhook_trigger",
        name: "Hook",
        position: { x: 0, y: 0 },
        data: {
          kind: "webhook_trigger",
          variableName: "webhook",
          secretHeaderName: " x-custom-sig ",
        },
      }).success,
    ).toBe(true);

    expect(
      workflowNodeSchema.safeParse({
        id: "wh-bad",
        type: "webhook_trigger",
        name: "Hook",
        position: { x: 0, y: 0 },
        data: {
          kind: "webhook_trigger",
          variableName: "webhook",
          secretHeaderName: "bad header name",
        },
      }).success,
    ).toBe(false);

    const edgesWithoutNodes = updateWorkflowSchema.safeParse({
      edges: [{ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }],
    });
    expect(edgesWithoutNodes.success).toBe(false);
  });
});
