import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_CODE } from "@/lib/error/error-code";

const mockRequireSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

const mockFilterOwnedKbIds = vi.hoisted(() => vi.fn());
vi.mock("@/lib/knowledgebases/filter-owned-kb-ids", () => ({
  filterOwnedKbIds: mockFilterOwnedKbIds,
}));

const mockValidateTargetSubagentIds = vi.hoisted(() => vi.fn());
const mockWithSubagentLinkLock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/agents/validate-subagent-links", () => ({
  validateTargetSubagentIds: mockValidateTargetSubagentIds,
  withSubagentLinkLock: mockWithSubagentLinkLock,
}));

const mockSelectWhere = vi.hoisted(() => vi.fn());
const mockSelectOrderBy = vi.hoisted(() => vi.fn());
const mockInsertReturning = vi.hoisted(() => vi.fn());
const mockInsertValues = vi.hoisted(() =>
  vi.fn(() => ({ returning: mockInsertReturning })),
);
const mockUpdateReturning = vi.hoisted(() => vi.fn());
const mockUpdateWhere = vi.hoisted(() =>
  vi.fn(() => ({ returning: mockUpdateReturning })),
);
const mockUpdateSet = vi.hoisted(() =>
  vi.fn(() => ({ where: mockUpdateWhere })),
);
const mockDeleteReturning = vi.hoisted(() => vi.fn());
const mockDeleteWhere = vi.hoisted(() =>
  vi.fn(() => ({ returning: mockDeleteReturning })),
);

const mockDb = vi.hoisted(() => ({
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: (...args: unknown[]) => {
        const res = mockSelectWhere(...args);
        if (res && typeof (res as any).orderBy === "function") {
          return res;
        }
        return Object.assign(Promise.resolve(res), {
          orderBy: mockSelectOrderBy,
        });
      },
    })),
  })),
  insert: vi.fn(() => ({ values: mockInsertValues })),
  update: vi.fn(() => ({ set: mockUpdateSet })),
  delete: vi.fn(() => ({ where: mockDeleteWhere })),
  transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockDb)),
}));

vi.mock("@/drizzle/db", () => ({ db: mockDb }));

import { createWorkflow } from "@/actions/workflows/create-workflow";
import { deleteWorkflow } from "@/actions/workflows/delete-workflow";
import { getWorkflow } from "@/actions/workflows/get-workflow";
import { listWorkflows } from "@/actions/workflows/list-workflows";
import { regenerateWebhookSecret } from "@/actions/workflows/regenerate-webhook-secret";
import { renameWorkflow } from "@/actions/workflows/rename-workflow";
import { updateWorkflow } from "@/actions/workflows/update-workflow";

const WF_ID = "11111111-1111-4111-8111-111111111111";
const SUB_ID = "33333333-3333-4333-8333-333333333333";

