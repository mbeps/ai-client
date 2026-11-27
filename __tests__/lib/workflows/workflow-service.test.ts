import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_CODE } from "@/lib/error/error-code";

const {
  mockSelectWhere,
  mockSelectFrom,
  mockInsertReturning,
  mockInsertValues,
  mockUpdateReturning,
  mockUpdateWhere,
  mockUpdateSet,
  mockDeleteWhere,
  mockAssertWorkflowAgentsOwned,
  mockAssertWorkflowKbsOwned,
  mockValidateTargetSubagentIds,
  mockWithSubagentLinkLock,
  mockDb,
} = vi.hoisted(() => {
  const mockSelectWhere = vi.fn().mockResolvedValue([]);
  const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
  const mockInsertReturning = vi.fn();
  const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }));
  const mockUpdateReturning = vi.fn();
  const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }));
  const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
  const mockDeleteWhere = vi.fn();
  const mockAssertWorkflowAgentsOwned = vi.fn();
  const mockAssertWorkflowKbsOwned = vi.fn();
  const mockValidateTargetSubagentIds = vi.fn();
  const mockWithSubagentLinkLock = vi.fn();
  const mockDb = {
    select: vi.fn(() => ({ from: mockSelectFrom })),
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({ set: mockUpdateSet })),
    delete: vi.fn(() => ({ where: mockDeleteWhere })),
    transaction: vi.fn(async (cb: (tx: typeof mockDb) => Promise<unknown>) =>
      cb(mockDb),
    ),
  };
  return {
    mockSelectWhere,
    mockSelectFrom,
    mockInsertReturning,
    mockInsertValues,
    mockUpdateReturning,
    mockUpdateWhere,
    mockUpdateSet,
    mockDeleteWhere,
    mockAssertWorkflowAgentsOwned,
    mockAssertWorkflowKbsOwned,
    mockValidateTargetSubagentIds,
    mockWithSubagentLinkLock,
    mockDb,
  };
});

vi.mock("@/drizzle/db", () => ({ db: mockDb }));
vi.mock("@/lib/workflows/assert-workflow-agents-owned", () => ({
  assertWorkflowAgentsOwned: (...args: unknown[]) =>
    mockAssertWorkflowAgentsOwned(...args),
}));
vi.mock("@/lib/workflows/assert-workflow-kbs-owned", () => ({
  assertWorkflowKbsOwned: (...args: unknown[]) =>
    mockAssertWorkflowKbsOwned(...args),
}));
vi.mock("@/lib/agents/validate-subagent-links", () => ({
  validateTargetSubagentIds: (...args: unknown[]) =>
    mockValidateTargetSubagentIds(...args),
  withSubagentLinkLock: (...args: unknown[]) =>
    mockWithSubagentLinkLock(...args),
}));

import {
  createWorkflowForUser,
  updateWorkflowForUser,
} from "@/lib/workflows/workflow-service";

const USER_ID = "user-1";
const WF_ID = "11111111-1111-4111-8111-111111111111";
const NODE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NODE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EDGE_AB = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SUB_ID = "33333333-3333-4333-8333-333333333333";

