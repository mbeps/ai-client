import { z } from "zod";
import { env } from "@/lib/env";
import { auth } from "@/lib/auth/auth";
import { db } from "@/drizzle/db";
import { assistant, chat, message, mcpServer, project } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, stepCountIs, type ModelMessage, tool } from "ai";
import { getMcpTools } from "@/lib/mcp/get-mcp-tools";
import { DEFAULT_MODEL } from "@/models";
import {
  downloadAttachmentsToTemp,
  persistModifiedFiles,
  cleanupTempDir,
  type FileBridgeResult,
} from "@/lib/mcp/file-bridge";

type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image"; image: URL | string; mimeType?: string };
import { v4 as uuidv4 } from "uuid";

export const maxDuration = 60;

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: env.OPENROUTER_API_KEY,
});

/**
 * POST handler for the AI chat streaming pipeline.
 *
 * OPTIMIZATION: Project and Assistant prompts are fetched from the database and prepended
 * on the server side. This avoids sending large system prompt strings over the network
 * from the client for every message, saving significant bandwidth.
 *
 * @param req - The incoming chat request containing history and model configuration.
 * @returns A streaming response (text/event-stream) with AI content and tool events.
 * @author Maruf Bepary
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const attachmentSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(255),
    mimeType: z.string().max(100).optional(),
    type: z.enum(["image", "document", "spreadsheet"]).optional(),
    dataUrl: z.string().optional(),
    extractedText: z.string().optional(),
    key: z.string().max(1024).optional(),
  });

  const contentPartSchema = z.union([
    z.object({ type: z.literal("text"), text: z.string() }),
    z.object({
      type: z.literal("image"),
      image: z.union([z.string().url(), z.string()]),
      mimeType: z.string().optional(),
    }),
  ]);

  const messageSchema = z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.union([z.string(), z.array(contentPartSchema)]),
    id: z.string().uuid().optional(),
    parentId: z.string().uuid().optional(),
    attachments: z.array(attachmentSchema).optional(),
    metadata: z.string().nullable().optional(),
  });

  const chatRequestSchema = z.object({
    chatId: z.string().uuid(),
    userMessageId: z.string().uuid().optional(),
    model: z.string().min(1).max(100).optional(),
    messages: z.array(messageSchema).max(500),
    selectedServerIds: z.array(z.string()).max(20).optional(),
    selectedTools: z.array(z.string()).max(100).optional(),
    selectedResources: z.array(z.string()).max(100).optional(),
  });

  const body = await req.json();
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    console.error(
      "[Chat API] Invalid request:",
      JSON.stringify(parsed.error.format(), null, 2),
    );
    return Response.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    chatId,
    userMessageId,
    messages: history,
    model: requestedModel,
    selectedServerIds,
    selectedTools,
    selectedResources,
  } = parsed.data;

  const model = requestedModel ?? DEFAULT_MODEL;

  const [chatRow] = await db
    .select({
      id: chat.id,
      projectId: chat.projectId,
      assistantId: chat.assistantId,
    })
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)));

  if (!chatRow) return new Response("Not Found", { status: 404 });

  // Fetch project globalPrompt if this chat belongs to a project
  const projectRow = chatRow.projectId
    ? await db
        .select({ globalPrompt: project.globalPrompt })
        .from(project)
        .where(
          and(
            eq(project.id, chatRow.projectId),
            eq(project.userId, session.user.id),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null)
    : null;

  // Fetch assistant prompt if this chat belongs to an assistant
  const assistantRow = chatRow.assistantId
    ? await db
        .select({ prompt: assistant.prompt })
        .from(assistant)
        .where(
          and(
            eq(assistant.id, chatRow.assistantId),
            eq(assistant.userId, session.user.id),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null)
    : null;

  // Fetch enabled MCP servers for this user
  const servers = await db
    .select({
      id: mcpServer.id,
      name: mcpServer.name,
      type: mcpServer.type,
      command: mcpServer.command,
      args: mcpServer.args,
      url: mcpServer.url,
      headers: mcpServer.headers,
      env: mcpServer.env,
    })
    .from(mcpServer)
    .where(
      and(eq(mcpServer.userId, session.user.id), eq(mcpServer.enabled, true)),
    );

  const filteredServers =
    selectedServerIds && selectedServerIds.length > 0
      ? servers.filter((s) => selectedServerIds.includes(s.id))
      : servers;

  // FileBridge: download spreadsheet attachments from the LATEST user message only.
  // Re-bridging the entire history every turn would be wasteful and break
  // the assumption that modified files become new attachments on later turns.
  const lastUserMsg = [...history].reverse().find((m) => m.role === "user");
  const spreadsheetAtts: { id: string; key: string; name: string }[] = [];
  if (lastUserMsg?.attachments) {
    for (const att of lastUserMsg.attachments) {
      if (att.type === "spreadsheet" && att.key && att.id && att.name) {
        spreadsheetAtts.push({ id: att.id, key: att.key, name: att.name });
      }
    }
  }

  let bridge: FileBridgeResult | null = null;
  if (filteredServers.length > 0 && spreadsheetAtts.length > 0) {
    try {
      bridge = await downloadAttachmentsToTemp(spreadsheetAtts);
    } catch (err) {
      console.warn(
        "[FileBridge] Failed to download attachments, continuing without bridge:",
        err,
      );
    }
  }

  // Inject EXCEL_MCP_ALLOWED_DIRS into stdio MCP server envs when FileBridge is active
  const scopedServers = bridge
    ? filteredServers.map((s) => {
        if (s.type !== "stdio") return s;
        const userEnv = s.env
          ? (JSON.parse(s.env) as Record<string, string>)
          : {};
        return {
          ...s,
          env: JSON.stringify({
            ...userEnv,
            EXCEL_MCP_ALLOWED_DIRS: bridge!.tempDir,
          }),
        };
      })
    : filteredServers;

  let mcpTools: Record<string, any> = {};
  let mcpCleanup = async () => {};
  if (scopedServers.length > 0) {
    try {
      const result = await getMcpTools(
        scopedServers as Parameters<typeof getMcpTools>[0],
      );

      // Filter tools if selectedTools is provided
      if (selectedTools && selectedTools.length > 0) {
        const filteredTools: Record<string, any> = {};
        for (const [name, tool] of Object.entries(result.tools)) {
          // tool names are unique across servers in mergedTools (with collision warning)
          // But our client sends serverId:tool:toolName.
          // However, getMcpTools already merges them into a flat object.
          // To be precise, we should check if the tool name is in our selected list.
          // The client sends IDs like "serverId:tool:toolName"
          const isSelected = selectedTools.some((id) => {
            const [sId, type, tName] = id.split(":");
            return type === "tool" && tName === name;
          });
          if (isSelected) {
            filteredTools[name] = tool;
          }
        }
        mcpTools = filteredTools;
      } else {
        mcpTools = result.tools;
      }

      mcpCleanup = result.cleanup;
    } catch (error) {
      console.warn("[MCP] Failed to load tools:", error);
    }
  }

  const isArtifactToolSelected = selectedTools?.includes(
    "internal:tool:manage_artifact",
  );

  if (isArtifactToolSelected) {
    mcpTools["manage_artifact"] = tool({
      description:
        "Manage and display an interactive artifact to the user. Use this when the user asks for a document, email, text, spreadsheet, HTML UI, or Mermaid diagram.\n\n" +
        "WHAT TO DO:\n" +
        "- Set the type to strictly one of: 'markdown', 'spreadsheet', 'html', or 'mermaid'.\n" +
        "- Use 'markdown' for emails, letters, code snippets, or general text.\n" +
        "- Place the entire requested content inside the tool's 'content' parameter.\n" +
        "- After calling the tool, respond to the user with a brief 1-2 sentence summary saying the artifact was created.\n\n" +
        "WHAT NOT TO DO:\n" +
        "- NEVER repeat the content of the artifact in your main chat response.\n" +
        "- Do not provide a preview or copy of the content outside the artifact.\n" +
        "- DO NOT use this tool to read an artifact. Past artifacts (including user edits) are already fully visible in your message history.\n\n" +
        "SUCCESS CRITERIA:\n" +
        "- The user sees the rich content exclusively in the artifact panel, and your chat message only contains a short confirmation.",
      parameters: z.object({
        type: z
          .string()
          .describe(
            "The type of artifact: 'markdown', 'spreadsheet', 'html', or 'mermaid'",
          ),
        title: z.string().optional().describe("The title of the artifact"),
        content: z
          .string()
          .describe(
            "The content of the artifact. For spreadsheet, provide a JSON array of objects. For HTML, provide raw HTML. For markdown, provide markdown text. For mermaid, provide the mermaid diagram code.",
          ),
      }),
      // @ts-expect-error Vercel AI SDK type mismatch with internal tools
      execute: async (args: any) => {
        const VALID_TYPES = ["markdown", "spreadsheet", "html", "mermaid"];
        const normalizedArgs = {
          type: VALID_TYPES.includes(args.type) ? args.type : "markdown",
          title: args.title || "Generated Artifact",
          content: args.content || args.text || "",
        };
        return {
          success: true,
          message:
            "Artifact successfully displayed to the user in a separate UI panel. SUCCESS CRITERIA CHECK: DO NOT repeat the content in your text response. Simply acknowledge that the artifact is ready.",
          artifact: normalizedArgs,
        };
      },
    });
  }

  const hasMcpTools = Object.keys(mcpTools).length > 0;

  const processedMessages = history.flatMap((m) => {
    if (m.role === "user" && m.attachments && m.attachments.length > 0) {
      const parts: Array<TextPart | ImagePart> = [];

      // Add extracted document text as context
      for (const att of m.attachments) {
        if (att.type === "document" && att.extractedText) {
          parts.push({
            type: "text",
            text: `[Document: ${att.name}]\n${att.extractedText}`,
          });
        }
        if (att.type === "spreadsheet" && bridge) {
          const f = bridge.files.find((b) => b.attachmentId === att.id);
          if (f) {
            parts.push({
              type: "text",
              text: `[Spreadsheet: ${att.name} — local path: ${f.localPath}]`,
            });
          }
        }
      }

      // Add user message text
      if (typeof m.content === "string" && m.content.trim()) {
        parts.push({ type: "text", text: m.content });
      }

      // Add images
      for (const att of m.attachments) {
        if (att.type === "image" && att.dataUrl) {
          parts.push({
            type: "image",
            image: att.dataUrl,
            mimeType: att.mimeType,
          });
        }
      }

      return [
        {
          role: m.role,
          content:
            parts.length === 1 && parts[0].type === "text"
              ? (parts[0] as TextPart).text
              : parts,
        },
      ];
    }

    if (m.role === "assistant" && m.metadata) {
      try {
        const meta = JSON.parse(m.metadata);
        if (Array.isArray(meta.toolCalls) && meta.toolCalls.length > 0) {
          const parts: any[] = [];
          if (m.content && typeof m.content === "string" && m.content.trim()) {
            parts.push({ type: "text", text: m.content });
          }

          for (const tc of meta.toolCalls) {
            parts.push({
              type: "tool-call",
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              args: typeof tc.args === "string" ? JSON.parse(tc.args) : tc.args,
            });
          }

          const msgs: any[] = [{ role: "assistant", content: parts }];

          if (Array.isArray(meta.toolResults) && meta.toolResults.length > 0) {
            const resultParts = meta.toolResults.map((tr: any) => {
              const rawResult =
                typeof tr.result === "string"
                  ? JSON.parse(tr.result)
                  : tr.result;
              return {
                type: "tool-result",
                toolCallId: tr.toolCallId,
                toolName: tr.toolName,
                output: { type: "json", value: rawResult },
              };
            });
            msgs.push({ role: "tool", content: resultParts });
          }

          return msgs;
        }
      } catch (e) {
        console.warn("[Chat API] Failed to parse metadata for history:", e);
      }
    }

    return [{ role: m.role, content: m.content }];
  }) as ModelMessage[];

  // Prepend system messages: project global prompt then assistant prompt
  const systemMessages: ModelMessage[] = [];
  if (projectRow?.globalPrompt?.trim()) {
    systemMessages.push({ role: "system", content: projectRow.globalPrompt });
  }
  if (assistantRow?.prompt?.trim()) {
    systemMessages.push({ role: "system", content: assistantRow.prompt });
  }
  if (bridge && bridge.files.length > 0) {
    const lines = bridge.files
      .map((f) => `- ${f.originalName}: ${f.localPath}`)
      .join("\n");
    systemMessages.push({
      role: "system",
      content: `IMPORTANT: The user has attached spreadsheet files. They have been downloaded to the local filesystem for you to analyse using the available Excel MCP tools. You MUST use the Excel MCP tools (e.g. get_workbook_metadata, read_cells, profile_data, etc.) to read and analyse these files. Do NOT ask the user for a file path — the paths are provided below. Pass the exact path to the file_path parameter of any Excel MCP tool call:\n${lines}`,
    });
  }
  const finalMessages: ModelMessage[] = [
    ...systemMessages,
    ...processedMessages,
  ];

  // Use .chat() to force the Chat Completions API endpoint (/chat/completions)
  // rather than the OpenAI Responses API (/responses), which OpenRouter does not support.
  const result = streamText({
    model: openrouter.chat(model),
    messages: finalMessages,
    tools: hasMcpTools ? mcpTools : undefined,
    stopWhen: hasMcpTools ? stepCountIs(10) : undefined,
  });

  const assistantMessageId = uuidv4();
  let fullText = "";
  let fullReasoning = "";

  const encode = (data: object) =>
    new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const toolCalls: {
          toolCallId: string;
          toolName: string;
          args: unknown;
        }[] = [];
        const toolResults: {
          toolCallId: string;
          toolName: string;
          result: unknown;
        }[] = [];

        try {
          for await (const chunk of result.fullStream) {
            switch (chunk.type) {
              case "text-delta":
                fullText += chunk.text;
                controller.enqueue(encode({ type: "text", delta: chunk.text }));
                break;

              case "tool-call":
                toolCalls.push({
                  toolCallId: chunk.toolCallId,
                  toolName: chunk.toolName,
                  args: chunk.input,
                });
                controller.enqueue(
                  encode({
                    type: "tool-call",
                    toolCallId: chunk.toolCallId,
                    toolName: chunk.toolName,
                    args: chunk.input,
                  }),
                );
                break;

              case "tool-result":
                toolResults.push({
                  toolCallId: chunk.toolCallId,
                  toolName: chunk.toolName,
                  result: chunk.output,
                });
                controller.enqueue(
                  encode({
                    type: "tool-result",
                    toolCallId: chunk.toolCallId,
                    toolName: chunk.toolName,
                    result: chunk.output,
                  }),
                );
                break;

              case "reasoning-delta":
                fullReasoning += chunk.text;
                controller.enqueue(
                  encode({ type: "reasoning", delta: chunk.text }),
                );
                break;

              case "error":
                controller.enqueue(
                  encode({ type: "error", message: String(chunk.error) }),
                );
                break;
            }
          }
        } catch (error: any) {
          console.error("[Chat API Error]:", error);
          let message = "An error occurred during generation";
          let code = "ERROR";

          if (
            error.name === "AI_RetryError" ||
            error.name === "AI_APICallError"
          ) {
            const statusCode = error.statusCode || error.lastError?.statusCode;
            if (statusCode === 429) {
              message =
                "Too many requests. Please try again later or add your own API key.";
              code = "RATE_LIMIT";
            } else if (error.message?.includes("rate-limited")) {
              message =
                "The AI provider is temporarily rate-limited. Please try again shortly.";
              code = "RATE_LIMIT";
            }
          }

          controller.enqueue(encode({ type: "error", message, code }));
          controller.close();
          return;
        }

        if (!fullText && toolCalls.length === 0 && !fullReasoning) {
          controller.enqueue(
            encode({ type: "error", message: "No response from model" }),
          );
          controller.close();
          return;
        }

        const metadataObj: Record<string, unknown> = {};
        if (toolCalls.length > 0) {
          metadataObj.toolCalls = toolCalls;
          metadataObj.toolResults = toolResults;
        }
        if (fullReasoning) {
          metadataObj.reasoning = fullReasoning;
        }
        metadataObj.model = model;
        const metadata =
          Object.keys(metadataObj).length > 0
            ? JSON.stringify(metadataObj)
            : null;

        await db.insert(message).values({
          id: assistantMessageId,
          chatId,
          role: "assistant",
          content: fullText,
          parentId: userMessageId,
          metadata,
        });

        await db
          .update(chat)
          .set({ currentLeafId: assistantMessageId, updatedAt: new Date() })
          .where(eq(chat.id, chatId));

        if (bridge) {
          try {
            const modified = await persistModifiedFiles({
              files: bridge.files,
              userId: session.user.id,
              assistantMessageId,
            });
            for (const mod of modified) {
              controller.enqueue(
                encode({
                  type: "file-modified",
                  attachmentId: mod.newAttachmentId,
                  messageId: assistantMessageId,
                  name: mod.name,
                  mimeType: mod.mimeType,
                  size: mod.size,
                }),
              );
            }
          } catch (err) {
            console.warn("[FileBridge] Failed to persist modified files:", err);
            controller.enqueue(
              encode({
                type: "error",
                message: "Failed to save modified spreadsheet(s)",
                code: "BRIDGE_PERSIST_FAILED",
              }),
            );
          }
        }

        controller.enqueue(
          encode({
            type: "done",
            id: assistantMessageId,
            metadata: metadata ? JSON.parse(metadata) : undefined,
          }),
        );
      } catch (_err) {
        controller.enqueue(encode({ type: "error", message: "Stream failed" }));
      } finally {
        if (bridge) {
          await cleanupTempDir(bridge.tempDir).catch((err) =>
            console.warn("[FileBridge] Temp cleanup failed:", err),
          );
        }
        await mcpCleanup();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
