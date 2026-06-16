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
import {
  resolveDefaultChatProvider,
  resolveProviderForModel,
} from "@/lib/chat/resolve-provider";
import { generateText, stepCountIs } from "ai";
import { registerMcpTools } from "@/lib/chat/register-mcp-tools";
import { getPresignedUrl, uploadObject } from "@/lib/storage/s3-client";
import * as XLSX from "xlsx";
import { v4 as uuidv4 } from "uuid";
import { hybridSearch } from "@/lib/rag/retrieve";
import {
  createTransformRunSchema,
  resumeTransformRunSchema,
  startTransformRunSchema,
} from "@/schemas/transform-agent";
import type { TransformStep } from "@/types/transform-agent";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { encodeSSE, SSE_HEADERS } from "@/lib/utils/sse";

export const maxDuration = 300;

const requestSchema = z.discriminatedUnion("type", [
  createTransformRunSchema.extend({ type: z.literal("new") }),
  resumeTransformRunSchema.extend({ type: z.literal("resume") }),
  startTransformRunSchema.extend({ type: z.literal("start") }),
]);

function extractUploadedFilePath(result: unknown): string | null {
  if (!result) return null;

  if (typeof result === "string") {
    try {
      const parsed = JSON.parse(result);
      return typeof parsed?.file_path === "string" ? parsed.file_path : null;
    } catch {
      return null;
    }
  }

  if (typeof result !== "object") return null;

  const resultObj = result as {
    file_path?: unknown;
    content?: Array<{ text?: unknown }>;
  };

  if (typeof resultObj.file_path === "string") {
    return resultObj.file_path;
  }

  if (!Array.isArray(resultObj.content)) return null;

  for (const item of resultObj.content) {
    if (typeof item?.text !== "string") continue;
    try {
      const parsed = JSON.parse(item.text);
      if (typeof parsed?.file_path === "string") {
        return parsed.file_path;
      }
    } catch {
      // ignore non-JSON tool payloads
    }
  }

  return null;
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normaliseToolPayload(payload: unknown): unknown {
  if (typeof payload === "string") {
    return tryParseJson(payload);
  }

  return payload;
}

function extractArtifactFromToolPayload(
  payload: unknown,
): Record<string, unknown> | null {
  const normalised = normaliseToolPayload(payload);
  if (!normalised || typeof normalised !== "object") return null;

  const record = normalised as Record<string, unknown>;
  const rawArtifact =
    "artifact" in record
      ? normaliseToolPayload(record.artifact)
      : normaliseToolPayload(normalised);

  if (!rawArtifact || typeof rawArtifact !== "object") return null;

  const artifact = { ...(rawArtifact as Record<string, unknown>) };

  if (
    typeof artifact.type !== "string" &&
    typeof artifact.artifact_type === "string"
  ) {
    artifact.type = artifact.artifact_type;
  }

  if (typeof artifact.content !== "string" && Array.isArray(artifact.sheets)) {
    artifact.content = JSON.stringify({ sheets: artifact.sheets });
  }

  if (typeof artifact.title !== "string") {
    artifact.title = "Artifact";
  }

  const hasStructuredArtifact =
    typeof artifact.type === "string" && typeof artifact.content === "string";

  return hasStructuredArtifact ? artifact : null;
}

function extractDownloadFilePayload(payload: unknown): {
  fileContent: string;
  filename: string;
} | null {
  const normalised = normaliseToolPayload(payload);
  if (!normalised || typeof normalised !== "object") return null;

  const obj = normalised as {
    file_content?: unknown;
    filename?: unknown;
    structuredContent?: unknown;
    content?: Array<{ text?: unknown }>;
  };

  const candidateObjects: unknown[] = [obj, obj.structuredContent];

  if (Array.isArray(obj.content)) {
    for (const item of obj.content) {
      if (typeof item?.text === "string") {
        candidateObjects.push(normaliseToolPayload(item.text));
      }
    }
  }

  for (const candidate of candidateObjects) {
    if (!candidate || typeof candidate !== "object") continue;
    const entry = candidate as { file_content?: unknown; filename?: unknown };
    if (
      typeof entry.file_content === "string" &&
      typeof entry.filename === "string"
    ) {
      return {
        fileContent: entry.file_content,
        filename: entry.filename,
      };
    }
  }

  return null;
}

const SPREADSHEET_MUTATION_TOOL_NAMES = new Set([
  "write_cells",
  "write_multi_sheet",
]);

function isSpreadsheetMutationTool(toolName: string): boolean {
  if (SPREADSHEET_MUTATION_TOOL_NAMES.has(toolName)) {
    return true;
  }

  return toolName.startsWith("write_");
}

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
            .values([
              {
                agentId: parsed.data.agentId,
                userId: session.user.id,
                status: "running",
                dryRun: parsed.data.dryRun ?? false,
                inputAttachmentIds: Array.isArray(
                  parsed.data.inputAttachmentIds,
                )
                  ? parsed.data.inputAttachmentIds
                  : parsed.data.inputAttachmentIds
                    ? [parsed.data.inputAttachmentIds]
                    : [],
                outputAttachmentIds: [],
              },
            ])
            .returning();
          runRow = created;
          startFromStep = 0;

          logger.info(
            "[Transform AI] New run initialized",
            {
              runId: runRow.id,
              agentId: parsed.data.agentId,
              dryRun: runRow.dryRun,
            },
            session.user.id,
          );

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

          logger.info(
            "[Transform AI] Run started",
            {
              runId: runRow.id,
              agentId: runRow.agentId,
            },
            session.user.id,
          );

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

          logger.info(
            "[Transform AI] Run resumed",
            {
              runId: runRow.id,
              agentId: runRow.agentId,
              startFromStep,
            },
            session.user.id,
          );

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
        let stageIds: string[] = [];
        let attachmentRows: (typeof attachment.$inferSelect)[] = [];

        if (agentRow.requiresFileUpload) {
          const currentOutputIds: string[] = runRow.outputAttachmentIds;
          const inputIds: string[] = runRow.inputAttachmentIds;
          stageIds =
            startFromStep > 0 && currentOutputIds.length > 0
              ? currentOutputIds
              : inputIds;

          // Fetch attachment records
          attachmentRows = await db
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
        }

        // fileContext and currentAttachmentRows are regenerated per-step inside the loop
        let fileContext = "";
        let currentAttachmentRows = [...attachmentRows];
        let activeWorkbookFilePath: string | null = null;

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
          (parsed.data as { model?: string }).model ?? agentRow.modelId ?? null;

        const resolvedProvider = model
          ? await resolveProviderForModel(session.user.id, model)
          : await resolveDefaultChatProvider(session.user.id);

        // Perform global KB context retrieval if agent has knowledge bases
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

        let currentOutputAttachmentIds: string[] = stageIds;

        // Keep one MCP connection registry for the run request to avoid resetting
        // MCP-local workbook state between steps.
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

        // Run each step
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

          // Regenerate file context for this step using the current workbook state
          fileContext = "";
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

                  // Consistent formatting: serialize objects to JSON if necessary
                  const formattedResult =
                    typeof toolResultPayload === "object" &&
                    toolResultPayload !== null
                      ? JSON.stringify(toolResultPayload, null, 2)
                      : toolResultPayload;

                  // Capture manage_artifact result for the artifact panel
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

          // If the step produced a spreadsheet artifact, save it to S3 so subsequent steps
          // receive the modified file instead of re-uploading the original input.
          if (
            stepArtifact &&
            typeof (stepArtifact as any).type === "string" &&
            (stepArtifact as any).type.toLowerCase() === "spreadsheet" &&
            typeof (stepArtifact as any).content === "string"
          ) {
            try {
              const parsed = JSON.parse(
                (stepArtifact as any).content as string,
              );
              const workbook = XLSX.utils.book_new();
              for (const sheet of (parsed.sheets ?? []) as Array<{
                name?: string;
                data?: unknown[][];
              }>) {
                const ws = XLSX.utils.aoa_to_sheet(sheet.data ?? []);
                XLSX.utils.book_append_sheet(
                  workbook,
                  ws,
                  sheet.name ?? "Sheet1",
                );
              }
              const xlsxBuffer = Buffer.from(
                XLSX.write(workbook, {
                  type: "array",
                  bookType: "xlsx",
                }) as ArrayBuffer,
              );
              const outputName = `step-${i + 1}-output.xlsx`;
              const outputAttachmentId = uuidv4();
              const s3Key = `transform-outputs/${session.user.id}/${outputAttachmentId}-${outputName}`;
              await uploadObject(
                s3Key,
                xlsxBuffer,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              );
              await db.insert(attachment).values({
                id: outputAttachmentId,
                userId: session.user.id,
                transformRunId: runRow.id,
                name: outputName,
                mimeType:
                  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                size: xlsxBuffer.length,
                key: s3Key,
              });
              currentOutputAttachmentIds = [outputAttachmentId];
              stepPersistedSpreadsheetOutput = true;
              // Replace the active workbook with the new output so the next step
              // continues from the latest spreadsheet state instead of the original input.
              currentAttachmentRows = [
                {
                  id: outputAttachmentId,
                  messageId: null,
                  transformRunId: runRow.id,
                  userId: session.user.id,
                  name: outputName,
                  mimeType:
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  size: xlsxBuffer.length,
                  key: s3Key,
                  createdAt: new Date(),
                },
              ];
              logger.info(
                "[Transform AI] Active workbook replaced with step output",
                {
                  runId: runRow.id,
                  stepIndex: i,
                  activeWorkbookAttachmentId: outputAttachmentId,
                  activeWorkbookName: outputName,
                },
                session.user.id,
              );
              // Persist so resume logic picks up the latest workbook only
              await db
                .update(transformRun)
                .set({ outputAttachmentIds: currentOutputAttachmentIds })
                .where(eq(transformRun.id, runRow.id));
            } catch (xlsxErr) {
              logger.warn(
                "[Transform AI] Failed to persist step output as xlsx",
                { xlsxErr },
                session.user.id,
              );
            }
          }

          if (
            stepHasSpreadsheetMutations &&
            activeWorkbookFilePath &&
            !stepPersistedSpreadsheetOutput &&
            "download_file" in runMcpTools
          ) {
            try {
              const downloadToolSource = runToolSourceMap.download_file;
              const canUseDownloadTool =
                typeof downloadToolSource === "string" &&
                stepServerNames.has(downloadToolSource);

              if (canUseDownloadTool) {
                const downloadTool = runMcpTools.download_file as {
                  execute?: (args: { file_path: string }) => Promise<unknown>;
                };

                if (typeof downloadTool.execute === "function") {
                  const downloaded = await downloadTool.execute({
                    file_path: activeWorkbookFilePath,
                  });
                  const downloadPayload =
                    extractDownloadFilePayload(downloaded);

                  if (downloadPayload) {
                    const xlsxBuffer = Buffer.from(
                      downloadPayload.fileContent,
                      "base64",
                    );
                    const outputAttachmentId = uuidv4();
                    const outputName =
                      downloadPayload.filename ||
                      currentAttachmentRows[0]?.name ||
                      `step-${i + 1}-output.xlsx`;
                    const s3Key = `transform-outputs/${session.user.id}/${outputAttachmentId}-${outputName}`;

                    await uploadObject(
                      s3Key,
                      xlsxBuffer,
                      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    );

                    await db.insert(attachment).values({
                      id: outputAttachmentId,
                      userId: session.user.id,
                      transformRunId: runRow.id,
                      name: outputName,
                      mimeType:
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                      size: xlsxBuffer.length,
                      key: s3Key,
                    });

                    currentOutputAttachmentIds = [outputAttachmentId];
                    stepPersistedSpreadsheetOutput = true;
                    currentAttachmentRows = [
                      {
                        id: outputAttachmentId,
                        messageId: null,
                        transformRunId: runRow.id,
                        userId: session.user.id,
                        name: outputName,
                        mimeType:
                          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        size: xlsxBuffer.length,
                        key: s3Key,
                        createdAt: new Date(),
                      },
                    ];

                    await db
                      .update(transformRun)
                      .set({ outputAttachmentIds: currentOutputAttachmentIds })
                      .where(eq(transformRun.id, runRow.id));

                    logger.info(
                      "[Transform AI] Persisted step output from download_file fallback",
                      {
                        runId: runRow.id,
                        stepIndex: i,
                        outputAttachmentId,
                        outputName,
                      },
                      session.user.id,
                    );
                  }
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

          if (
            stepHasSpreadsheetMutations &&
            activeWorkbookFilePath &&
            !stepPersistedSpreadsheetOutput
          ) {
            const errorMessage = `Step \"${step.name}\" changed workbook data, but no spreadsheet artifact output was persisted. Refusing to complete with stale output.`;

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

            emit({
              type: "error",
              message: errorMessage,
            });

            controller.close();
            return;
          }

          // Read current state of files for live preview
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
          { runId: parsed.data.type !== "new" ? parsed.data.runId : undefined },
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
