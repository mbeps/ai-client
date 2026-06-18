import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { db } from "@/drizzle/db";
import { transformRun, mcpServer, attachment } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import {
  resolveDefaultChatProvider,
  resolveProvider,
} from "@/lib/chat/resolve-provider";
import { generateText, stepCountIs } from "ai";
import { registerMcpTools } from "@/lib/chat/register-mcp-tools";
import { getPresignedUrl } from "@/lib/storage/s3-client";
import { hybridSearch } from "@/lib/rag/retrieve";
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
import { persistTransformArtifact } from "@/lib/transform/persist-artifact";
import {
  extractUploadedFilePath,
  extractArtifactFromToolPayload,
  extractDownloadFilePayload,
  isSpreadsheetMutationTool,
} from "@/lib/transform/tool-payload-utils";

export const maxDuration = 300;

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
        let currentAttachmentRows: (typeof attachment.$inferSelect)[] = [];

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
              .set({
                status: "failed",
                errorMessage: "Input files not found",
              })
              .where(eq(transformRun.id, runRow.id));
            emit({ type: "error", message: "Input files not found" });
            controller.close();
            return;
          }
        }

        let activeWorkbookFilePath: string | null = null;

        /* ── 4. Fetch MCP servers & resolve provider ──────────────── */
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

        let currentOutputAttachmentIds: string[] = [];

        /* ── 6. Register MCP tools (once for the whole run) ──────── */
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

        /* ── 7. Step execution loop ───────────────────────────────── */
        for (let i = startFromStep; i < steps.length; i++) {
          const step = steps[i];
          let stepHasSpreadsheetMutations = false;
          let stepPersistedSpreadsheetOutput = false;

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

          logger.info(
            "[Transform AI] Step started",
            {
              runId: runRow.id,
              stepIndex: i,
              stepName: step.name,
            },
            session.user.id,
          );

          // Filter servers by step config
          const stepServers =
            step.mcpServerIds.length > 0
              ? allServers.filter((s) => step.mcpServerIds.includes(s.id))
              : allServers;
          const stepServerNames = new Set(stepServers.map((s) => s.name));

          // Combine agent tools and step tools
          const allowedToolIds = new Set([
            ...(agentRow.tools || []),
            ...(step.toolIds || []),
          ]);

          const filteredEntries = Object.entries(runMcpTools).filter(
            ([toolName]) => {
              const source = runToolSourceMap[toolName];
              const isInternal = source === "Internal" || source === "System";
              const fromAllowedServer =
                isInternal || stepServerNames.has(source);

              if (!fromAllowedServer) return false;

              if (allowedToolIds.size === 0) return true;

              return Array.from(allowedToolIds).some((id) => {
                const [, type, name] = id.split(":");
                return type === "tool" && name === toolName;
              });
            },
          );

          const filteredTools = Object.fromEntries(filteredEntries);
          const toolSourceMap = Object.fromEntries(
            filteredEntries.map(([toolName]) => [
              toolName,
              runToolSourceMap[toolName],
            ]),
          ) as Record<string, string>;

          // Prevent re-upload when a single workbook is already loaded
          const isSingleWorkbookFlow = currentAttachmentRows.length <= 1;
          if (
            agentRow.requiresFileUpload &&
            activeWorkbookFilePath &&
            isSingleWorkbookFlow &&
            "upload_file" in filteredTools
          ) {
            delete filteredTools.upload_file;
            delete toolSourceMap.upload_file;
          }

          // Build per-step file context
          let fileContext = "";
          if (activeWorkbookFilePath) {
            fileContext = `A workbook is already loaded in the MCP session for this run. Reuse this exact file path for spreadsheet tools: ${activeWorkbookFilePath}. Do not call upload_file again unless explicitly instructed to switch source files.`;
          } else if (currentAttachmentRows.length > 0) {
            const stepUrlResults = await Promise.allSettled(
              currentAttachmentRows.map((row) => getPresignedUrl(row.key)),
            );
            const fileLines: string[] = [];
            currentAttachmentRows.forEach((row, idx) => {
              const result = stepUrlResults[idx];
              if (result.status === "fulfilled") {
                const isOutput = row.key.includes("transform-outputs/");
                const prefix = isOutput ? "[Current workbook]" : "[Input]";
                fileLines.push(`${prefix} ${row.name}: ${result.value}`);
              }
            });
            if (fileLines.length > 0) {
              const hasOutputWorkbook = currentAttachmentRows.some((row) =>
                row.key.includes("transform-outputs/"),
              );
              fileContext = hasOutputWorkbook
                ? `The current workbook is the [Current workbook] file below. Use the upload_file tool with that URL before processing. Do not treat the original input as an equal candidate now that a current workbook exists:\n${fileLines.join("\n")}`
                : `The user has attached spreadsheet files. Use the upload_file tool with the provided URL to load a file before processing:\n${fileLines.join("\n")}`;
            }
          }

          // Build system prompt
          const systemPrompt = [
            agentRow.globalContext
              ? `Context:\n${agentRow.globalContext}`
              : null,
            kbContext ? `Additional Knowledge Context:\n${kbContext}` : null,
            "You are a helpful AI assistant performing a task.",
            `Instructions for this step:\n${step.prompt}`,
            `Use only the provided MCP tools. After completing the task, briefly summarise what you did.`,
            fileContext || null,
          ]
            .filter(Boolean)
            .join("\n\n");

          let stepSummary = "Step completed.";
          let stepArtifact: Record<string, unknown> | null = null;

          try {
            const result = await generateText({
              model: resolvedProvider.sdkProvider.chat(
                resolvedProvider.modelId,
              ),
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Please execute the task." },
              ],
              tools: filteredTools,
              stopWhen: stepCountIs(10),
              maxRetries: 1,
            });

            // Capture and emit tool call/result events for the UI
            if (result.steps) {
              for (const stepInfo of result.steps) {
                for (const tc of stepInfo.toolCalls) {
                  const serverName = toolSourceMap[tc.toolName];
                  emit({
                    type: "tool-call",
                    toolCallId: tc.toolCallId,
                    toolName: tc.toolName,
                    args: (tc as any).args || (tc as any).input,
                    serverName,
                  });
                }
                for (const tr of stepInfo.toolResults) {
                  const serverName = toolSourceMap[tr.toolName];
                  const toolResultPayload =
                    (tr as { result?: unknown; output?: unknown }).result ??
                    (tr as { result?: unknown; output?: unknown }).output;

                  if (isSpreadsheetMutationTool(tr.toolName)) {
                    stepHasSpreadsheetMutations = true;
                  }

                  if (tr.toolName === "upload_file") {
                    const uploadedPath =
                      extractUploadedFilePath(toolResultPayload);
                    if (uploadedPath) {
                      activeWorkbookFilePath = uploadedPath;
                      logger.info(
                        "[Transform AI] Active workbook file_path captured",
                        {
                          runId: runRow.id,
                          stepIndex: i,
                          activeWorkbookFilePath,
                        },
                        session.user.id,
                      );
                    }
                  }

                  // Consistent formatting: serialize objects to JSON
                  const formattedResult =
                    typeof toolResultPayload === "object" &&
                    toolResultPayload !== null
                      ? JSON.stringify(toolResultPayload, null, 2)
                      : toolResultPayload;

                  // Capture manage_artifact result
                  if (tr.toolName === "manage_artifact") {
                    const extractedArtifact =
                      extractArtifactFromToolPayload(toolResultPayload);
                    if (extractedArtifact) {
                      stepArtifact = extractedArtifact;
                    } else {
                      logger.warn(
                        "[Transform AI] manage_artifact result had no extractable artifact",
                        {
                          runId: runRow.id,
                          stepIndex: i,
                          payloadType: typeof toolResultPayload,
                        },
                        session.user.id,
                      );
                    }
                  }

                  emit({
                    type: "tool-result",
                    toolCallId: tr.toolCallId,
                    toolName: tr.toolName,
                    result: formattedResult,
                    serverName,
                  });
                }
              }
            }

            stepSummary = result.text || stepSummary;
          } catch (stepErr: unknown) {
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

          /* ── 7a. Persist spreadsheet artifact if present ──────── */
          if (
            stepArtifact &&
            typeof (stepArtifact as any).type === "string" &&
            (stepArtifact as any).type.toLowerCase() === "spreadsheet" &&
            typeof (stepArtifact as any).content === "string"
          ) {
            const persisted = await persistTransformArtifact(
              {
                kind: "artifact",
                artifact: stepArtifact,
                stepIndex: i,
              },
              session.user.id,
              runRow.id,
            );

            if (persisted) {
              currentOutputAttachmentIds = persisted.outputAttachmentIds;
              stepPersistedSpreadsheetOutput = true;
              currentAttachmentRows = [persisted.attachmentRow];

              logger.info(
                "[Transform AI] Active workbook replaced with step output",
                {
                  runId: runRow.id,
                  stepIndex: i,
                  activeWorkbookAttachmentId: persisted.attachmentRow.id,
                  activeWorkbookName: persisted.attachmentRow.name,
                },
                session.user.id,
              );
            }
          }

          /* ── 7b. download_file fallback persistence ────────────── */
          if (
            stepHasSpreadsheetMutations &&
            activeWorkbookFilePath &&
            !stepPersistedSpreadsheetOutput &&
            "download_file" in runMcpTools
          ) {
            const downloadToolSource = runToolSourceMap.download_file;
            const canUseDownloadTool =
              typeof downloadToolSource === "string" &&
              stepServerNames.has(downloadToolSource);

            if (canUseDownloadTool) {
              const downloadTool = runMcpTools.download_file as {
                execute?: (args: { file_path: string }) => Promise<unknown>;
              };

              if (typeof downloadTool.execute === "function") {
                try {
                  const downloaded = await downloadTool.execute({
                    file_path: activeWorkbookFilePath,
                  });
                  const downloadPayload =
                    extractDownloadFilePayload(downloaded);

                  if (downloadPayload) {
                    const persisted = await persistTransformArtifact(
                      {
                        kind: "download",
                        fileContent: downloadPayload.fileContent,
                        filename:
                          downloadPayload.filename ||
                          currentAttachmentRows[0]?.name ||
                          `step-${i + 1}-output.xlsx`,
                        stepIndex: i,
                      },
                      session.user.id,
                      runRow.id,
                    );

                    if (persisted) {
                      currentOutputAttachmentIds =
                        persisted.outputAttachmentIds;
                      stepPersistedSpreadsheetOutput = true;
                      currentAttachmentRows = [persisted.attachmentRow];

                      logger.info(
                        "[Transform AI] Persisted step output from download_file fallback",
                        {
                          runId: runRow.id,
                          stepIndex: i,
                          outputAttachmentId: persisted.attachmentRow.id,
                          outputName: persisted.attachmentRow.name,
                        },
                        session.user.id,
                      );
                    }
                  }
                } catch (downloadErr) {
                  logger.warn(
                    "[Transform AI] download_file fallback persistence failed",
                    { downloadErr, runId: runRow.id, stepIndex: i },
                    session.user.id,
                  );
                }
              }
            }
          }

          /* ── 7c. Refuse to complete if mutations without persistence ── */
          if (
            stepHasSpreadsheetMutations &&
            activeWorkbookFilePath &&
            !stepPersistedSpreadsheetOutput
          ) {
            const errorMessage = `Step "${step.name}" changed workbook data, but no spreadsheet artifact output was persisted. Refusing to complete with stale output.`;

            logger.error(
              "[Transform AI] Workbook was modified but no output attachment was persisted",
              undefined,
              {
                runId: runRow.id,
                stepIndex: i,
                activeWorkbookFilePath,
              },
              session.user.id,
            );

            await db
              .update(transformRun)
              .set({ status: "failed", errorMessage })
              .where(eq(transformRun.id, runRow.id));

            emit({ type: "error", message: errorMessage });
            controller.close();
            return;
          }

          // Emit step-complete
          const stepData: Record<string, any[]> = {};
          emit({
            type: "transform-step-complete",
            runId: runRow.id,
            stepIndex: i,
            summary: stepSummary,
            stepData,
            artifact: stepArtifact,
          });

          logger.info(
            "[Transform AI] Step completed",
            {
              runId: runRow.id,
              stepIndex: i,
              stepName: step.name,
            },
            session.user.id,
          );

          // Human review gate
          if (step.requiresReview) {
            await db
              .update(transformRun)
              .set({
                status: "awaiting_review",
                currentStepIndex: step.order,
              })
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

        /* ── 8. All steps completed ───────────────────────────────── */
        await db
          .update(transformRun)
          .set({
            status: "completed",
            currentStepIndex: steps.length - 1,
            outputAttachmentIds: currentOutputAttachmentIds,
          })
          .where(eq(transformRun.id, runRow.id));

        emit({
          type: "transform-complete",
          runId: runRow.id,
          outputAttachmentIds: currentOutputAttachmentIds,
        });

        logger.info(
          "[Transform AI] Run completed",
          {
            runId: runRow.id,
            outputCount: currentOutputAttachmentIds.length,
          },
          session.user.id,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unexpected error";
        logger.error(
          "[Transform AI Error]",
          err,
          {
            runId:
              parsed.data.type !== "new"
                ? (parsed.data as { runId?: string }).runId
                : undefined,
          },
          session.user.id,
        );
        emit({ type: "error", message: msg });
      } finally {
        await runMcpCleanup();
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
