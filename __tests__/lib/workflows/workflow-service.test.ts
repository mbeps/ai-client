import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_CODE } from "@/lib/error/error-code";

const {
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
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({ set: mockUpdateSet })),
    delete: vi.fn(() => ({ where: mockDeleteWhere })),
    transaction: vi.fn(async (cb: (tx: typeof mockDb) => Promise<unknown>) =>
      cb(mockDb),
    ),
  };
  return {
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
  });
});
