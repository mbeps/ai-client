import http from "node:http";

const PORT = 4000;
const HOST = "127.0.0.1";

/** Deterministic 1024-dimensional normalized vector for Qdrant chunk indexing. */
function generateDeterministicVector(seed: string): number[] {
  const vec: number[] = [];
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  for (let i = 0; i < 1024; i++) {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    vec.push((h >>> 0) / 0xffffffff - 0.5);
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host || HOST}`);
  const method = req.method?.toUpperCase();

  // Set CORS headers for all responses
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");

  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Healthcheck
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", timestamp: Date.now() }));
    return;
  }

  // 2. Models Discovery
  if (
    (url.pathname === "/v1/models" || url.pathname === "/models") &&
    method === "GET"
  ) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        object: "list",
        data: [
          {
            id: "mock-gpt-4o",
            object: "model",
            created: 1700000000,
            owned_by: "mock",
          },
          {
            id: "mock-reasoning-model",
            object: "model",
            created: 1700000000,
            owned_by: "mock",
          },
          {
            id: "mock-text-embedding-3",
            object: "model",
            created: 1700000000,
            owned_by: "mock",
          },
        ],
      }),
    );
    return;
  }

  if (
    (url.pathname === "/v1/embeddings/models" ||
      url.pathname === "/embeddings/models") &&
    method === "GET"
  ) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        object: "list",
        data: [
          {
            id: "mock-text-embedding-3",
            object: "model",
            created: 1700000000,
            owned_by: "mock",
          },
        ],
      }),
    );
    return;
  }

  // Parse JSON body for POST requests
  let rawBody = "";
  if (method === "POST") {
    for await (const chunk of req) {
      rawBody += chunk;
    }
  }
  let body: any = {};
  if (rawBody) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      // Ignored if non-JSON
    }
  }

  // 3. Embeddings Endpoint
  if (
    (url.pathname === "/v1/embeddings" || url.pathname === "/embeddings") &&
    method === "POST"
  ) {
    const inputs: string[] = Array.isArray(body.input)
      ? body.input
      : typeof body.input === "string"
        ? [body.input]
        : ["mock-embedding-text"];

    const data = inputs.map((text, index) => ({
      object: "embedding",
      index,
      embedding: generateDeterministicVector(text || `chunk-${index}`),
    }));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        object: "list",
        data,
        model: body.model || "mock-text-embedding-3",
        usage: {
          prompt_tokens: inputs.length * 8,
          total_tokens: inputs.length * 8,
        },
      }),
    );
    return;
  }

  // 4. Chat Completions (OpenAI compatible)
  if (
    (url.pathname === "/v1/chat/completions" ||
      url.pathname === "/chat/completions") &&
    method === "POST"
  ) {
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const lastMsg = messages[messages.length - 1];
    const userPrompt =
      typeof lastMsg?.content === "string"
        ? lastMsg.content
        : Array.isArray(lastMsg?.content)
          ? JSON.stringify(lastMsg.content)
          : "";

    // 4A. Non-streaming (e.g. generateText in translate.ts)
    if (body.stream !== true) {
      const completionText = userPrompt.includes("Translate")
        ? "Texto traducido de prueba para verificación automatizada."
        : "Mock non-streaming response for automated testing.";

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: `chatcmpl-${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: body.model || "mock-gpt-4o",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: completionText },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 15,
            completion_tokens: 25,
            total_tokens: 40,
          },
        }),
      );
      return;
    }

    // 4B. Streaming (streamText via SSE)
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const sendChunk = (
      delta: Record<string, unknown>,
      finish_reason: string | null = null,
    ) => {
      const payload = {
        id: "chatcmpl-mock",
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: body.model || "mock-gpt-4o",
        choices: [
          {
            index: 0,
            delta,
            finish_reason,
          },
        ],
      };
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    // Case 1: Post-Tool Turn (lastMsg.role === "tool") -> Synthesize tool result
    if (lastMsg?.role === "tool") {
      sendChunk({
        role: "assistant",
        content: "Tool execution finished successfully. Result: 15.",
      });
      sendChunk({}, "stop");
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    // Case 2: User requests MCP tool execution ("TRIGGER_MCP_TOOL")
    if (userPrompt.includes("TRIGGER_MCP_TOOL")) {
      sendChunk({
        role: "assistant",
        tool_calls: [
          {
            index: 0,
            id: `call_${Date.now()}`,
            type: "function",
            function: {
              name: "calculate_sum",
              arguments: JSON.stringify({ a: 7, b: 8 }),
            },
          },
        ],
      });
      sendChunk({}, "tool_calls");
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    // Case 3: User requests Artifact creation ("TRIGGER_ARTIFACT")
    if (userPrompt.includes("TRIGGER_ARTIFACT")) {
      sendChunk({
        role: "assistant",
        tool_calls: [
          {
            index: 0,
            id: `call_art_${Date.now()}`,
            type: "function",
            function: {
              name: "manage_artifact",
              arguments: JSON.stringify({
                action: "create",
                type: "markdown",
                title: "System Architecture Spec",
                content:
                  "# Architecture Spec\n\n```mermaid\ngraph TD\nA[Browser] --> B[Next.js]\n```",
              }),
            },
          },
        ],
      });
      sendChunk({}, "tool_calls");
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    // Case 4: User requests Subagent delegation ("TRIGGER_SUBAGENT")
    if (userPrompt.includes("TRIGGER_SUBAGENT")) {
      sendChunk({
        role: "assistant",
        tool_calls: [
          {
            index: 0,
            id: `call_sub_${Date.now()}`,
            type: "function",
            function: {
              name: "delegate_task",
              arguments: JSON.stringify({
                role: "Research Analyst",
                task: "Analyze the dataset and summarize key findings",
              }),
            },
          },
        ],
      });
      sendChunk({}, "tool_calls");
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    // Case 5: Slow stream for Stop button testing ("TRIGGER_SLOW_STREAM")
    if (userPrompt.includes("TRIGGER_SLOW_STREAM")) {
      let chunkIdx = 0;
      const interval = setInterval(() => {
        chunkIdx++;
        sendChunk({ role: "assistant", content: `Slow chunk ${chunkIdx} ` });
        if (chunkIdx >= 25 || res.writableEnded) {
          clearInterval(interval);
          if (!res.writableEnded) {
            sendChunk({}, "stop");
            res.write("data: [DONE]\n\n");
            res.end();
          }
        }
      }, 150);

      req.on("close", () => {
        clearInterval(interval);
      });
      return;
    }

    // Case 6: Standard Chat Stream with Markdown, KaTeX & Code Block
    sendChunk({
      role: "assistant",
      content: "Hello! Here is the requested analysis:\n\n",
    });
    sendChunk({
      content:
        "| Metric | Value |\n|---|---|\n| Accuracy | 99.8% |\n| Latency | 12ms |\n\n",
    });
    sendChunk({ content: "The relativistic energy is $E = mc^2$.\n\n" });
    sendChunk({
      content: "```typescript\nexport const answer: number = 42;\n```\n",
    });
    sendChunk({}, "stop");
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  // 5. Model Context Protocol (Streamable HTTP MCP JSON-RPC 2.0)
  if (url.pathname === "/mcp" || url.pathname === "/mcp/") {
    const id = body?.id ?? 1;
    const mcpMethod = body?.method;

    // A. initialize handshake
    if (mcpMethod === "initialize") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
              resources: {},
              prompts: {},
            },
            serverInfo: {
              name: "mock-mcp-server",
              version: "1.0.0",
            },
          },
        }),
      );
      return;
    }

    // B. notifications/initialized (expects 202 Accepted)
    if (mcpMethod === "notifications/initialized") {
      res.writeHead(202);
      res.end();
      return;
    }

    // C. tools/list
    if (mcpMethod === "tools/list") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            tools: [
              {
                name: "calculate_sum",
                description: "Calculates the sum of two numbers a and b",
                inputSchema: {
                  type: "object",
                  properties: {
                    a: { type: "number", description: "First number" },
                    b: { type: "number", description: "Second number" },
                  },
                  required: ["a", "b"],
                },
              },
            ],
          },
        }),
      );
      return;
    }

    // D. resources/list
    if (mcpMethod === "resources/list") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            resources: [
              {
                uri: "mock://system-status",
                name: "System Status Report",
                description: "Live health status of the mock environment",
                mimeType: "text/plain",
              },
            ],
          },
        }),
      );
      return;
    }

    // E. resources/templates/list
    if (mcpMethod === "resources/templates/list") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: { resourceTemplates: [] },
        }),
      );
      return;
    }

    // F. prompts/list
    if (mcpMethod === "prompts/list") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            prompts: [
              {
                name: "mock-mcp-prompt",
                description: "Pre-configured template from mock MCP connector",
                arguments: [
                  {
                    name: "topic",
                    description: "Topic to explain",
                    required: true,
                  },
                ],
              },
            ],
          },
        }),
      );
      return;
    }

    // G. tools/call
    if (mcpMethod === "tools/call") {
      const toolName = body.params?.name;
      const args = body.params?.arguments || {};
      const sum = (Number(args.a) || 0) + (Number(args.b) || 0);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text:
                  toolName === "calculate_sum"
                    ? `Result: ${sum}`
                    : "Tool executed",
              },
            ],
            isError: false,
          },
        }),
      );
      return;
    }

    // Generic fallback for other MCP methods
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", id, result: {} }));
    return;
  }

  // Fallback 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found", path: url.pathname }));
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 Unified Mock Server listening on http://${HOST}:${PORT}`);
});

process.on("SIGTERM", () => {
  server.close();
  process.exit(0);
});

process.on("SIGINT", () => {
  server.close();
  process.exit(0);
});
