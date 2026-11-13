import { describe, expect, it, vi } from "vitest";
import { BUILT_IN_AGENTS } from "@/config/built-in-agents";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
import { DEFAULT_AGENT_GUARDRAILS } from "@/drizzle/schemas/agent-schema";
import { constructSubagentPrompt } from "@/lib/subagents/construct-subagent-prompt";
import { createSubagentDispatchTool } from "@/lib/subagents/create-subagent-dispatch-tool";
import { getSubagentTools } from "@/lib/subagents/get-subagent-tools";
import { registerScratchpadTools } from "@/lib/subagents/register-subagent-tools";
import type { Agent } from "@/types/agent/agent";
import * as aiModule from "ai";

vi.mock("@/lib/subagents/register-subagent-tools", () => ({
  registerScratchpadTools: vi.fn((context) => ({
    scratchpad_write: {
      description: `write-${context.workerRole}`,
      workerRole: context.workerRole,
    },
    scratchpad_read: { description: "read" },
    scratchpad_list: { description: "list" },
  })),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof aiModule>();
  return {
    ...actual,
    ToolLoopAgent: vi.fn(),
    readUIMessageStream: vi.fn(),
    toUIMessageStream: vi.fn(),
    isStepCount: vi.fn().mockReturnValue("step-count-checker"),
  };
});

describe("subagent-dispatch-tool", () => {
  describe("getSubagentTools", () => {
    it("strictly strips delegate_task and manage_artifact", () => {
      const mockTools = {
        delegate_task: { description: "delegate" },
        [INTERNAL_TOOL_IDS.DELEGATE_TASK]: { description: "delegate internal" },
        manage_artifact: { description: "manage artifact" },
        [INTERNAL_TOOL_IDS.MANAGE_ARTIFACT]: { description: "manage artifact full" },
        scratchpad_write: { description: "write" },
        scratchpad_read: { description: "read" },
        search_knowledge_base: { description: "kb" },
      };

      const result = getSubagentTools(mockTools);

      expect(result).toHaveProperty("scratchpad_write");
      expect(result).toHaveProperty("scratchpad_read");
      expect(result).toHaveProperty("search_knowledge_base");

      // Verify strict exclusion
      expect(result).not.toHaveProperty("delegate_task");
      expect(result).not.toHaveProperty(INTERNAL_TOOL_IDS.DELEGATE_TASK);
      expect(result).not.toHaveProperty("manage_artifact");
      expect(result).not.toHaveProperty(INTERNAL_TOOL_IDS.MANAGE_ARTIFACT);
    });

    it("strictly strips skill mutation tools while preserving read-only and other tools", () => {
      const mockTools = {
        create_skill: { description: "create" },
        update_skill: { description: "update" },
        write_skill_file: { description: "write file" },
        delete_skill_file: { description: "delete file" },
        [INTERNAL_TOOL_IDS.MANAGE_SKILL]: { description: "manage skill" },
        read_skill_file: { description: "read file" },
        load_skill: { description: "load skill" },
        custom_tool: { description: "custom" },
      };

      const result = getSubagentTools(mockTools);

      expect(result).toHaveProperty("read_skill_file");
      expect(result).toHaveProperty("load_skill");
      expect(result).toHaveProperty("custom_tool");
      expect(result).not.toHaveProperty("create_skill");
      expect(result).not.toHaveProperty("update_skill");
      expect(result).not.toHaveProperty("write_skill_file");
      expect(result).not.toHaveProperty("delete_skill_file");
      expect(result).not.toHaveProperty(INTERNAL_TOOL_IDS.MANAGE_SKILL);
    });
  });

  describe("constructSubagentPrompt", () => {
    it("contains role, constraints, and reporting contract", () => {
      const prompt = constructSubagentPrompt({
        isSubagent: true,
        agentRole: "researcher",
        parentInvocationId: "inv-1",
        runId: "run-1",
        allocatedModel: "model-1",
      });

      expect(prompt).toContain("Role: RESEARCHER");
      expect(prompt).toContain("depth limit d=1");
      expect(prompt).toContain("cannot manipulate the user's canvas");
      expect(prompt).toContain("REPORTING CONTRACT");
      expect(prompt).toContain("STATUS: DONE");
      expect(prompt).toContain("scratchpad_write");
    });

    it("combines custom agent prompt, subagentPrompt, scratchpadAccess modes, scratchpadFiles, and preloaded skills", () => {
      const customAgent: Agent = {
        id: "agent-sql-1",
        userId: "user-1",
        name: "SQL Analyst",
        description: "SQL expert",
        prompt: "You are a PostgreSQL specialist.",
        subagentPrompt: "Always check EXPLAIN ANALYZE.",
        modelId: "gpt-4o",
        knowledgebaseIds: [],
        tools: [],
        skillMode: "dynamic",
        skillIds: [],
        promptMode: "all",
        promptIds: [],
        subagentIds: [],
        guardrails: {
          maxSteps: 15,
          scratchpadAccess: "read_only",
          isolateTools: true,
        },
        avatar: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const readOnlyPrompt = constructSubagentPrompt({
        isSubagent: true,
        agentRole: "SQL Analyst",
        agent: customAgent,
        parentInvocationId: "inv-2",
        runId: "run-2",
        allocatedModel: "gpt-4o",
        scratchpadAccess: "read_only",
        scratchpadFiles: ["notes/schema.md"],
        preloadedSkillInstructions: ["## Skill: sql-tuning\nUse indexes."],
      });

      expect(readOnlyPrompt).toContain("You are a PostgreSQL specialist.");
      expect(readOnlyPrompt).toContain("Always check EXPLAIN ANALYZE.");
      expect(readOnlyPrompt).toContain("read-only access to the shared scratchpad");
      expect(readOnlyPrompt).not.toContain("Use scratchpad_write");
      expect(readOnlyPrompt).toContain("notes/schema.md");
      expect(readOnlyPrompt).toContain("## Skill: sql-tuning");

      const nonePrompt = constructSubagentPrompt({
        isSubagent: true,
        agentRole: "SQL Analyst",
        agent: { ...customAgent, guardrails: { ...customAgent.guardrails, scratchpadAccess: "none" } },
        parentInvocationId: "inv-3",
        runId: "run-3",
        allocatedModel: "gpt-4o",
        scratchpadAccess: "none",
      });

      expect(nonePrompt).not.toContain("scratchpad_write");
      expect(nonePrompt).not.toContain("scratchpad_read");
    });
  });

  describe("createSubagentDispatchTool", () => {
    const mockDefaultModel = { modelId: "gpt-4o-default" };
    const mockWorkerModel = { modelId: "claude-3-5-sonnet" };
    const mockTools = {
      scratchpad_write: { description: "write" },
      scratchpad_read: { description: "read" },
    };

    it("creates a tool with proper description and schema", () => {
      const dispatchTool = createSubagentDispatchTool({
        defaultModel: mockDefaultModel,
        availableTools: mockTools,
      });

      expect(dispatchTool.description).toContain("Delegates an isolated");
      expect(dispatchTool.inputSchema).toBeDefined();
    });

    it("executes successfully and streams ui chunks", async () => {
      const mockStreamAsyncIterator = async function* () {
        yield { id: "msg-1", role: "assistant", parts: [{ type: "text", text: "Working..." }] };
        yield { id: "msg-1", role: "assistant", parts: [{ type: "text", text: "STATUS: DONE - Finished." }] };
      };

      vi.mocked(aiModule.readUIMessageStream).mockReturnValue(mockStreamAsyncIterator() as any);
      vi.mocked(aiModule.toUIMessageStream).mockReturnValue({} as any);

      const mockStream = vi.fn().mockResolvedValue({
        stream: {},
      });
      (vi.mocked(aiModule.ToolLoopAgent) as any).mockImplementation(function (this: any, config: any) {
        this.config = config;
        this.stream = mockStream;
      });

      const dispatchTool = createSubagentDispatchTool({
        defaultModel: mockDefaultModel,
        customWorkerModel: mockWorkerModel,
        availableTools: mockTools,
      });

      const generator = dispatchTool.execute(
        {
          role: "researcher",
          taskBrief: "Analyze performance traces",
          inputData: "traces.json",
        },
        { abortSignal: undefined } as any,
      );

      const yielded: any[] = [];
      for await (const chunk of generator) {
        yielded.push(chunk);
      }

      expect(yielded).toHaveLength(2);
      expect(yielded[0].parts[0].text).toBe("Working...");
      expect(yielded[1].parts[0].text).toBe("STATUS: DONE - Finished.");
      expect(mockStream).toHaveBeenCalledWith({
        prompt: "TASK BRIEF:\nAnalyze performance traces\n\nINPUT DATA:\ntraces.json",
        abortSignal: undefined,
      });
    });

    it("falls back to default model when customWorkerModel is not provided", async () => {
      let capturedConfig: any;
      (vi.mocked(aiModule.ToolLoopAgent) as any).mockImplementation(function (this: any, config: any) {
        capturedConfig = config;
        this.stream = vi.fn().mockResolvedValue({ stream: {} });
      });

      const mockStreamAsyncIterator = async function* () {
        yield { id: "m-1", role: "assistant", parts: [] };
      };
      vi.mocked(aiModule.readUIMessageStream).mockReturnValue(mockStreamAsyncIterator() as any);

      const dispatchTool = createSubagentDispatchTool({
        defaultModel: "plain-model-string",
        availableTools: mockTools,
      });

      const generator = dispatchTool.execute(
        {
          role: "worker",
          taskBrief: "Simple task",
        },
        { abortSignal: undefined } as any,
      );

      for await (const _ of generator) {
        // exhaust
      }

      expect(capturedConfig.model).toBe("plain-model-string");
      expect(capturedConfig.instructions).toContain("Role: Worker (builtin:worker)");
    });

    it("binds scratchpad tools with the worker role when scratchpadContext is provided", async () => {
      let capturedConfig: any;
      (vi.mocked(aiModule.ToolLoopAgent) as any).mockImplementation(function (this: any, config: any) {
        capturedConfig = config;
        this.stream = vi.fn().mockResolvedValue({ stream: {} });
      });

      const mockStreamAsyncIterator = async function* () {
        yield { id: "m-1", role: "assistant", parts: [] };
      };
      vi.mocked(aiModule.readUIMessageStream).mockReturnValue(mockStreamAsyncIterator() as any);

      const dispatchTool = createSubagentDispatchTool({
        defaultModel: mockDefaultModel,
        availableTools: {
          scratchpad_write: { description: "orchestrator-write" },
        },
        scratchpadContext: {
          chatId: "chat-attr-1",
          messageId: "msg-attr-1",
        },
      });

      const generator = dispatchTool.execute(
        {
          role: "researcher",
          taskBrief: "Research role attribution",
        },
        { abortSignal: undefined } as any,
      );

      for await (const _ of generator) {
        // exhaust
      }

      expect(registerScratchpadTools).toHaveBeenCalledWith({
        chatId: "chat-attr-1",
        messageId: "msg-attr-1",
        workerRole: "researcher",
        scratchpadAccess: "read_write",
      });
      expect(capturedConfig.tools).toHaveProperty("scratchpad_write");
      expect(capturedConfig.tools.scratchpad_write.workerRole).toBe("researcher");
    });

    it("resolves custom allowedSubagents by id or name, enforces guardrails, modelId, and isolateTools", async () => {
      let capturedConfig: any;
      (vi.mocked(aiModule.ToolLoopAgent) as any).mockImplementation(function (this: any, config: any) {
        capturedConfig = config;
        this.stream = vi.fn().mockResolvedValue({ stream: {} });
      });

      const mockStreamAsyncIterator = async function* () {
        yield { id: "m-1", role: "assistant", parts: [{ type: "text", text: "STATUS: DONE" }] };
      };
      vi.mocked(aiModule.readUIMessageStream).mockReturnValue(mockStreamAsyncIterator() as any);

      const customAgent: Agent = {
        id: "11111111-1111-4111-8111-111111111111",
        userId: "user-1",
        name: "Data Analyst",
        description: "Analyzes CSVs",
        prompt: "You analyze data.",
        subagentPrompt: "Keep answers tabular.",
        modelId: "custom-model-id",
        knowledgebaseIds: ["kb-1"],
        tools: ["search_knowledge_base"],
        skillMode: "dynamic",
        skillIds: [],
        promptMode: "all",
        promptIds: [],
        subagentIds: [],
        guardrails: {
          maxSteps: 22,
          scratchpadAccess: "read_only",
          isolateTools: true,
        },
        avatar: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const resolveModelById = vi.fn((id: string) => ({ modelId: `resolved:${id}` }));
      const buildIsolatedTools = vi.fn(async () => ({
        search_knowledge_base: { description: "isolated-kb" },
        delegate_task: { description: "should-be-stripped" },
      }));

      const dispatchTool = createSubagentDispatchTool({
        defaultModel: mockDefaultModel,
        availableTools: {
          search_knowledge_base: { description: "parent-kb" },
          other_tool: { description: "parent-other" },
        },
        allowedSubagents: [BUILT_IN_AGENTS[0], customAgent],
        resolveModelById,
        buildIsolatedTools,
        scratchpadContext: {
          chatId: "chat-iso-1",
          messageId: "msg-iso-1",
        },
      });

      const generator = dispatchTool.execute(
        {
          agent: "Data Analyst",
          taskBrief: "Analyze dataset",
        },
        { abortSignal: undefined } as any,
      );

      for await (const _ of generator) {
        // exhaust
      }

      expect(resolveModelById).toHaveBeenCalledWith("custom-model-id");
      expect(capturedConfig.model).toEqual({ modelId: "resolved:custom-model-id" });
      expect(aiModule.isStepCount).toHaveBeenCalledWith(22);
      expect(buildIsolatedTools).toHaveBeenCalledWith(customAgent);
      expect(capturedConfig.tools).toHaveProperty("search_knowledge_base");
      expect(capturedConfig.tools).not.toHaveProperty("delegate_task");
      expect(capturedConfig.tools).not.toHaveProperty("other_tool");
      expect(registerScratchpadTools).toHaveBeenCalledWith({
        chatId: "chat-iso-1",
        messageId: "msg-iso-1",
        workerRole: "Data Analyst",
        scratchpadAccess: "read_only",
      });
      expect(capturedConfig.instructions).toContain("You analyze data.");
      expect(capturedConfig.instructions).toContain("Keep answers tabular.");
    });

    it("filters availableTools by targetAgent.tools when isolateTools is true and buildIsolatedTools is omitted", async () => {
      let capturedConfig: any;
      (vi.mocked(aiModule.ToolLoopAgent) as any).mockImplementation(function (this: any, config: any) {
        capturedConfig = config;
        this.stream = vi.fn().mockResolvedValue({ stream: {} });
      });

      const mockStreamAsyncIterator = async function* () {
        yield { id: "m-1", role: "assistant", parts: [] };
      };
      vi.mocked(aiModule.readUIMessageStream).mockReturnValue(mockStreamAsyncIterator() as any);

      const customAgent: Agent = {
        id: "22222222-2222-4222-8222-222222222222",
        userId: "user-1",
        name: "Focused Worker",
        description: "Uses only allowed tools",
        prompt: "Focused prompt",
        subagentPrompt: "",
        modelId: null,
        knowledgebaseIds: [],
        tools: [
          "internal:tool:search_knowledge_base",
          "srv1:tool:fetch_data",
          "srv1:tool:",
          "custom_raw_tool",
        ],
        skillMode: "none",
        skillIds: [],
        promptMode: "none",
        promptIds: [],
        subagentIds: [],
        guardrails: {
          ...DEFAULT_AGENT_GUARDRAILS,
          maxSteps: 5,
          scratchpadAccess: "none",
          isolateTools: true,
        },
        avatar: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const dispatchTool = createSubagentDispatchTool({
        defaultModel: mockDefaultModel,
        availableTools: {
          search_knowledge_base: { description: "kb" },
          fetch_data: { description: "mcp" },
          custom_raw_tool: { description: "raw" },
          save_memory: { description: "memory" },
        },
        allowedSubagents: [customAgent],
      });

      const generator = dispatchTool.execute(
        {
          agent: "22222222-2222-4222-8222-222222222222",
          taskBrief: "Run focused task",
        },
        { abortSignal: undefined } as any,
      );

      for await (const _ of generator) {
        // exhaust
      }

      expect(capturedConfig.tools).toHaveProperty("search_knowledge_base");
      expect(capturedConfig.tools).toHaveProperty("fetch_data");
      expect(capturedConfig.tools).toHaveProperty("custom_raw_tool");
      expect(capturedConfig.tools).not.toHaveProperty("save_memory");
    });

    it("resolves builtin: prefix in agent parameter and falls back to defaultModel when resolveModelById is omitted", async () => {
      let capturedConfig: any;
      (vi.mocked(aiModule.ToolLoopAgent) as any).mockImplementation(function (this: any, config: any) {
        capturedConfig = config;
        this.stream = vi.fn().mockResolvedValue({ stream: {} });
      });

      const mockStreamAsyncIterator = async function* () {
        yield { id: "m-1", role: "assistant", parts: [] };
      };
      vi.mocked(aiModule.readUIMessageStream).mockReturnValue(mockStreamAsyncIterator() as any);

      const customWithModel = {
        ...BUILT_IN_AGENTS[0],
        modelId: "some-model-id",
      };

      const dispatchTool = createSubagentDispatchTool({
        defaultModel: mockDefaultModel,
        availableTools: mockTools,
        allowedSubagents: [customWithModel],
      });

      for await (const _ of dispatchTool.execute(
        {
          agent: "builtin:researcher",
          taskBrief: "Research with builtin prefix",
        },
        { abortSignal: undefined } as any,
      )) {
        // exhaust
      }

      expect(capturedConfig.model).toBe(mockDefaultModel);
    });

    it("returns STATUS: BLOCKED when requested agent is not in allowedSubagents or missing", async () => {
      const dispatchTool = createSubagentDispatchTool({
        defaultModel: mockDefaultModel,
        availableTools: mockTools,
        allowedSubagents: [BUILT_IN_AGENTS[0]],
      });

      const unlinkedChunks: any[] = [];
      for await (const chunk of dispatchTool.execute(
        {
          agent: "non-existent-agent",
          taskBrief: "Do something",
        },
        { abortSignal: undefined } as any,
      )) {
        unlinkedChunks.push(chunk);
      }

      expect(unlinkedChunks).toHaveLength(1);
      expect(unlinkedChunks[0].parts[0].text).toContain("STATUS: BLOCKED");
      expect(unlinkedChunks[0].parts[0].text).toContain("builtin:researcher");

      const emptyChunks: any[] = [];
      for await (const chunk of dispatchTool.execute(
        {
          taskBrief: "Do something without agent",
        },
        { abortSignal: undefined } as any,
      )) {
        emptyChunks.push(chunk);
      }

      expect(emptyChunks).toHaveLength(1);
      expect(emptyChunks[0].parts[0].text).toContain("STATUS: BLOCKED");

      const emptyAllowedTool = createSubagentDispatchTool({
        defaultModel: mockDefaultModel,
        availableTools: mockTools,
        allowedSubagents: [],
      });

      const roleBlockedChunks: any[] = [];
      for await (const chunk of emptyAllowedTool.execute(
        {
          role: "planner",
          taskBrief: "Plan with no allowed subagents",
        },
        { abortSignal: undefined } as any,
      )) {
        roleBlockedChunks.push(chunk);
      }

      expect(roleBlockedChunks).toHaveLength(1);
      expect(roleBlockedChunks[0].parts[0].text).toContain("planner");
      expect(roleBlockedChunks[0].parts[0].text).toContain("Available subagents: none.");
    });

    it("throttles intermediate UI chunks to at least 150ms and emits the final chunk", async () => {
      (vi.mocked(aiModule.ToolLoopAgent) as any).mockImplementation(function (this: any, config: any) {
        this.config = config;
        this.stream = vi.fn().mockResolvedValue({ stream: {} });
      });

      // 5 chunks emitted rapidly:
      // chunk 0 at t=0
      // chunk 1 at t=30
      // chunk 2 at t=60
      // chunk 3 at t=160
      // chunk 4 at t=180
      const timestamps = [0, 30, 60, 160, 180, 200];
      let timeIndex = 0;
      const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => timestamps[timeIndex++] ?? 200);

      const mockStreamAsyncIterator = async function* () {
        yield { id: "m-0", role: "assistant", parts: [{ type: "text", text: "chunk-0" }] };
        yield { id: "m-1", role: "assistant", parts: [{ type: "text", text: "chunk-1" }] };
        yield { id: "m-2", role: "assistant", parts: [{ type: "text", text: "chunk-2" }] };
        yield { id: "m-3", role: "assistant", parts: [{ type: "text", text: "chunk-3" }] };
        yield { id: "m-4", role: "assistant", parts: [{ type: "text", text: "chunk-4" }] };
      };
      vi.mocked(aiModule.readUIMessageStream).mockReturnValue(mockStreamAsyncIterator() as any);

      const dispatchTool = createSubagentDispatchTool({
        defaultModel: mockDefaultModel,
        availableTools: mockTools,
      });

      const generator = dispatchTool.execute(
        {
          role: "worker",
          taskBrief: "Stream throttle test",
        },
        { abortSignal: undefined } as any,
      );

      const yielded: any[] = [];
      for await (const chunk of generator) {
        yielded.push(chunk);
      }

      nowSpy.mockRestore();

      // chunk-0 yielded at t=0 (first chunk)
      // chunk-1 (t=30) throttled (<150ms)
      // chunk-2 (t=60) throttled (<150ms)
      // chunk-3 yielded at t=160 (160 - 0 >= 150)
      // chunk-4 (t=180) throttled, but then yielded as the final chunk after loop
      expect(yielded).toHaveLength(3);
      expect(yielded[0].parts[0].text).toBe("chunk-0");
      expect(yielded[1].parts[0].text).toBe("chunk-3");
      expect(yielded[2].parts[0].text).toBe("chunk-4");
    });

    it("catches worker errors and yields BLOCKED status message", async () => {
      (vi.mocked(aiModule.ToolLoopAgent) as any).mockImplementation(function (this: any) {
        this.stream = vi.fn().mockRejectedValue(new Error("Worker connection timeout"));
      });

      const dispatchTool = createSubagentDispatchTool({
        defaultModel: mockDefaultModel,
        availableTools: mockTools,
      });

      const generator = dispatchTool.execute(
        {
          role: "planner",
          taskBrief: "Plan architecture",
        },
        { abortSignal: undefined } as any,
      );

      const yielded: any[] = [];
      for await (const chunk of generator) {
        yielded.push(chunk);
      }

      expect(yielded).toHaveLength(1);
      expect(yielded[0].role).toBe("assistant");
      expect(yielded[0].parts[0].text).toContain("STATUS: BLOCKED - Worker execution failed: Worker connection timeout");
    });

    it("catches non-Error thrown objects and yields BLOCKED status message", async () => {
      (vi.mocked(aiModule.ToolLoopAgent) as any).mockImplementation(function (this: any) {
        this.stream = vi.fn().mockRejectedValue("string failure");
      });

      const dispatchTool = createSubagentDispatchTool({
        defaultModel: mockDefaultModel,
        availableTools: mockTools,
      });

      const generator = dispatchTool.execute(
        {
          role: "reviewer",
          taskBrief: "Review PR",
        },
        { abortSignal: undefined } as any,
      );

      const yielded: any[] = [];
      for await (const chunk of generator) {
        yielded.push(chunk);
      }

      expect(yielded).toHaveLength(1);
      expect(yielded[0].parts[0].text).toContain("STATUS: BLOCKED - Worker execution failed: Subagent worker failed");
    });

    describe("toModelOutput", () => {
      const dispatchTool = createSubagentDispatchTool({
        defaultModel: mockDefaultModel,
        availableTools: mockTools,
      });

      it("handles string output directly", () => {
        const result = dispatchTool.toModelOutput({ output: "Direct text output" } as any);
        expect(result).toEqual({
          type: "text",
          value: "Direct text output",
        });
      });

      it("extracts last text part from UIMessage output", () => {
        const result = dispatchTool.toModelOutput({
          output: {
            parts: [
              { type: "step-start" },
              { type: "text", text: "First draft" },
              { type: "text", text: "STATUS: DONE - Final summary." },
            ],
          },
        } as any);

        expect(result).toEqual({
          type: "text",
          value: "STATUS: DONE - Final summary.",
        });
      });

      it("provides fallback text if output has no text parts", () => {
        const result = dispatchTool.toModelOutput({
          output: {
            parts: [{ type: "tool-call" }],
          },
        } as any);

        expect(result).toEqual({
          type: "text",
          value: "Subagent finished with no text output.",
        });
      });

      it("handles undefined or empty output gracefully", () => {
        const result = dispatchTool.toModelOutput({ output: null } as any);
        expect(result).toEqual({
          type: "text",
          value: "Subagent finished with no text output.",
        });
      });

      it("falls back to default message when object output has no known fields or parts", () => {
        const result = dispatchTool.toModelOutput({
          output: { unknownField: 123 },
        } as any);
        expect(result).toEqual({
          type: "text",
          value: "Subagent finished with no text output.",
        });
      });

      it("extracts summary from object with summary property", () => {
        const result = dispatchTool.toModelOutput({
          output: { summary: "Executive summary of findings." },
        } as any);
        expect(result).toEqual({
          type: "text",
          value: "Executive summary of findings.",
        });
      });

      it("extracts value from object with value property", () => {
        const result = dispatchTool.toModelOutput({
          output: { value: "Direct worker value output." },
        } as any);
        expect(result).toEqual({
          type: "text",
          value: "Direct worker value output.",
        });
      });

      it("extracts text from object with text property", () => {
        const result = dispatchTool.toModelOutput({
          output: { text: "Direct worker text output." },
        } as any);
        expect(result).toEqual({
          type: "text",
          value: "Direct worker text output.",
        });
      });

      it("joins multiple text parts when last part has no status prefix", () => {
        const result = dispatchTool.toModelOutput({
          output: {
            parts: [
              { type: "text", text: "Part 1 initial thoughts." },
              { type: "text", text: "Part 2 detailed observations." },
            ],
          },
        } as any);
        expect(result).toEqual({
          type: "text",
          value: "Part 1 initial thoughts.\n\nPart 2 detailed observations.",
        });
      });

      it("truncates output exceeding 8,000 characters with warning banner", () => {
        const longText = "A".repeat(8500);
        const result = dispatchTool.toModelOutput({
          output: longText,
        } as any);
        expect(result.value).toContain(
          "[... Output truncated to 8,000 characters for context efficiency. Full details are stored in the scratchpad.]",
        );
        expect(result.value.startsWith("A".repeat(8000))).toBe(true);
      });
    });
  });
});
