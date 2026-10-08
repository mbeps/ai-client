import { describe, expect, it, vi } from "vitest";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
import {
  constructSubagentPrompt,
  createSubagentDispatchTool,
  getSubagentTools,
} from "@/lib/subagents/subagent-dispatch-tool";
import * as aiModule from "ai";

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
    it("strictly strips delegate_task, manage_artifact, and user excluded tools", () => {
      const mockTools = {
        delegate_task: { description: "delegate" },
        subagent_dispatch: { description: "dispatch" },
        manage_artifact: { description: "manage artifact" },
        [INTERNAL_TOOL_IDS.MANAGE_ARTIFACT]: { description: "manage artifact full" },
        scratchpad_write: { description: "write" },
        scratchpad_read: { description: "read" },
        search_knowledge_base: { description: "kb" },
        custom_scraper: { description: "scraper" },
      };

      const result = getSubagentTools(mockTools, ["custom_scraper"]);

      expect(result).toHaveProperty("scratchpad_write");
      expect(result).toHaveProperty("scratchpad_read");
      expect(result).toHaveProperty("search_knowledge_base");

      // Verify strict exclusion
      expect(result).not.toHaveProperty("delegate_task");
      expect(result).not.toHaveProperty("subagent_dispatch");
      expect(result).not.toHaveProperty("manage_artifact");
      expect(result).not.toHaveProperty(INTERNAL_TOOL_IDS.MANAGE_ARTIFACT);
      expect(result).not.toHaveProperty("custom_scraper");
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
    });
  });
});
