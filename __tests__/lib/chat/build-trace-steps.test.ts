import { describe, expect, it } from "vitest";
import { buildTraceSteps } from "@/lib/chat/build-trace-steps";
import type { ToolCallState } from "@/types/tool/tool-call";

describe("buildTraceSteps", () => {
  it("omits reasoning step when reasoning is absent or empty and not streaming", () => {
    const steps = buildTraceSteps({
      reasoning: "   ",
      isStreamingReasoning: false,
    });
    expect(steps).toEqual([]);
  });

  it("adds reasoning step when streaming even if text is empty", () => {
    const steps = buildTraceSteps({
      reasoning: "",
      isStreamingReasoning: true,
    });
    expect(steps).toEqual([
      {
        kind: "reasoning",
        key: "reasoning",
        text: "",
        running: true,
      },
    ]);
  });

  it("adds reasoning step when persisted with content", () => {
    const steps = buildTraceSteps({
      reasoning: "Thinking about the solution...",
      isStreamingReasoning: false,
    });
    expect(steps).toEqual([
      {
        kind: "reasoning",
        key: "reasoning",
        text: "Thinking about the solution...",
        running: false,
      },
    ]);
  });

  describe("active tool calls", () => {
    it("maps standard and MCP tools during streaming", () => {
      const active: ToolCallState[] = [
        {
          toolCallId: "call-1",
          toolName: "web_search",
          args: { query: "weather" },
          status: "calling",
        },
        {
          toolCallId: "call-2",
          toolName: "get_file",
          serverName: "filesystem",
          args: { path: "/a.txt" },
          result: { content: "hello" },
          status: "complete",
        },
      ];

      const steps = buildTraceSteps({
        activeToolCalls: active,
      });

      expect(steps).toEqual([
        {
          kind: "tool",
          key: "active-call-1",
          toolCallId: "call-1",
          toolName: "web_search",
          serverName: undefined,
          isMcp: false,
          args: { query: "weather" },
          result: undefined,
          state: "running",
        },
        {
          kind: "tool",
          key: "active-call-2",
          toolCallId: "call-2",
          toolName: "get_file",
          serverName: "filesystem",
          isMcp: true,
          args: { path: "/a.txt" },
          result: { content: "hello" },
          state: "done",
        },
      ]);
    });

    it("marks completed active tool as error when result has error or isError", () => {
      const active: ToolCallState[] = [
        {
          toolCallId: "err-1",
          toolName: "query_db",
          args: {},
          result: { error: "Database timeout" },
          status: "complete",
        },
        {
          toolCallId: "err-2",
          toolName: "run_job",
          args: {},
          result: { isError: true },
          status: "complete",
        },
        {
          toolCallId: "err-3",
          toolName: "broken_task",
          args: {},
          result: undefined,
          status: "complete",
        },
      ];

      const steps = buildTraceSteps({ activeToolCalls: active });
      expect(steps[0].state).toBe("error");
      expect(steps[1].state).toBe("error");
      expect(steps[2].state).toBe("error");
    });

    it("extracts subagent delegation details from active tool call", () => {
      const active: ToolCallState[] = [
        {
          toolCallId: "sub-1",
          toolName: "delegate_task",
          args: {
            role: "researcher",
            taskBrief: "Find latest papers",
            inputData: "Topic: AI",
          },
          status: "calling",
        },
        {
          toolCallId: "sub-2",
          toolName: "delegate_task",
          args: JSON.stringify({
            task: "Inspect code",
            input: "File.ts",
          }),
          result: "Done",
          status: "complete",
        },
        {
          toolCallId: "sub-3",
          toolName: "delegate_task",
          args: "invalid-json-string",
          result: { error: "Failed" },
          status: "complete",
        },
      ];

      const steps = buildTraceSteps({ activeToolCalls: active });

      expect(steps[0]).toEqual({
        kind: "subagent",
        key: "active-sub-1",
        toolCallId: "sub-1",
        role: "researcher",
        taskBrief: "Find latest papers",
        inputData: "Topic: AI",
        result: undefined,
        state: "running",
      });

      expect(steps[1]).toEqual({
        kind: "subagent",
        key: "active-sub-2",
        toolCallId: "sub-2",
        role: "worker",
        taskBrief: "Inspect code",
        inputData: "File.ts",
        result: "Done",
        state: "done",
      });

      expect(steps[2]).toEqual({
        kind: "subagent",
        key: "active-sub-3",
        toolCallId: "sub-3",
        role: "worker",
        taskBrief: "Task execution",
        inputData: undefined,
        result: { error: "Failed" },
        state: "error",
      });
    });

    it("extracts agentId and agentName when delegate_task is called with agent parameter", () => {
      const active: ToolCallState[] = [
        {
          toolCallId: "sub-agent-1",
          toolName: "delegate_task",
          args: {
            agent: "builtin:researcher",
            taskBrief: "Research topic",
          },
          status: "calling",
        },
        {
          toolCallId: "sub-agent-2",
          toolName: "delegate_task",
          args: {
            agent: "11111111-1111-4111-8111-111111111111",
            agentName: "SQL Analyst",
            taskBrief: "Analyze query",
          },
          result: "Done",
          status: "complete",
        },
      ];

      const steps = buildTraceSteps({ activeToolCalls: active });

      expect(steps[0]).toMatchObject({
        kind: "subagent",
        role: "builtin:researcher",
        agentId: "builtin:researcher",
        agentName: "Researcher",
      });
      expect(steps[1]).toMatchObject({
        kind: "subagent",
        role: "11111111-1111-4111-8111-111111111111",
        agentId: "11111111-1111-4111-8111-111111111111",
        agentName: "SQL Analyst",
      });
    });
  });

  describe("persisted tool calls", () => {
    it("maps persisted tool calls and correlates matching tool results", () => {
      const steps = buildTraceSteps({
        toolCalls: [
          {
            toolCallId: "call-1",
            toolName: "fetch_api",
            args: { id: "123" },
          },
          {
            toolCallId: "call-sub",
            toolName: "delegate_task",
            args: { role: "planner", taskBrief: "Plan sprint" },
          },
          {
            toolCallId: "call-mcp",
            toolName: "read_res",
            serverName: "mcp-server",
            args: {},
          },
        ],
        toolResults: [
          {
            toolCallId: "call-1",
            toolName: "fetch_api",
            result: { data: "success" },
          },
          {
            toolCallId: "call-sub",
            toolName: "delegate_task",
            result: "Plan created",
          },
        ],
      });

      expect(steps).toEqual([
        {
          kind: "tool",
          key: "persisted-call-1",
          toolCallId: "call-1",
          toolName: "fetch_api",
          serverName: undefined,
          isMcp: false,
          args: { id: "123" },
          result: { data: "success" },
          state: "done",
        },
        {
          kind: "subagent",
          key: "persisted-call-sub",
          toolCallId: "call-sub",
          role: "planner",
          taskBrief: "Plan sprint",
          inputData: undefined,
          result: "Plan created",
          state: "done",
        },
        {
          kind: "tool",
          key: "persisted-call-mcp",
          toolCallId: "call-mcp",
          toolName: "read_res",
          serverName: "mcp-server",
          isMcp: true,
          args: {},
          result: undefined,
          state: "error",
        },
      ]);
    });

    it("propagates serverName from toolResults when absent on toolCall", () => {
      const steps = buildTraceSteps({
        toolCalls: [
          {
            toolCallId: "call-server-tr",
            toolName: "query_server",
            args: {},
          },
        ],
        toolResults: [
          {
            toolCallId: "call-server-tr",
            toolName: "query_server",
            serverName: "remote-mcp",
            result: { ok: true },
          },
        ],
      });

      expect(steps[0]).toEqual({
        kind: "tool",
        key: "persisted-call-server-tr",
        toolCallId: "call-server-tr",
        toolName: "query_server",
        serverName: "remote-mcp",
        isMcp: true,
        args: {},
        result: { ok: true },
        state: "done",
      });
    });

    it("handles non-object parsed JSON and undefined args", () => {
      const steps = buildTraceSteps({
        activeToolCalls: [
          {
            toolCallId: "num-json",
            toolName: "delegate_task",
            args: "123",
            status: "calling",
          },
          {
            toolCallId: "null-json",
            toolName: "delegate_task",
            args: "null",
            status: "calling",
          },
          {
            toolCallId: "primitive-number",
            toolName: "delegate_task",
            args: 42,
            status: "calling",
          },
        ],
      });

      expect(steps[0].kind).toBe("subagent");
      expect(steps[1].kind).toBe("subagent");
      expect(steps[2].kind).toBe("subagent");
    });

    it("handles persisted toolCalls when toolResults is completely undefined", () => {
      const steps = buildTraceSteps({
        toolCalls: [
          {
            toolCallId: "no-tr",
            toolName: "fetch_info",
            args: {},
          },
        ],
      });

      expect(steps).toEqual([
        {
          kind: "tool",
          key: "persisted-no-tr",
          toolCallId: "no-tr",
          toolName: "fetch_info",
          serverName: undefined,
          isMcp: false,
          args: {},
          result: undefined,
          state: "error",
        },
      ]);
    });
  });
});
