import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_CODE } from "@/lib/error/error-code";
import { inngest } from "@/lib/inngest/client";

const mockRequireSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

const mockCheckRateLimit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
}));

const mockResolveMimeType = vi.hoisted(() => vi.fn());
vi.mock("@/lib/attachments/resolve-mime-type", () => ({
  resolveMimeType: mockResolveMimeType,
}));

const mockUploadObject = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage/upload-object", () => ({
  uploadObject: mockUploadObject,
}));

const mockGetSubscriptionToken = vi.hoisted(() => vi.fn());
vi.mock("inngest/react", () => ({
  getClientSubscriptionToken: mockGetSubscriptionToken,
}));

const mockSelectWhere = vi.hoisted(() => vi.fn());
const mockSelectLimit = vi.hoisted(() => vi.fn());
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

vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: (...args: unknown[]) => {
          const direct = mockSelectWhere(...args);
          return Object.assign(Promise.resolve(direct), {
            limit: mockSelectLimit,
            orderBy: mockSelectOrderBy,
          });
        },
      })),
    })),
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({ set: mockUpdateSet })),
  },
}));

import { approveWorkflowRunAction } from "@/actions/workflow-runs/approve-workflow-run";
import { createWorkflowRun } from "@/actions/workflow-runs/create-workflow-run";
import { getWorkflowRun } from "@/actions/workflow-runs/get-workflow-run";
import { getWorkflowRunRealtimeToken } from "@/actions/workflow-runs/get-workflow-run-realtime-token";
import { listWorkflowRuns } from "@/actions/workflow-runs/list-workflow-runs";
import { startWorkflowRunAction } from "@/actions/workflow-runs/start-workflow-run";
import { uploadWorkflowRunInput } from "@/actions/workflow-runs/upload-workflow-run-input";

const WF_ID = "11111111-1111-4111-8111-111111111111";
const RUN_ID = "22222222-2222-4222-8222-222222222222";