const sampleRow = {
  id: WF_ID,
  userId: "user-1",
  name: "My DAG",
  description: null,
  globalContext: null,
  modelId: null,
  tools: [],
  skillMode: "dynamic" as const,
  skillIds: [],
  knowledgeBaseIds: [],
  subagentIds: [],
  requiresFileUpload: false,
  canvasConfig: {
    enabled: true,
    allowedTypes: ["markdown", "spreadsheet", "html", "mermaid"],
    defaultType: "any",
  },
  approvalConfig: {
    defaultReviewGate: "none" as const,
    toolApprovalMode: "auto" as const,
    autoApprovedTools: [],
  },
  webhookSecret: "sec-123",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Workflow Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ user: { id: "user-1" } });
    mockFilterOwnedKbIds.mockResolvedValue([]);
    mockValidateTargetSubagentIds.mockResolvedValue({ ok: true, value: undefined });
    mockWithSubagentLinkLock.mockImplementation(
      async (_uid: string, fn: (tx: unknown) => Promise<unknown>) => fn(mockDb),
    );
    mockInsertReturning.mockResolvedValue([sampleRow]);
    mockUpdateReturning.mockResolvedValue([sampleRow]);
    mockDeleteReturning.mockResolvedValue([{ id: WF_ID }]);
    mockSelectWhere.mockResolvedValue([]);
    mockSelectOrderBy.mockResolvedValue([]);
  });

  it("createWorkflow creates default nodes/edges, validates cycles, KB ownership, and subagent links", async () => {
    const res = await createWorkflow({ name: "My DAG" });
    expect(res.ok).toBe(true);
    expect(mockDb.transaction).toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalled();

    // Invalid input
    const bad = await createWorkflow({ name: "" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe(ERROR_CODE.INVALID_INPUT);

    // Cycle check
    const cycleRes = await createWorkflow({
      name: "Cyclic",
      nodes: [
        {
          id: "a",
          type: "ai_step",
          name: "A",
          position: { x: 0, y: 0 },
          data: { kind: "ai_step", variableName: "a", prompt: "", mcpServerIds: [], toolIds: [], requiresReview: false },
        },
        {
          id: "b",
          type: "ai_step",
          name: "B",
          position: { x: 100, y: 0 },
          data: { kind: "ai_step", variableName: "b", prompt: "", mcpServerIds: [], toolIds: [], requiresReview: false },
        },
      ],
      edges: [
        { id: "e1", sourceNodeId: "a", targetNodeId: "b", sourceHandle: "main", targetHandle: "main" },
        { id: "e2", sourceNodeId: "b", targetNodeId: "a", sourceHandle: "main", targetHandle: "main" },
      ],
    });
    expect(cycleRes.ok).toBe(false);

    // Unowned KB rejection
    mockFilterOwnedKbIds.mockResolvedValueOnce([]);
    const badKb = await createWorkflow({
      name: "Bad KB",
      knowledgeBaseIds: ["kb-foreign"],
    });
    expect(badKb.ok).toBe(false);
    if (!badKb.ok) expect(badKb.error.code).toBe(ERROR_CODE.FORBIDDEN);

    // Subagent failure (valid UUID triggers server ownership/cycle check)
    mockValidateTargetSubagentIds.mockResolvedValueOnce({
      ok: false,
      error: { code: ERROR_CODE.INVALID_INPUT, message: "Invalid subagent" },
    });
    const badSub = await createWorkflow({
      name: "Bad Sub",
      subagentIds: [SUB_ID],
    });
    expect(badSub.ok).toBe(false);

    // Custom empty nodes, owned KB, valid subagent links, explicit skill config
    mockFilterOwnedKbIds.mockResolvedValueOnce(["kb-owned"]);
    const fullCreate = await createWorkflow({
      name: "Custom Empty Graph",
      description: "Desc",
      globalContext: "Ctx",
      modelId: "gpt-4o",
      skillMode: "specific",
      skillIds: ["sk-1"],
      knowledgeBaseIds: ["kb-owned"],
      subagentIds: [SUB_ID],
      nodes: [],
    });
    expect(fullCreate.ok).toBe(true);
  });

  it("updateWorkflow validates cycles, replaces nodes/edges atomically, and handles not found", async () => {
    mockFilterOwnedKbIds.mockResolvedValueOnce(["kb-1"]);
    const res = await updateWorkflow(WF_ID, {
      name: "Updated",
      description: "New desc",
      globalContext: "Global",
      modelId: "gpt-4o",
      tools: ["t1"],
      skillMode: "specific",
      skillIds: ["sk-1"],
      knowledgeBaseIds: ["kb-1"],
      subagentIds: [SUB_ID],
      requiresFileUpload: true,
      canvasConfig: { enabled: false, allowedTypes: ["markdown"], defaultType: "markdown" },
      approvalConfig: { defaultReviewGate: "before", toolApprovalMode: "ask", autoApprovedTools: ["t1"] },
      nodes: [
        {
          id: "n1",
          type: "manual_trigger",
          name: "Start",
          position: { x: 0, y: 0 },
          data: { kind: "manual_trigger", variableName: "trigger" },
        },
        {
          id: "n2",
          type: "ai_step",
          name: "Run",
          position: { x: 200, y: 0 },
          data: { kind: "ai_step", variableName: "step1", prompt: "Hi", mcpServerIds: [], toolIds: [], requiresReview: false },
        },
      ],
      edges: [
        { id: "e1", sourceNodeId: "n1", targetNodeId: "n2", sourceHandle: "main", targetHandle: "main" },
      ],
    });
    expect(res.ok).toBe(true);
    expect(mockDeleteWhere).toHaveBeenCalled();

    // Update invalid schema
    const badUpdate = await updateWorkflow(WF_ID, { name: "" });
    expect(badUpdate.ok).toBe(false);

    // Update cycle without edges field
    const cycleUpd = await updateWorkflow(WF_ID, {
      nodes: [
        { id: "a", type: "ai_step", name: "A", position: { x: 0, y: 0 }, data: { kind: "ai_step", variableName: "a", prompt: "", mcpServerIds: [], toolIds: [], requiresReview: false } },
      ],
    });
    expect(cycleUpd.ok).toBe(true);

    const cyclicNodesUpd = await updateWorkflow(WF_ID, {
      nodes: [
        { id: "a", type: "ai_step", name: "A", position: { x: 0, y: 0 }, data: { kind: "ai_step", variableName: "a", prompt: "", mcpServerIds: [], toolIds: [], requiresReview: false } },
        { id: "b", type: "ai_step", name: "B", position: { x: 100, y: 0 }, data: { kind: "ai_step", variableName: "b", prompt: "", mcpServerIds: [], toolIds: [], requiresReview: false } },
      ],
      edges: [
        { id: "e1", sourceNodeId: "a", targetNodeId: "b", sourceHandle: "main", targetHandle: "main" },
        { id: "e2", sourceNodeId: "b", targetNodeId: "a", sourceHandle: "main", targetHandle: "main" },
      ],
    });
    expect(cyclicNodesUpd.ok).toBe(false);

    // Update empty nodes list & empty knowledgeBaseIds
    const emptyNodesUpd = await updateWorkflow(WF_ID, {
      nodes: [],
      knowledgeBaseIds: [],
    });
    expect(emptyNodesUpd.ok).toBe(true);

    // Update unowned KB
    mockFilterOwnedKbIds.mockResolvedValueOnce([]);
    const unownedKbUpd = await updateWorkflow(WF_ID, {
      knowledgeBaseIds: ["kb-foreign"],
    });
    expect(unownedKbUpd.ok).toBe(false);
    if (!unownedKbUpd.ok) expect(unownedKbUpd.error.code).toBe(ERROR_CODE.FORBIDDEN);

    // Update invalid subagent links
    mockValidateTargetSubagentIds.mockResolvedValueOnce({
      ok: false,
      error: { code: ERROR_CODE.FORBIDDEN, message: "Bad subagent" },
    });
    const badSubUpd = await updateWorkflow(WF_ID, { subagentIds: [SUB_ID] });
    expect(badSubUpd.ok).toBe(false);

    // Update only name (validated.nodes === undefined, row present)
    const updNameOnly = await updateWorkflow(WF_ID, { name: "OnlyName" });
    expect(updNameOnly.ok).toBe(true);

    mockUpdateReturning.mockResolvedValueOnce([]);
    const missing = await updateWorkflow(WF_ID, { name: "Missing" });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe(ERROR_CODE.NOT_FOUND);
  });

  it("getWorkflow returns workflow with nodes and edges or NOT_FOUND", async () => {
    mockSelectWhere
      .mockResolvedValueOnce([{ ...sampleRow, tools: null, skillIds: null, knowledgeBaseIds: null, subagentIds: null }])
      .mockResolvedValueOnce([{ id: "n1", workflowId: WF_ID, type: "manual_trigger", name: "Start", position: { x: 0, y: 0 }, data: { kind: "manual_trigger", variableName: "trigger" } }])
      .mockResolvedValueOnce([{ id: "e1", workflowId: WF_ID, sourceNodeId: "n1", targetNodeId: "n1", sourceHandle: "main", targetHandle: "main" }]);

    const res = await getWorkflow(WF_ID);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.nodes).toHaveLength(1);
      expect(res.value.edges).toHaveLength(1);
    }

    mockSelectWhere.mockResolvedValueOnce([]);
    const missing = await getWorkflow(WF_ID);
    expect(missing.ok).toBe(false);
  });

  it("listWorkflows returns workflows enriched with nodeCount and trigger flags", async () => {
    mockSelectOrderBy.mockResolvedValueOnce([]);
    const emptyList = await listWorkflows();
    expect(emptyList).toEqual({ ok: true, value: [] });

    mockSelectOrderBy.mockResolvedValueOnce([
      sampleRow,
      { ...sampleRow, id: "22222222-2222-4222-8222-222222222222", tools: null, skillIds: null, knowledgeBaseIds: null, subagentIds: null },
    ]);
    mockSelectWhere
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { workflowId: WF_ID, type: "manual_trigger" },
        { workflowId: WF_ID, type: "webhook_trigger" },
      ]);

    const res = await listWorkflows();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value[0].nodeCount).toBe(2);
      expect(res.value[0].hasManualTrigger).toBe(true);
      expect(res.value[0].hasWebhookTrigger).toBe(true);
      expect(res.value[1].nodeCount).toBe(0);
    }
  });

  it("renameWorkflow, deleteWorkflow, and regenerateWebhookSecret handle valid and missing workflows", async () => {
    const ren = await renameWorkflow(WF_ID, { name: "Renamed" });
    expect(ren.ok).toBe(true);

    mockUpdateReturning.mockResolvedValueOnce([]);
    const missRen = await renameWorkflow(WF_ID, { name: "Renamed" });
    expect(missRen.ok).toBe(false);

    const badRen = await renameWorkflow(WF_ID, { name: "" });
    expect(badRen.ok).toBe(false);

    mockUpdateReturning.mockResolvedValueOnce([
      { webhookSecret: "a".repeat(64) },
    ]);
    const regen = await regenerateWebhookSecret(WF_ID);
    expect(regen.ok).toBe(true);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        webhookSecret: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );

    mockUpdateReturning.mockResolvedValueOnce([]);
    const missRegen = await regenerateWebhookSecret(WF_ID);
    expect(missRegen.ok).toBe(false);

    const del = await deleteWorkflow(WF_ID);
    expect(del.ok).toBe(true);

    mockDeleteReturning.mockResolvedValueOnce([]);
    const delMiss = await deleteWorkflow(WF_ID);
    expect(delMiss.ok).toBe(false);
  });

  it("rejects dangling edge endpoints and foreign node knowledgeBaseIds in createWorkflow and updateWorkflow", async () => {
    const danglingCreate = await createWorkflow({
      name: "Bad Edges",
      nodes: [
        {
          id: "n1",
          type: "manual_trigger",
          name: "Trigger",
          position: { x: 0, y: 0 },
          data: { kind: "manual_trigger", variableName: "trigger" },
        },
      ],
      edges: [{ id: "e1", sourceNodeId: "n1", targetNodeId: "missing" }],
    });
    expect(danglingCreate.ok).toBe(false);
    if (!danglingCreate.ok) expect(danglingCreate.error.code).toBe(ERROR_CODE.INVALID_INPUT);

    const danglingUpdate = await updateWorkflow(WF_ID, {
      nodes: [
        {
          id: "n1",
          type: "manual_trigger",
          name: "Trigger",
          position: { x: 0, y: 0 },
          data: { kind: "manual_trigger", variableName: "trigger" },
        },
      ],
      edges: [{ id: "e1", sourceNodeId: "missing", targetNodeId: "n1" }],
    });
    expect(danglingUpdate.ok).toBe(false);
    if (!danglingUpdate.ok) expect(danglingUpdate.error.code).toBe(ERROR_CODE.INVALID_INPUT);

    mockFilterOwnedKbIds.mockResolvedValueOnce([]);
    const foreignStepKbCreate = await createWorkflow({
      name: "Foreign Step KB",
      nodes: [
        {
          id: "n2",
          type: "ai_step",
          name: "Step",
          position: { x: 0, y: 0 },
          data: {
            kind: "ai_step",
            variableName: "step1",
            prompt: "Run",
            mcpServerIds: [],
            toolIds: [],
            knowledgeBaseIds: ["kb-foreign"],
            requiresReview: false,
          },
        },
      ],
      edges: [],
    });
    expect(foreignStepKbCreate.ok).toBe(false);
    if (!foreignStepKbCreate.ok) expect(foreignStepKbCreate.error.code).toBe(ERROR_CODE.FORBIDDEN);

    mockFilterOwnedKbIds.mockResolvedValueOnce([]);
    const foreignStepKbUpdate = await updateWorkflow(WF_ID, {
      nodes: [
        {
          id: "n2",
          type: "ai_step",
          name: "Step",
          position: { x: 0, y: 0 },
          data: {
            kind: "ai_step",
            variableName: "step1",
            prompt: "Run",
            mcpServerIds: [],
            toolIds: [],
            knowledgeBaseIds: ["kb-foreign"],
            requiresReview: false,
          },
        },
      ],
      edges: [],
    });
    expect(foreignStepKbUpdate.ok).toBe(false);
    if (!foreignStepKbUpdate.ok) expect(foreignStepKbUpdate.error.code).toBe(ERROR_CODE.FORBIDDEN);
  });
});
