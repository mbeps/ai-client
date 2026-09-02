import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { SSE_HEADERS } from "@/constants/sse";
import { db } from "@/drizzle/db";
import { transformRun } from "@/drizzle/schema";
import { auth } from "@/lib/auth/auth";
import { encodeSSE } from "@/lib/encode-sse";
import { logger } from "@/lib/logger";
import { buildFileContext } from "@/lib/transform/build-file-context";
import {
  initTransformRun,
  resetStuckRuns,
  validateStepOrders,
} from "@/lib/transform/lifecycle-service";
import { loadTransformContext } from "@/lib/transform/load-transform-context";
import { runTransformSteps } from "@/lib/transform/run-steps";
import {
  createTransformRunSchema,
  resumeTransformRunSchema,
  startTransformRunSchema,
} from "@/schemas/workflows/transform-agent";
import type { TransformStep } from "@/types/transform/transform-step";

export const maxDuration = 300;

// ponytail: hardcoded stale-run threshold; upgrade path = env/config if needed
const STUCK_RUN_MAX_AGE_MINUTES = 10;

const requestSchema = z.discriminatedUnion("type", [
  createTransformRunSchema.extend({ type: z.literal("new") }),
  resumeTransformRunSchema.extend({ type: z.literal("resume") }),
  startTransformRunSchema.extend({ type: z.literal("start") }),
]);

/**
 * Executes data transformation workflows with step-by-step orchestration and real-time progress streaming.
 * Authenticates via Better Auth session, validates request type (new/resume/start), initializes transform run
 * lifecycle, assembles file context from RAG retrieval, registers MCP tools, and streams transformation steps
 * via Server-Sent Events (SSE).
 *
 * **HTTP Method:** POST
 *
 * **Request Format:** JSON with discriminated union type ("new", "resume", or "start") and workflow configuration
 *
 * **Response Format:** Server-Sent Events (SSE) stream with step progress updates and final run result
 *
 * **Authentication:** Required (Better Auth session)
 *
 * **Async Pattern:** Long-running workflow (300s timeout) with step-by-step streaming and MCP tool cleanup
 *
 * **Integration Points:** Better Auth, workflow lifecycle service, MCP tool registration, RAG hybrid search,
 * file context assembly, transform step orchestration
 *
 * @author Maruf Bepary
 * @see {@link lib/transform/lifecycle-service} for transform run initialization
 * @see {@link lib/transform/build-file-context} for file context assembly
 * @see {@link lib/transform/run-steps} for step orchestration
 * @see {@link lib/rag/retrieve} for RAG knowledge base retrieval
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify(parsed.error.issues), { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      let runMcpCleanup: () => Promise<void> = async () => {};

      const emit = (data: object) => {
        try {
          controller.enqueue(encodeSSE(data));
        } catch {
          // stream may already be closed
        }
      };

      let runId: string | undefined;

      try {
        /* ── 0. Sweep stuck runs ─────────────────────────────────── */
        await resetStuckRuns(STUCK_RUN_MAX_AGE_MINUTES);

        /* ── 1. Lifecycle ─────────────────────────────────────────── */
        const {
          run: runRow,
          agent: agentRow,
          startFromStep,
        } = await initTransformRun(
          parsed.data.type,
          parsed.data,
          session.user.id,
        );

        emit({ type: "transform-start", runId: runRow.id });
        runId = runRow.id;

        /* ── 2. Parse & sort steps ───────────────────────────────── */
        let steps: TransformStep[] = [];
        try {
          steps = JSON.parse(agentRow.steps);
        } catch {
          steps = [];
        }
        steps = [...steps].sort((a, b) => a.order - b.order);
        validateStepOrders(steps.map((s) => s.order));

        if (steps.length === 0) {
          await db
            .update(transformRun)
            .set({ status: "completed" })
            .where(eq(transformRun.id, runRow.id));
          emit({
            type: "transform-complete",
            runId: runRow.id,
            outputAttachmentIds: [],
          });
          controller.close();
          return;
        }

        /* ── 3. Stage initial attachment rows ─────────────────────── */
        let currentAttachmentRows: any[] = [];
        if (agentRow.requiresFileUpload) {
          const currentOutputIds: string[] = runRow.outputAttachmentIds;
          const inputIds: string[] = runRow.inputAttachmentIds;
          const stageIds =
            startFromStep > 0 && currentOutputIds.length > 0
              ? [currentOutputIds[currentOutputIds.length - 1]]
              : inputIds;

          const ctx = await buildFileContext(stageIds, session.user.id);
          currentAttachmentRows = ctx.attachmentRows;

          if (currentAttachmentRows.length === 0) {
            await db
              .update(transformRun)
              .set({ status: "failed", errorMessage: "Input files not found" })
              .where(eq(transformRun.id, runRow.id));
            emit({ type: "error", message: "Input files not found" });
            controller.close();
            return;
          }
        }

        /* ── 4. Load Context (Servers, Provider, KB, MCP Tools) ─── */
        const {
          allServers,
          resolvedProvider,
          kbContext,
          mcpTools: runMcpTools,
          toolSourceMap: runToolSourceMap,
          mcpCleanup,
        } = await loadTransformContext({
          userId: session.user.id,
          agentRow: agentRow as any,
          modelOverride: (parsed.data as { model?: string }).model,
        });

        runMcpCleanup = mcpCleanup;

        /* ── 5. Delegate Step Execution ───────────────────────────── */
        // ponytail: in-process only; multi-instance needs Redis-backed approach
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(": keep-alive\n\n"));
          } catch {
            // stream already closed
          }
        }, 25_000);

        let stepResult: Awaited<ReturnType<typeof runTransformSteps>>;
        try {
          stepResult = await runTransformSteps({
            steps,
            startFromStep,
            runRow,
            agentRow: agentRow as any,
            userId: session.user.id,
            allServers: allServers as any,
            resolvedProvider,
            kbContext,
            runMcpTools,
            runToolSourceMap,
            initialAttachmentRows: currentAttachmentRows,
            emit,
          });
        } finally {
          clearInterval(heartbeat);
        }

        if (!stepResult.success) {
          await runMcpCleanup();
          controller.close();
          return;
        }

        // Run paused for human review — status already set to awaiting_review in run-steps
        if (stepResult.paused) {
          await runMcpCleanup();
          controller.close();
          return;
        }

        /* ── 8. Success ────────────────────────────────────────────── */
        await db
          .update(transformRun)
          .set({ status: "completed" })
          .where(eq(transformRun.id, runRow.id));

        emit({
          type: "transform-complete",
          runId: runRow.id,
          outputAttachmentIds: stepResult.currentOutputAttachmentIds,
        });

        await runMcpCleanup();
        controller.close();
      } catch (err) {
        logger.error(
          "[Transform AI] Run failed",
          err as Error,
          undefined,
          session.user.id,
        );
        // Best-effort: mark the run failed so it doesn't stay stuck in "running"
        if (runId) {
          try {
            await db
              .update(transformRun)
              .set({
                status: "failed",
                errorMessage: "Transform execution failed unexpectedly",
              })
              .where(eq(transformRun.id, runId));
          } catch {}
        }
        emit({
          type: "error",
          message: "Transform execution failed unexpectedly",
        });
        await runMcpCleanup();
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
