import { createHash, randomUUID, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/drizzle/db";
import {
  workflow,
  workflowNode,
  workflowRun,
} from "@/drizzle/schemas/workflow-schema";
import { inngest } from "@/lib/inngest/client";
import { getLogger } from "@/lib/logger";

const log = getLogger(["app", "api", "webhooks", "workflow"]);

const SENSITIVE_HEADER_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-webhook-secret",
]);

function verifySecretTimingSafe(
  provided: string | null,
  expected: string | null,
): boolean {
  if (!provided || !expected) return false;
  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

const HTTP_TOKEN_HEADER_REGEX = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

function extractProvidedSecret(
  request: NextRequest,
  customHeaderName?: string,
): string | null {
  const trimmed = customHeaderName?.trim().toLowerCase() ?? "";
  const headerName =
    trimmed && HTTP_TOKEN_HEADER_REGEX.test(trimmed)
      ? trimmed
      : "x-webhook-secret";
  const directHeader = request.headers.get(headerName);
  if (directHeader) return directHeader;

  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return null;
}

function collectSafeHeaders(
  headers: Headers,
  customSecretHeader?: string,
): Record<string, string> {
  const blocked = customSecretHeader?.trim().toLowerCase();
  const safe: Record<string, string> = {};
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (SENSITIVE_HEADER_KEYS.has(lower) || (blocked && lower === blocked)) {
      return;
    }
    safe[key] = value;
  });
  return safe;
}

/**
 * Inbound HTTP webhook trigger endpoint (`POST /api/webhooks/workflows/[workflowId]`).
 * Verifies an active `webhook_trigger` node and timing-safe secret before dispatching Inngest execution.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workflowId: string }> },
) {
  const { workflowId } = await context.params;

  const [wf] = await db
    .select()
    .from(workflow)
    .where(eq(workflow.id, workflowId));

  if (!wf) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const nodes = await db
    .select()
    .from(workflowNode)
    .where(eq(workflowNode.workflowId, wf.id));

  const webhookNode = nodes.find((n) => n.type === "webhook_trigger");
  if (!webhookNode) {
    return NextResponse.json(
      { error: "Workflow has no active webhook trigger node" },
      { status: 400 },
    );
  }

  const customHeaderName =
    webhookNode.data.kind === "webhook_trigger"
      ? webhookNode.data.secretHeaderName
      : undefined;

  const providedSecret = extractProvidedSecret(request, customHeaderName);
  if (!verifySecretTimingSafe(providedSecret, wf.webhookSecret)) {
    log.warn("Rejected webhook request with invalid secret", { workflowId });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawText = await request.text();
  let parsedBody: unknown = rawText;
  if (rawText) {
    try {
      parsedBody = JSON.parse(rawText);
    } catch {
      parsedBody = rawText;
    }
  } else {
    parsedBody = {};
  }

  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const initialData = {
    webhook: {
      body: parsedBody,
      headers: collectSafeHeaders(request.headers, customHeaderName),
      query,
      receivedAt: new Date().toISOString(),
    },
  };

  const deliveryId =
    request.headers.get("x-request-id") ||
    request.headers.get("x-webhook-delivery") ||
    randomUUID();

  const [createdRun] = await db
    .insert(workflowRun)
    .values({
      workflowId: wf.id,
      userId: wf.userId,
      triggerType: "webhook",
      status: "running",
      dryRun: false,
      initialData,
      nodeStates: {},
      contextData: {},
      inputAttachmentIds: [],
      outputAttachmentIds: [],
    })
    .returning();

  try {
    await inngest.send({
      id: deliveryId,
      name: "workflows/execute.run",
      data: {
        runId: createdRun.id,
        workflowId: wf.id,
        userId: wf.userId,
      },
    });
  } catch (err) {
    log.error("Failed to dispatch webhook workflow run {runId}", {
      runId: createdRun.id,
      workflowId: wf.id,
      error: err instanceof Error ? err.message : String(err),
    });
    await db
      .update(workflowRun)
      .set({
        status: "failed",
        errorMessage: "Failed to dispatch workflow execution",
        updatedAt: new Date(),
      })
      .where(eq(workflowRun.id, createdRun.id));
    return NextResponse.json(
      { error: "Failed to dispatch workflow execution" },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, runId: createdRun.id }, { status: 202 });
}