describe("Workflow Run Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ user: { id: "user-1" } });
    mockCheckRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
    mockResolveMimeType.mockResolvedValue(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    mockUploadObject.mockResolvedValue(undefined);
    mockGetSubscriptionToken.mockResolvedValue({ token: "rt-token" });
    mockSelectLimit.mockResolvedValue([{ id: WF_ID, userId: "user-1" }]);
    mockSelectWhere.mockResolvedValue([{ id: RUN_ID, workflowId: WF_ID, userId: "user-1" }]);
    mockSelectOrderBy.mockResolvedValue([]);
    mockInsertReturning.mockResolvedValue([
      { id: RUN_ID, workflowId: WF_ID, userId: "user-1", status: "pending" },
    ]);
    mockUpdateReturning.mockResolvedValue([
      { id: RUN_ID, workflowId: WF_ID, userId: "user-1", status: "running" },
    ]);
  });

  it("createWorkflowRun validates input, verifies workflow ownership, and inserts run", async () => {
    const res = await createWorkflowRun({ workflowId: WF_ID, dryRun: true });
    expect(res.ok).toBe(true);

    const bad = await createWorkflowRun({ workflowId: "not-uuid" });
    expect(bad.ok).toBe(false);

    mockSelectLimit.mockResolvedValueOnce([]);
    const missing = await createWorkflowRun({ workflowId: WF_ID });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe(ERROR_CODE.NOT_FOUND);
  });

  it("startWorkflowRunAction claims pending run and dispatches workflows/execute.run", async () => {
    const res = await startWorkflowRunAction(RUN_ID);
    expect(res.ok).toBe(true);
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "workflows/execute.run",
        data: expect.objectContaining({ runId: RUN_ID, workflowId: WF_ID, userId: "user-1" }),
      }),
    );

    mockUpdateReturning.mockResolvedValueOnce([]);
    mockSelectWhere.mockResolvedValueOnce([{ id: RUN_ID, status: "running" }]);
    const alreadyRunning = await startWorkflowRunAction(RUN_ID);
    expect(alreadyRunning.ok).toBe(true);

    mockUpdateReturning.mockResolvedValueOnce([]);
    mockSelectWhere.mockResolvedValueOnce([]);
    const notFoundRes = await startWorkflowRunAction(RUN_ID);
    expect(notFoundRes.ok).toBe(false);

    vi.mocked(inngest.send).mockRejectedValueOnce(new Error("Inngest down"));
    const dispatchErr = await startWorkflowRunAction(RUN_ID);
    expect(dispatchErr.ok).toBe(false);
    if (!dispatchErr.ok) {
      expect(dispatchErr.error.code).toBe(ERROR_CODE.INTERNAL);
    }
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending" }),
    );
  });

  it("approveWorkflowRunAction validates payload, checks ownership, gate state, and dispatches workflows/run.approved", async () => {
    const waitingToolRun = {
      id: RUN_ID,
      workflowId: WF_ID,
      userId: "user-1",
      status: "awaiting_tool_approval",
      currentNodeId: "node-1",
      nodeStates: {
        "node-1": {
          status: "awaiting_tool_approval",
          gateId: "gate-1",
          pendingToolApprovals: [
            {
              approvalId: "app-1",
              toolCallId: "tc-1",
              toolName: "delete_item",
              args: {},
              signature: "sig-1",
            },
          ],
        },
      },
    };
    mockSelectWhere.mockResolvedValueOnce([waitingToolRun]);

    const res = await approveWorkflowRunAction({
      runId: RUN_ID,
      nodeId: "node-1",
      approved: true,
      toolDecisions: [{ approvalId: "app-1", approved: true }],
    });
    expect(res.ok).toBe(true);
    expect(inngest.send).toHaveBeenCalledWith({
      name: "workflows/run.approved",
      data: {
        runId: RUN_ID,
        nodeId: "node-1",
        gateId: "gate-1",
        approved: true,
        feedback: undefined,
        toolDecisions: [{ approvalId: "app-1", approved: true }],
      },
    });

    // Rejects stale gateId
    mockSelectWhere.mockResolvedValueOnce([waitingToolRun]);
    const staleGate = await approveWorkflowRunAction({
      runId: RUN_ID,
      nodeId: "node-1",
      gateId: "stale-gate",
      approved: true,
      toolDecisions: [{ approvalId: "app-1", approved: true }],
    });
    expect(staleGate.ok).toBe(false);
    if (!staleGate.ok) expect(staleGate.error.code).toBe(ERROR_CODE.CONFLICT);

    // Rejects wrong status or wrong currentNodeId
    mockSelectWhere.mockResolvedValueOnce([{ ...waitingToolRun, status: "running" }]);
    const wrongStatus = await approveWorkflowRunAction({
      runId: RUN_ID,
      nodeId: "node-1",
      approved: true,
    });
    expect(wrongStatus.ok).toBe(false);
    if (!wrongStatus.ok) expect(wrongStatus.error.code).toBe(ERROR_CODE.CONFLICT);

    // Rejects mismatched toolDecisions when awaiting_tool_approval and approved !== false
    mockSelectWhere.mockResolvedValueOnce([waitingToolRun]);
    const badDecisions = await approveWorkflowRunAction({
      runId: RUN_ID,
      nodeId: "node-1",
      approved: true,
      toolDecisions: [{ approvalId: "wrong-id", approved: true }],
    });
    expect(badDecisions.ok).toBe(false);
    if (!badDecisions.ok) expect(badDecisions.error.code).toBe(ERROR_CODE.INVALID_INPUT);

    // Rejects approved: true with undefined toolDecisions when tools are pending
    mockSelectWhere.mockResolvedValueOnce([waitingToolRun]);
    const missingDecisions = await approveWorkflowRunAction({
      runId: RUN_ID,
      nodeId: "node-1",
      approved: true,
    });
    expect(missingDecisions.ok).toBe(false);
    if (!missingDecisions.ok) expect(missingDecisions.error.code).toBe(ERROR_CODE.INVALID_INPUT);

    // Bulk rejection (approved: false, toolDecisions omitted) is allowed
    mockSelectWhere.mockResolvedValueOnce([waitingToolRun]);
    const bulkReject = await approveWorkflowRunAction({
      runId: RUN_ID,
      nodeId: "node-1",
      approved: false,
    });
    expect(bulkReject.ok).toBe(true);

    // Works when nodeStates is null or pendingToolApprovals is undefined
    mockSelectWhere.mockResolvedValueOnce([
      {
        ...waitingToolRun,
        nodeStates: null,
      },
    ]);
    const nullStatesOk = await approveWorkflowRunAction({
      runId: RUN_ID,
      nodeId: "node-1",
      approved: true,
    });
    expect(nullStatesOk.ok).toBe(true);

    mockSelectWhere.mockResolvedValueOnce([
      {
        ...waitingToolRun,
        nodeStates: { "node-1": { status: "awaiting_tool_approval" } },
      },
    ]);
    const noPendingListOk = await approveWorkflowRunAction({
      runId: RUN_ID,
      nodeId: "node-1",
      approved: true,
    });
    expect(noPendingListOk.ok).toBe(true);

    // Works for awaiting_review without toolDecisions
    mockSelectWhere.mockResolvedValueOnce([
      {
        id: RUN_ID,
        workflowId: WF_ID,
        userId: "user-1",
        status: "awaiting_review",
        currentNodeId: "node-1",
        nodeStates: {
          "node-1": { status: "awaiting_review", gateId: "gate-rev" },
        },
      },
    ]);
    const reviewRes = await approveWorkflowRunAction({
      runId: RUN_ID,
      nodeId: "node-1",
      gateId: "gate-rev",
      approved: true,
    });
    expect(reviewRes.ok).toBe(true);

    mockSelectWhere.mockResolvedValueOnce([]);
    const miss = await approveWorkflowRunAction({
      runId: RUN_ID,
      nodeId: "node-1",
      approved: false,
    });
    expect(miss.ok).toBe(false);

    const invalidApproval = await approveWorkflowRunAction({
      runId: "not-uuid",
      nodeId: "node-1",
      approved: true,
    });
    expect(invalidApproval.ok).toBe(false);
    if (!invalidApproval.ok) {
      expect(invalidApproval.error.code).toBe(ERROR_CODE.INVALID_INPUT);
    }
  });

  it("getWorkflowRun, listWorkflowRuns, and getWorkflowRunRealtimeToken handle auth and results", async () => {
    const got = await getWorkflowRun(RUN_ID);
    expect(got.ok).toBe(true);

    mockSelectWhere.mockResolvedValueOnce([]);
    const miss = await getWorkflowRun(RUN_ID);
    expect(miss.ok).toBe(false);

    mockSelectOrderBy.mockResolvedValueOnce([{ id: RUN_ID }]);
    const listed = await listWorkflowRuns(WF_ID);
    expect(listed.ok).toBe(true);

    const tokenRes = await getWorkflowRunRealtimeToken(RUN_ID);
    expect(tokenRes.ok).toBe(true);

    mockSelectWhere.mockResolvedValueOnce([]);
    const unauthToken = await getWorkflowRunRealtimeToken(RUN_ID);
    expect(unauthToken.ok).toBe(false);
    if (!unauthToken.ok) expect(unauthToken.error.code).toBe(ERROR_CODE.UNAUTHORIZED);
  });

  it("uploadWorkflowRunInput enforces rate limits, file type, size, and inserts attachment", async () => {
    const fd = new FormData();
    fd.append("files", new File(["a,b\n1,2"], "data.xlsx"));

    const res = await uploadWorkflowRunInput(fd);
    expect(res.ok).toBe(true);
    expect(mockUploadObject).toHaveBeenCalled();

    mockCheckRateLimit.mockReturnValueOnce({
      allowed: false,
      retryAfterSeconds: 30,
    });
    const rl = await uploadWorkflowRunInput(fd);
    expect(rl.ok).toBe(false);
    if (!rl.ok) expect(rl.error.code).toBe(ERROR_CODE.RATE_LIMIT);

    mockResolveMimeType.mockResolvedValueOnce("");
    const badType = await uploadWorkflowRunInput(fd);
    expect(badType.ok).toBe(false);
    if (!badType.ok) expect(badType.error.code).toBe(ERROR_CODE.UNSUPPORTED_FILE_TYPE);

    const bigFd = new FormData();
    const bigFile = new File(["x"], "huge.xlsx");
    Object.defineProperty(bigFile, "size", { value: 60 * 1024 * 1024 });
    bigFd.append("files", bigFile);
    const tooBig = await uploadWorkflowRunInput(bigFd);
    expect(tooBig.ok).toBe(false);
    if (!tooBig.ok) expect(tooBig.error.code).toBe(ERROR_CODE.FILE_TOO_LARGE);
  });
});
