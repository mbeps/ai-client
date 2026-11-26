import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { inngest } from "@/lib/inngest/client";

const mockSelectWhere = vi.hoisted(() => vi.fn());
const mockInsertReturning = vi.hoisted(() => vi.fn());
const mockInsertValues = vi.hoisted(() =>
  vi.fn(() => ({ returning: mockInsertReturning })),
);
const mockUpdateWhere = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockUpdateSet = vi.hoisted(() =>
  vi.fn(() => ({ where: mockUpdateWhere })),
);

vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mockSelectWhere,
      })),
    })),
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({ set: mockUpdateSet })),
  },
}));

import { POST } from "@/app/api/webhooks/workflows/[workflowId]/route";

describe("POST /api/webhooks/workflows/[workflowId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertReturning.mockResolvedValue([{ id: "run-wh-1" }]);
  });

  it("returns 404 when workflow does not exist", async () => {
    mockSelectWhere.mockResolvedValueOnce([]);
    const req = new NextRequest("http://localhost:3000/api/webhooks/workflows/wf-1", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req, { params: Promise.resolve({ workflowId: "wf-1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 400 when workflow has no webhook_trigger node", async () => {
    mockSelectWhere
      .mockResolvedValueOnce([{ id: "wf-1", userId: "u1", webhookSecret: "sec-123" }])
      .mockResolvedValueOnce([
        { id: "n1", type: "manual_trigger", data: { kind: "manual_trigger", variableName: "m" } },
      ]);

    const req = new NextRequest("http://localhost:3000/api/webhooks/workflows/wf-1", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req, { params: Promise.resolve({ workflowId: "wf-1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 401 on missing or invalid webhook secret", async () => {
    mockSelectWhere
      .mockResolvedValueOnce([{ id: "wf-1", userId: "u1", webhookSecret: "super-secret" }])
      .mockResolvedValueOnce([
        {
          id: "n1",
          type: "webhook_trigger",
          data: { kind: "webhook_trigger", variableName: "webhook" },
        },
      ]);

    const reqMissing = new NextRequest("http://localhost:3000/api/webhooks/workflows/wf-1", {
      method: "POST",
      body: "{}",
    });
    const resMissing = await POST(reqMissing, {
      params: Promise.resolve({ workflowId: "wf-1" }),
    });
    expect(resMissing.status).toBe(401);

    mockSelectWhere
      .mockResolvedValueOnce([{ id: "wf-1", userId: "u1", webhookSecret: "super-secret" }])
      .mockResolvedValueOnce([
        {
          id: "n1",
          type: "webhook_trigger",
          data: { kind: "webhook_trigger", variableName: "webhook" },
        },
      ]);

    const reqWrong = new NextRequest("http://localhost:3000/api/webhooks/workflows/wf-1", {
      method: "POST",
      headers: { "x-webhook-secret": "wrong-secret" },
      body: "{}",
    });
    const resWrong = await POST(reqWrong, {
      params: Promise.resolve({ workflowId: "wf-1" }),
    });
    expect(resWrong.status).toBe(401);
  });

  it("returns 202 and dispatches workflows/execute.run with timing-safe verified secret (custom header & Bearer)", async () => {
    mockSelectWhere
      .mockResolvedValueOnce([{ id: "wf-1", userId: "u1", webhookSecret: "super-secret" }])
      .mockResolvedValueOnce([
        {
          id: "n1",
          type: "webhook_trigger",
          data: {
            kind: "webhook_trigger",
            variableName: "hook",
            secretHeaderName: "x-custom-sig",
          },
        },
      ]);

    const req = new NextRequest(
      "http://localhost:3000/api/webhooks/workflows/wf-1?source=stripe",
      {
        method: "POST",
        headers: {
          "x-custom-sig": "super-secret",
          "content-type": "application/json",
          cookie: "session=hidden",
        },
        body: JSON.stringify({ event: "invoice.paid" }),
      },
    );

    const res = await POST(req, { params: Promise.resolve({ workflowId: "wf-1" }) });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body).toEqual({ ok: true, runId: "run-wh-1" });
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "workflows/execute.run",
        data: { runId: "run-wh-1", workflowId: "wf-1", userId: "u1" },
      }),
    );

    // Bearer token + non-JSON plain text body fallback
    mockSelectWhere
      .mockResolvedValueOnce([{ id: "wf-1", userId: "u1", webhookSecret: "super-secret" }])
      .mockResolvedValueOnce([
        {
          id: "n1",
          type: "webhook_trigger",
          data: { kind: "webhook_trigger", variableName: "webhook" },
        },
      ]);

    const reqBearer = new NextRequest("http://localhost:3000/api/webhooks/workflows/wf-1", {
      method: "POST",
      headers: { authorization: "Bearer super-secret" },
      body: "plain text payload",
    });
    const resBearer = await POST(reqBearer, {
      params: Promise.resolve({ workflowId: "wf-1" }),
    });
    expect(resBearer.status).toBe(202);
  });

  it("falls back to x-webhook-secret when secretHeaderName is invalid and marks run failed with 503 if inngest.send throws", async () => {
    mockSelectWhere
      .mockResolvedValueOnce([{ id: "wf-1", userId: "u1", webhookSecret: "super-secret" }])
      .mockResolvedValueOnce([
        {
          id: "n1",
          type: "webhook_trigger",
          data: {
            kind: "webhook_trigger",
            variableName: "webhook",
            secretHeaderName: "invalid header name",
          },
        },
      ]);

    vi.mocked(inngest.send).mockRejectedValueOnce(new Error("Inngest unreachable"));

    const req = new NextRequest("http://localhost:3000/api/webhooks/workflows/wf-1", {
      method: "POST",
      headers: { "x-webhook-secret": "super-secret" },
      body: "{}",
    });
    const res = await POST(req, { params: Promise.resolve({ workflowId: "wf-1" }) });
    expect(res.status).toBe(503);
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        errorMessage: "Failed to dispatch workflow execution",
      }),
    );
  });

  it("handles empty request body and non-Error inngest.send rejection", async () => {
    mockSelectWhere
      .mockResolvedValueOnce([{ id: "wf-1", userId: "u1", webhookSecret: "super-secret" }])
      .mockResolvedValueOnce([
        {
          id: "n1",
          type: "webhook_trigger",
          data: {
            kind: "other_kind",
            variableName: "webhook",
          },
        },
      ]);

    vi.mocked(inngest.send).mockRejectedValueOnce("string error");

    const req = new NextRequest("http://localhost:3000/api/webhooks/workflows/wf-1", {
      method: "POST",
      headers: { "x-webhook-secret": "super-secret" },
      body: "",
    });
    const res = await POST(req, { params: Promise.resolve({ workflowId: "wf-1" }) });
    expect(res.status).toBe(503);
  });
});
