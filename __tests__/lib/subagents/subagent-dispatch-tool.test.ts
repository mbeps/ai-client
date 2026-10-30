import { describe, expect, it, vi } from "vitest";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
import { constructSubagentPrompt } from "@/lib/subagents/construct-subagent-prompt";
import { createSubagentDispatchTool } from "@/lib/subagents/create-subagent-dispatch-tool";
import { getSubagentTools } from "@/lib/subagents/get-subagent-tools";
import { registerScratchpadTools } from "@/lib/subagents/register-subagent-tools";
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
        subagent_dispatch: { description: "dispatch" },
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
      expect(result).not.toHaveProperty("subagent_dispatch");
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
      expect(capturedConfig.instructions).toContain("Role: WORKER");
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
      });
      expect(capturedConfig.tools).toHaveProperty("scratchpad_write");
      expect(capturedConfig.tools.scratchpad_write.workerRole).toBe("researcher");
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
