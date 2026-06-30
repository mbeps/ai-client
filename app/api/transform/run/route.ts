import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { db } from "@/drizzle/db";
import { transformRun, mcpServer } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { resolveDefaultChatProvider } from "@/lib/chat/resolve-default-chat-provider";
import { resolveProvider } from "@/lib/chat/resolve-provider";
import { registerMcpTools } from "@/lib/chat/register-mcp-tools";
import { hybridSearch } from "@/lib/rag/hybrid-search";
import {
  createTransformRunSchema,
  resumeTransformRunSchema,
  startTransformRunSchema,
} from "@/schemas/workflows/transform-agent";
import type { TransformStep } from "@/types/transform/transform-agent";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { encodeSSE, SSE_HEADERS } from "@/lib/utils/sse";
import { initTransformRun } from "@/lib/transform/lifecycle-service";
import { buildFileContext } from "@/lib/transform/build-file-context";
import { runTransformSteps } from "@/lib/transform/run-steps";

export const maxDuration = 300;

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

      try {
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

        /* ── 2. Parse & sort steps ───────────────────────────────── */
        let steps: TransformStep[] = [];
        try {
          steps = JSON.parse(agentRow.steps);
        } catch {
          steps = [];
        }
        steps = [...steps].sort((a, b) => a.order - b.order);

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
              ? currentOutputIds
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

        /* ── 4. Resolving model/provider & MCP servers ────────────── */
        const allServers = await db
          .select()
          .from(mcpServer)
          .where(
            and(
              eq(mcpServer.userId, session.user.id),
              eq(mcpServer.enabled, true),
            ),
          );

        const model =
          (parsed.data as { model?: string }).model ?? agentRow.modelId ?? null;
        const resolvedProvider = model
          ? await resolveProvider(session.user.id, model)
          : await resolveDefaultChatProvider(session.user.id);

        /* ── 5. Global KB context ─────────────────────────────────── */
        let kbContext = "";
        if (agentRow.knowledgeBaseIds && agentRow.knowledgeBaseIds.length > 0) {
          try {
            const kbIds = agentRow.knowledgeBaseIds;
            const results = await Promise.all(
              kbIds.map((id) =>
                hybridSearch(
                  id,
                  agentRow.globalContext ||
                    agentRow.description ||
                    agentRow.name,
                  session.user.id,
                  3,
                ),
              ),
            );
            const allChunks = results.flat();
            if (allChunks.length > 0) {
              kbContext =
                "\n\nKnowledge Base Context:\n" +
                allChunks.map((c) => c.content).join("\n---\n");
            }
          } catch (err) {
            logger.warn(
              "[Transform AI] KB retrieval failed",
              { err },
              session.user.id,
            );
          }
        }

        /* ── 6. Register MCP tools ────────────────────────────────── */
        const anyArtifactToolSelected =
          (agentRow.tools || []).includes("internal:tool:manage_artifact") ||
          steps.some((s) =>
            (s.toolIds || []).includes("internal:tool:manage_artifact"),
          );

        const {
          mcpTools: runMcpTools,
          toolSourceMap: runToolSourceMap,
          mcpCleanup,
        } = await registerMcpTools(
          allServers as any,
          undefined,
          anyArtifactToolSelected,
          null,
          session.user.id,
        );
        runMcpCleanup = mcpCleanup;

        /* ── 7. Delegate Step Execution ───────────────────────────── */
        const stepResult = await runTransformSteps({
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

        if (!stepResult.success) {
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
