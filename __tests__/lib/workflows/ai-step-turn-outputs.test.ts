import { describe, expect, it, vi } from "vitest";
import { RATE_LIMIT_ERROR_CODE } from "@/lib/error/rate-limit-error-code";
import { ToolsNotSupportedError } from "@/lib/error/tools-not-supported-error";
import { VisionNotSupportedError } from "@/lib/error/vision-not-supported-error";
import {
  classifyAiStepError,
  collectStepTurnOutputs,
} from "@/lib/workflows/ai-step-turn-outputs";
import { executeResumedToolDecisions } from "@/lib/workflows/workflow-tool-approval";

describe("ai-step-turn-outputs & resumed tool fallback", () => {
  it("collectStepTurnOutputs handles write_* tools, args path extraction, non-artifact payloads, and empty steps", async () => {
    const emit = vi.fn();
    const out = await collectStepTurnOutputs({
      steps: [
        {},
        {
          toolCalls: [
            { toolCallId: "t1", toolName: "write_cell", args: { file_path: "/tmp/args.xlsx" } },
            { toolCallId: "t2", toolName: "manage_artifact", input: {} },
          ],
          toolResults: [
            { toolCallId: "t1", toolName: "write_cell", output: "ok" },
            { toolCallId: "t2", toolName: "manage_artifact", result: { ok: true } },
          ],
        },
      ],
      resumedResults: [],
      toolSourceMap: { write_cell: "ExcelMCP", manage_artifact: "Internal" },
      nodeId: "n1",
      initialWorkbookFilePath: null,
      emit,
    });

    expect(out.stepHasSpreadsheetMutations).toBe(true);
    expect(out.activeWorkbookFilePath).toBe("/tmp/args.xlsx");
    expect(out.stepArtifact).toBeNull();
    expect(out.toolCalls).toHaveLength(2);
  });

  it("classifyAiStepError covers rate limit, generic Error, and non-Error values", () => {
    expect(classifyAiStepError(new ToolsNotSupportedError()).code).toBe(
      "TOOLS_NOT_SUPPORTED",
    );
    expect(classifyAiStepError(new VisionNotSupportedError()).code).toBe(
      "VISION_NOT_SUPPORTED",
    );
    expect(
      classifyAiStepError({ statusCode: 429, message: "Rate limit exceeded" }).code,
    ).toBe(RATE_LIMIT_ERROR_CODE);
    expect(classifyAiStepError(new Error("Custom error"))).toEqual({
      message: "Custom error",
      code: "ERROR",
    });
    expect(classifyAiStepError("non-error")).toEqual({
      message: "Step failed",
      code: "ERROR",
    });
  });

  it("executeResumedToolDecisions defaults undefined args to empty object", async () => {
    const exec = vi.fn().mockResolvedValue({ ok: true });
    const emit = vi.fn();
    await executeResumedToolDecisions({
      decisions: [
        {
          approval: {
            approvalId: "a1",
            toolCallId: "tc1",
            toolName: "ping",
            args: undefined,
            signature: "sig",
          },
          approved: true,
        },
      ],
      rawTools: { ping: { execute: exec } },
      toolSourceMap: {},
      nodeId: "n1",
      emit,
    });
    expect(exec).toHaveBeenCalledWith({}, { toolCallId: "tc1", messages: [] });
  });
});
