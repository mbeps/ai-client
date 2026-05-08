import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { db } from "@/drizzle/db";
import {
  transformAgent,
  transformRun,
  mcpServer,
  attachment,
} from "@/drizzle/schema";
import { and, eq, inArray } from "drizzle-orm";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, stepCountIs } from "ai";
import { getMcpTools } from "@/lib/mcp/get-mcp-tools";
import { downloadAttachmentsToTemp } from "@/lib/mcp/download-attachments-to-temp";
import { persistModifiedFiles } from "@/lib/mcp/persist-modified-files";
import { cleanupTempDir } from "@/lib/mcp/cleanup-temp-dir";
import { env } from "@/lib/env";
import { DEFAULT_MODEL } from "@/constants/models";
import * as xlsx from "xlsx";
import {
  createTransformRunSchema,
  resumeTransformRunSchema,
  startTransformRunSchema,
} from "@/schemas/transform-agent";
import type { FileBridgeResult } from "@/types/file-bridge-result";
import type { TransformStep } from "@/types/transform-agent";
import { z } from "zod";

export const maxDuration = 300;

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: env.OPENROUTER_API_KEY,
});

const encode = (data: object): Uint8Array =>
  new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);

const requestSchema = z.discriminatedUnion("type", [
  createTransformRunSchema.extend({ type: z.literal("new") }),
  resumeTransformRunSchema.extend({ type: z.literal("resume") }),
  startTransformRunSchema.extend({ type: z.literal("start") }),
]);

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

  const sseHeaders = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (data: object) => {
        try {
          controller.enqueue(encode(data));
        } catch {
          // stream may already be closed
        }
      };

      let bridge: FileBridgeResult | null = null;

      try {
        let runRow: typeof transformRun.$inferSelect;
        let agentRow: typeof transformAgent.$inferSelect;
        let startFromStep: number;

        if (parsed.data.type === "new") {
          // Verify agent ownership
          const agents = await db
            .select()
            .from(transformAgent)
            .where(
              and(
                eq(transformAgent.id, parsed.data.agentId),
                eq(transformAgent.userId, session.user.id),
              ),
            )
            .limit(1);
          agentRow = agents[0];
          if (!agentRow) {
            emit({ type: "error", message: "Agent not found" });
            controller.close();
            return;
          }

          // Create a new run record
          const [created] = await db
            .insert(transformRun)
            .values({
              agentId: parsed.data.agentId,
              userId: session.user.id,
              status: "running",
              dryRun: parsed.data.dryRun ?? false,
              inputAttachmentIds: JSON.stringify(
                parsed.data.inputAttachmentIds,
              ),
              outputAttachmentIds: "[]",
            })
            .returning();
          runRow = created;
          startFromStep = 0;

          emit({ type: "transform-start", runId: runRow.id });
        } else if (parsed.data.type === "start") {
          // Start an existing pending run from step 0
          const runs = await db
            .select()
            .from(transformRun)
            .where(
              and(
                eq(transformRun.id, parsed.data.runId),
                eq(transformRun.userId, session.user.id),
                eq(transformRun.status, "pending"),
              ),
            )
            .limit(1);
          runRow = runs[0];
          if (!runRow) {
            emit({
              type: "error",
              message: "Run not found or not in pending status",
            });
            controller.close();
            return;
          }

          const agents = await db
            .select()
            .from(transformAgent)
            .where(
              and(
                eq(transformAgent.id, runRow.agentId),
                eq(transformAgent.userId, session.user.id),
              ),
            )
            .limit(1);
          agentRow = agents[0];
          if (!agentRow) {
            emit({ type: "error", message: "Agent not found" });
            controller.close();
            return;
          }

          startFromStep = 0;

          // Update status to running
          await db
            .update(transformRun)
            .set({ status: "running" })
            .where(eq(transformRun.id, runRow.id));

          emit({ type: "transform-start", runId: runRow.id });
        } else {
          // Resume an existing awaiting_review run
          const runs = await db
            .select()
            .from(transformRun)
            .where(
              and(
                eq(transformRun.id, parsed.data.runId),
                eq(transformRun.userId, session.user.id),
                eq(transformRun.status, "awaiting_review"),
              ),
            )
            .limit(1);
          runRow = runs[0];
          if (!runRow) {
            emit({
              type: "error",
              message: "Run not found or not awaiting review",
            });
            controller.close();
            return;
          }

          const agents = await db
            .select()
            .from(transformAgent)
            .where(
              and(
                eq(transformAgent.id, runRow.agentId),
                eq(transformAgent.userId, session.user.id),
              ),
            )
            .limit(1);
          agentRow = agents[0];
          if (!agentRow) {
            emit({ type: "error", message: "Agent not found" });
            controller.close();
            return;
          }

          startFromStep = (runRow.currentStepIndex ?? -1) + 1;

          // Update status to running
          await db
            .update(transformRun)
            .set({ status: "running" })
            .where(eq(transformRun.id, runRow.id));

          emit({ type: "transform-start", runId: runRow.id });
        }

        // Parse and sort steps
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

        // Determine which files to stage
        const currentOutputIds: string[] = JSON.parse(
          runRow.outputAttachmentIds || "[]",
        );
        const inputIds: string[] = JSON.parse(
          runRow.inputAttachmentIds || "[]",
        );
        const stageIds =
          startFromStep > 0 && currentOutputIds.length > 0
            ? currentOutputIds
            : inputIds;

        // Fetch attachment records
        const attachmentRows = await db
          .select()
          .from(attachment)
          .where(inArray(attachment.id, stageIds));

        if (attachmentRows.length === 0) {
          await db
            .update(transformRun)
            .set({ status: "failed", errorMessage: "Input files not found" })
            .where(eq(transformRun.id, runRow.id));
          emit({ type: "error", message: "Input files not found" });
          controller.close();
          return;
        }

        // Stage files to temp directory
        bridge = await downloadAttachmentsToTemp(
          attachmentRows.map((a) => ({ id: a.id, key: a.key, name: a.name })),
        );

        // Fetch all enabled MCP servers for the user
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
          (parsed.data as { model?: string }).model ??
          agentRow.modelId ??
          DEFAULT_MODEL;

        let currentOutputAttachmentIds: string[] = [...stageIds];

        // Run each step
        for (let i = startFromStep; i < steps.length; i++) {
          const step = steps[i];

          // Update current step index
          await db
            .update(transformRun)
            .set({ currentStepIndex: step.order })
            .where(eq(transformRun.id, runRow.id));

          emit({
            type: "transform-step-start",
            runId: runRow.id,
            stepIndex: i,
            stepName: step.name,
            total: steps.length,
          });

          // Filter servers by step config
          const stepServers =
            step.mcpServerIds.length > 0
              ? allServers.filter((s) => step.mcpServerIds.includes(s.id))
              : allServers;

          // Inject EXCEL_MCP_ALLOWED_DIRS into stdio server envs
          const serversWithBridge = stepServers.map((s) => {
            if (s.type !== "stdio") return s;
            let envObj: Record<string, string> = {};
            try {
              envObj = s.env ? JSON.parse(s.env) : {};
            } catch {
              envObj = {};
            }
            envObj.EXCEL_MCP_ALLOWED_DIRS = bridge!.tempDir;
            return { ...s, env: JSON.stringify(envObj) };
          });

          const { tools, cleanup: mcpCleanup } =
            await getMcpTools(serversWithBridge);

          // Filter tools by step config
          const filteredTools =
            step.toolIds.length > 0
              ? Object.fromEntries(
                  Object.entries(tools).filter(([name]) =>
                    step.toolIds.includes(name),
                  ),
                )
              : tools;

          // Build system prompt
          const filePaths = bridge!.files.map((f) => f.localPath).join("\n");
          const systemPrompt = [
            step.context ? `Context:\n${step.context}` : null,
            `You are an Excel transformation agent. The following files are available for transformation:\n${filePaths}`,
            `Instructions for this step:\n${step.prompt}`,
            `Use only the provided MCP tools. After completing the transformation, briefly summarise what you changed.`,
          ]
            .filter(Boolean)
            .join("\n\n");

          let stepSummary = "Step completed.";

          try {
            const result = await generateText({
              model: openrouter.chat(model),
              messages: [{ role: "user", content: systemPrompt }],
              tools: filteredTools,
              stopWhen: stepCountIs(10),
              maxRetries: 1,
            });
            stepSummary = result.text || stepSummary;
          } catch (stepErr: unknown) {
            await mcpCleanup();
            const msg =
              stepErr instanceof Error ? stepErr.message : "Step failed";
            await db
              .update(transformRun)
              .set({ status: "failed", errorMessage: msg })
              .where(eq(transformRun.id, runRow.id));
            emit({
              type: "error",
              message: `Step "${step.name}" failed: ${msg}`,
            });
            controller.close();
            return;
          }

          await mcpCleanup();

          // Persist modified files after this step (skip if dry run)
          if (!runRow.dryRun) {
            const modified = await persistModifiedFiles({
              files: bridge!.files,
              userId: session.user.id,
              transformRunId: runRow.id,
            });
            if (modified.length > 0) {
              currentOutputAttachmentIds = modified.map(
                (m) => m.newAttachmentId,
              );
              await db
                .update(transformRun)
                .set({
                  outputAttachmentIds: JSON.stringify(
                    currentOutputAttachmentIds,
                  ),
                })
                .where(eq(transformRun.id, runRow.id));
            }
          }

          // Read current state of files for live preview
          const stepData: Record<string, any[]> = {};
          if (bridge) {
            for (const f of bridge.files) {
              try {
                const fs = await import("fs/promises");
                const buffer = await fs.readFile(f.localPath);
                const workbook = xlsx.read(buffer, { type: "buffer" });
                const firstSheet = workbook.SheetNames[0];
                const data = xlsx.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1 });
                stepData[f.originalName] = data as any[];
              } catch (err) {
                console.warn(`[SSE] Failed to read ${f.originalName}:`, err);
              }
            }
          }

          emit({
            type: "transform-step-complete",
            runId: runRow.id,
            stepIndex: i,
            summary: stepSummary,
            stepData,
          });

          // Human review gate: pause after this step
          if (step.requiresReview) {
            await db
              .update(transformRun)
              .set({ status: "awaiting_review", currentStepIndex: step.order })
              .where(eq(transformRun.id, runRow.id));
            emit({
              type: "transform-review-required",
              runId: runRow.id,
              stepIndex: i,
              stepName: step.name,
            });
            controller.close();
            return;
          }
        }

        // All steps completed
        await db
          .update(transformRun)
          .set({ status: "completed", currentStepIndex: steps.length - 1 })
          .where(eq(transformRun.id, runRow.id));

        emit({
          type: "transform-complete",
          runId: runRow.id,
          outputAttachmentIds: currentOutputAttachmentIds,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unexpected error";
        emit({ type: "error", message: msg });
      } finally {
        if (bridge) {
          await cleanupTempDir(bridge.tempDir);
        }
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, { headers: sseHeaders });
}