const SAMPLE_WF = {
  id: WF_ID,
  userId: USER_ID,
  name: "My DAG",
  description: null,
  globalContext: null,
  modelId: null,
  reasoningEffort: null,
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
  webhookSecret: "sec",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("workflow-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectWhere.mockResolvedValue([]);
    mockAssertWorkflowAgentsOwned.mockResolvedValue(true);
    mockAssertWorkflowKbsOwned.mockResolvedValue(true);
    mockValidateTargetSubagentIds.mockResolvedValue({ ok: true, value: true });
    mockWithSubagentLinkLock.mockImplementation(
      async (_uid: string, cb: (tx: typeof mockDb) => Promise<unknown>) =>
        cb(mockDb),
    );
  });

  describe("createWorkflowForUser", () => {
    it("creates a workflow with default graph", async () => {
      mockInsertReturning.mockResolvedValueOnce([SAMPLE_WF]);

      const res = await createWorkflowForUser(USER_ID, { name: "My DAG" });

      expect(res).toEqual({ ok: true, value: SAMPLE_WF });
      expect(mockDb.insert).toHaveBeenCalledTimes(3); // workflow + nodes + edges
    });

    it("rejects invalid schema input", async () => {
      const res = await createWorkflowForUser(USER_ID, { name: "" });
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: ERROR_CODE.INVALID_INPUT,
          issues: expect.any(Array),
        }),
      });
    });

    it("rejects dangling edge endpoints and DAG cycles", async () => {
      const badEdge = await createWorkflowForUser(USER_ID, {
        name: "Bad",
        nodes: [
          {
            id: NODE_A,
            type: "manual_trigger",
            name: "Trigger",
            position: { x: 0, y: 0 },
            data: {
              kind: "manual_trigger",
              variableName: "trigger",
              requiresFileUpload: false,
            },
          },
        ],
        edges: [
          {
            id: EDGE_AB,
            sourceNodeId: NODE_A,
            targetNodeId: NODE_B,
            sourceHandle: "main",
            targetHandle: "main",
          },
        ],
      });
      expect(badEdge).toEqual({
        ok: false,
        error: expect.objectContaining({ code: ERROR_CODE.INVALID_INPUT }),
      });

      const cycle = await createWorkflowForUser(USER_ID, {
        name: "Cycle",
        nodes: [
          {
            id: NODE_A,
            type: "ai_step",
            name: "A",
            position: { x: 0, y: 0 },
            data: {
              kind: "ai_step",
              variableName: "a",
              prompt: "do a",
              mcpServerIds: [],
              toolIds: [],
              requiresReview: false,
            },
          },
          {
            id: NODE_B,
            type: "ai_step",
            name: "B",
            position: { x: 100, y: 0 },
            data: {
              kind: "ai_step",
              variableName: "b",
              prompt: "do b",
              mcpServerIds: [],
              toolIds: [],
              requiresReview: false,
            },
          },
        ],
        edges: [
          {
            id: EDGE_AB,
            sourceNodeId: NODE_A,
            targetNodeId: NODE_B,
            sourceHandle: "main",
            targetHandle: "main",
          },
          {
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            sourceNodeId: NODE_B,
            targetNodeId: NODE_A,
            sourceHandle: "main",
            targetHandle: "main",
          },
        ],
      });
      expect(cycle).toEqual({
        ok: false,
        error: expect.objectContaining({ code: ERROR_CODE.INVALID_INPUT }),
      });
    });

    it("rejects unowned KBs with FORBIDDEN", async () => {
      mockAssertWorkflowKbsOwned.mockResolvedValueOnce(false);
      const res = await createWorkflowForUser(USER_ID, {
        name: "WF",
        knowledgeBaseIds: ["22222222-2222-4222-8222-222222222222"],
      });
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({ code: ERROR_CODE.FORBIDDEN }),
      });
    });

    it("rejects unowned node agents with FORBIDDEN", async () => {
      mockAssertWorkflowAgentsOwned.mockResolvedValueOnce(false);
      const res = await createWorkflowForUser(USER_ID, {
        name: "WF",
        nodes: [
          {
            id: NODE_A,
            type: "ai_step",
            name: "Step",
            position: { x: 0, y: 0 },
            data: {
              kind: "ai_step",
              variableName: "step1",
              agentId: "44444444-4444-4444-8444-444444444444",
              prompt: "Run",
              mcpServerIds: [],
              toolIds: [],
              requiresReview: false,
            },
          },
        ],
      });
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({ code: ERROR_CODE.FORBIDDEN }),
      });
    });

    it("validates subagentIds under lock", async () => {
      mockValidateTargetSubagentIds.mockResolvedValueOnce({
        ok: false,
        error: { code: ERROR_CODE.INVALID_INPUT, message: "Bad subagent" },
      });
      const failRes = await createWorkflowForUser(USER_ID, {
        name: "WF",
        subagentIds: [SUB_ID],
      });
      expect(failRes.ok).toBe(false);

      mockValidateTargetSubagentIds.mockResolvedValueOnce({
        ok: true,
        value: true,
      });
      mockInsertReturning.mockResolvedValueOnce([SAMPLE_WF]);
      const okRes = await createWorkflowForUser(USER_ID, {
        name: "WF",
        nodes: [],
        subagentIds: [SUB_ID],
      });
      expect(okRes).toEqual({ ok: true, value: SAMPLE_WF });
    });

    it("remaps supplied node and edge IDs to fresh UUIDs while preserving edge links", async () => {
      mockInsertReturning
        .mockResolvedValueOnce([SAMPLE_WF])
        .mockResolvedValueOnce([{ ...SAMPLE_WF, id: "wf-2" }]);

      const payload = {
        name: "WF",
        nodes: [
          {
            id: "initial-trigger",
            type: "manual_trigger" as const,
            name: "Manual Trigger",
            position: { x: 80, y: 180 },
            data: {
              kind: "manual_trigger" as const,
              variableName: "trigger",
              requiresFileUpload: false,
            },
          },
          {
            id: "initial-step",
            type: "ai_step" as const,
            name: "AI Step 1",
            position: { x: 420, y: 180 },
            data: {
              kind: "ai_step" as const,
              variableName: "step1",
              prompt: "Run",
              mcpServerIds: [],
              toolIds: [],
              requiresReview: false,
            },
          },
        ],
        edges: [
          {
            id: "initial-edge",
            sourceNodeId: "initial-trigger",
            targetNodeId: "initial-step",
            sourceHandle: "main",
            targetHandle: "main",
          },
        ],
      };

      const res1 = await createWorkflowForUser(USER_ID, payload);
      const res2 = await createWorkflowForUser(USER_ID, payload);
      expect(res1.ok).toBe(true);
      expect(res2.ok).toBe(true);

      const insertedNodes1 = mockInsertValues.mock.calls[1]?.[0] as Array<{
        id: string;
      }>;
      const insertedEdges1 = mockInsertValues.mock.calls[2]?.[0] as Array<{
        id: string;
        sourceNodeId: string;
        targetNodeId: string;
      }>;
      const insertedNodes2 = mockInsertValues.mock.calls[4]?.[0] as Array<{
        id: string;
      }>;

      expect(insertedNodes1[0]?.id).toEqual(expect.any(String));
      expect(insertedNodes1[0]?.id).not.toBe("initial-trigger");
      expect(insertedNodes1[1]?.id).not.toBe("initial-step");
      expect(insertedEdges1[0]?.id).not.toBe("initial-edge");
      expect(insertedEdges1[0]?.sourceNodeId).toBe(insertedNodes1[0]?.id);
      expect(insertedEdges1[0]?.targetNodeId).toBe(insertedNodes1[1]?.id);
      expect(insertedNodes1[0]?.id).not.toBe(insertedNodes2[0]?.id);
    });
  });

  describe("updateWorkflowForUser", () => {
    it("rejects invalid schema input", async () => {
      const res = await updateWorkflowForUser(USER_ID, WF_ID, { name: "" });
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({ code: ERROR_CODE.INVALID_INPUT }),
      });
    });

    it("rejects dangling edges and cycles on update", async () => {
      const badEdge = await updateWorkflowForUser(USER_ID, WF_ID, {
        nodes: [
          {
            id: NODE_A,
            type: "manual_trigger",
            name: "Trigger",
            position: { x: 0, y: 0 },
            data: {
              kind: "manual_trigger",
              variableName: "trigger",
              requiresFileUpload: false,
            },
          },
        ],
        edges: [
          {
            id: EDGE_AB,
            sourceNodeId: NODE_A,
            targetNodeId: NODE_B,
            sourceHandle: "main",
            targetHandle: "main",
          },
        ],
      });
      expect(badEdge.ok).toBe(false);
    });

    it("rejects unowned KBs on update", async () => {
      mockAssertWorkflowKbsOwned.mockResolvedValueOnce(false);
      const res = await updateWorkflowForUser(USER_ID, WF_ID, {
        name: "Updated",
      });
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({ code: ERROR_CODE.FORBIDDEN }),
      });
    });

    it("rejects unowned node agents on update", async () => {
      mockAssertWorkflowAgentsOwned.mockResolvedValueOnce(false);
      const res = await updateWorkflowForUser(USER_ID, WF_ID, {
        nodes: [
          {
            id: NODE_A,
            type: "ai_step",
            name: "Step",
            position: { x: 0, y: 0 },
            data: {
              kind: "ai_step",
              variableName: "step1",
              agentId: "44444444-4444-4444-8444-444444444444",
              prompt: "Run",
              mcpServerIds: [],
              toolIds: [],
              requiresReview: false,
            },
          },
        ],
      });
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({ code: ERROR_CODE.FORBIDDEN }),
      });
    });

    it("returns NOT_FOUND when workflow is missing", async () => {
      mockUpdateReturning.mockResolvedValueOnce([]);
      const res = await updateWorkflowForUser(USER_ID, WF_ID, {
        name: "Updated",
      });
      expect(res).toEqual({
        ok: false,
        error: expect.objectContaining({ code: ERROR_CODE.NOT_FOUND }),
      });
    });

    it("atomically replaces nodes and edges inside transaction under subagent lock", async () => {
      mockValidateTargetSubagentIds.mockResolvedValueOnce({
        ok: false,
        error: { code: ERROR_CODE.INVALID_INPUT, message: "Bad subagent" },
      });
      const failRes = await updateWorkflowForUser(USER_ID, WF_ID, {
        subagentIds: [SUB_ID],
      });
      expect(failRes.ok).toBe(false);

      mockValidateTargetSubagentIds.mockResolvedValueOnce({
        ok: true,
        value: true,
      });
      mockUpdateReturning.mockResolvedValueOnce([SAMPLE_WF]);

      const okRes = await updateWorkflowForUser(USER_ID, WF_ID, {
        name: "Updated",
        description: "Desc",
        globalContext: "Ctx",
        modelId: "m1",
        reasoningEffort: "low",
        tools: ["t1"],
        skillMode: "specific",
        skillIds: ["s1"],
        knowledgeBaseIds: [],
        subagentIds: [SUB_ID],
        requiresFileUpload: true,
        canvasConfig: SAMPLE_WF.canvasConfig,
        approvalConfig: SAMPLE_WF.approvalConfig,
        nodes: [
          {
            id: NODE_A,
            type: "manual_trigger",
            name: "Trigger",
            position: { x: 0, y: 0 },
            data: {
              kind: "manual_trigger",
              variableName: "trigger",
              requiresFileUpload: false,
            },
          },
          {
            id: NODE_B,
            type: "ai_step",
            name: "Step",
            position: { x: 100, y: 0 },
            data: {
              kind: "ai_step",
              variableName: "step1",
              prompt: "Run",
              mcpServerIds: [],
              toolIds: [],
              requiresReview: false,
            },
          },
        ],
        edges: [
          {
            id: EDGE_AB,
            sourceNodeId: NODE_A,
            targetNodeId: NODE_B,
            sourceHandle: "main",
            targetHandle: "main",
          },
        ],
      });
      expect(okRes).toEqual({ ok: true, value: SAMPLE_WF });
      expect(mockDb.delete).toHaveBeenCalledTimes(2);
      expect(mockDb.insert).toHaveBeenCalledTimes(2);

      mockUpdateReturning.mockResolvedValueOnce([SAMPLE_WF]);
      const nodesOnlyRes = await updateWorkflowForUser(USER_ID, WF_ID, {
        nodes: [],
      });
      expect(nodesOnlyRes).toEqual({ ok: true, value: SAMPLE_WF });

      mockUpdateReturning.mockResolvedValueOnce([SAMPLE_WF]);
      const metaOnlyRes = await updateWorkflowForUser(USER_ID, WF_ID, {
        name: "Meta only",
      });
      expect(metaOnlyRes).toEqual({ ok: true, value: SAMPLE_WF });
    });

    it("rejects duplicate node IDs and duplicate edge IDs within the same payload", async () => {
      const dupNodeRes = await createWorkflowForUser(USER_ID, {
        name: "Dup nodes",
        nodes: [
          {
            id: NODE_A,
            type: "manual_trigger",
            name: "T1",
            position: { x: 0, y: 0 },
            data: {
              kind: "manual_trigger",
              variableName: "t1",
              requiresFileUpload: false,
            },
          },
          {
            id: NODE_A,
            type: "ai_step",
            name: "S1",
            position: { x: 100, y: 0 },
            data: {
              kind: "ai_step",
              variableName: "s1",
              prompt: "Run",
              mcpServerIds: [],
              toolIds: [],
              requiresReview: false,
            },
          },
        ],
        edges: [],
      });
      expect(dupNodeRes).toEqual({
        ok: false,
        error: expect.objectContaining({ code: ERROR_CODE.INVALID_INPUT }),
      });

      const dupEdgeRes = await updateWorkflowForUser(USER_ID, WF_ID, {
        nodes: [
          {
            id: NODE_A,
            type: "manual_trigger",
            name: "T1",
            position: { x: 0, y: 0 },
            data: {
              kind: "manual_trigger",
              variableName: "t1",
              requiresFileUpload: false,
            },
          },
          {
            id: NODE_B,
            type: "ai_step",
            name: "S1",
            position: { x: 100, y: 0 },
            data: {
              kind: "ai_step",
              variableName: "s1",
              prompt: "Run",
              mcpServerIds: [],
              toolIds: [],
              requiresReview: false,
            },
          },
        ],
        edges: [
          {
            id: EDGE_AB,
            sourceNodeId: NODE_A,
            targetNodeId: NODE_B,
            sourceHandle: "main",
            targetHandle: "main",
          },
          {
            id: EDGE_AB,
            sourceNodeId: NODE_A,
            targetNodeId: NODE_B,
            sourceHandle: "main",
            targetHandle: "main",
          },
        ],
      });
      expect(dupEdgeRes).toEqual({
        ok: false,
        error: expect.objectContaining({ code: ERROR_CODE.INVALID_INPUT }),
      });
    });

    it("preserves own workflow IDs while remapping node and edge IDs that collide with other workflows", async () => {
      mockUpdateReturning.mockResolvedValueOnce([SAMPLE_WF]);
      // 1. colliding node IDs query -> NODE_A collides with another workflow
      mockSelectWhere.mockResolvedValueOnce([{ id: NODE_A }]);
      // 2. colliding edge IDs query -> EDGE_AB collides with another workflow
      mockSelectWhere.mockResolvedValueOnce([{ id: EDGE_AB }]);

      const res = await updateWorkflowForUser(USER_ID, WF_ID, {
        nodes: [
          {
            id: NODE_A,
            type: "manual_trigger",
            name: "Trigger",
            position: { x: 0, y: 0 },
            data: {
              kind: "manual_trigger",
              variableName: "trigger",
              requiresFileUpload: false,
            },
          },
          {
            id: NODE_B,
            type: "ai_step",
            name: "Step",
            position: { x: 100, y: 0 },
            data: {
              kind: "ai_step",
              variableName: "step1",
              prompt: "Run",
              mcpServerIds: [],
              toolIds: [],
              requiresReview: false,
            },
          },
        ],
        edges: [
          {
            id: EDGE_AB,
            sourceNodeId: NODE_A,
            targetNodeId: NODE_B,
            sourceHandle: "main",
            targetHandle: "main",
          },
        ],
      });

      expect(res).toEqual({ ok: true, value: SAMPLE_WF });

      const insertedNodes = mockInsertValues.mock.calls[0]?.[0] as Array<{
        id: string;
      }>;
      const insertedEdges = mockInsertValues.mock.calls[1]?.[0] as Array<{
        id: string;
        sourceNodeId: string;
        targetNodeId: string;
      }>;

      expect(insertedNodes[0]?.id).not.toBe(NODE_A);
      expect(insertedNodes[1]?.id).toBe(NODE_B);
      expect(insertedEdges[0]?.id).not.toBe(EDGE_AB);
      expect(insertedEdges[0]?.sourceNodeId).toBe(insertedNodes[0]?.id);
      expect(insertedEdges[0]?.targetNodeId).toBe(NODE_B);
    });
  });
});
