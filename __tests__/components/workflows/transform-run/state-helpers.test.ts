import { describe, expect, it } from "vitest";
import {
  applyReviewRequiredToStep,
  applyStepCompleteToStep,
  applyStepStartEvent,
  applyToolCallToStep,
  applyToolResultToStep,
  buildInitialStepStates,
  checkHasAnyArtifact,
  mapRunRowToRun,
  resolveInitialSelectedStep,
  resolveStepPreviewArtifact,
  resolveTargetAttachmentId,
} from "@/components/workflows/transform-run/state-helpers";
import type { StepState } from "@/types/workflows/transform-run";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { TransformRunRow } from "@/types/transform/transform-run-row";

describe("state-helpers", () => {
  describe("mapRunRowToRun", () => {
    it("maps raw database row to typed domain object", () => {
      const now = new Date();
      const row: TransformRunRow = {
        id: "run-1",
        agentId: "agent-1",
        userId: "user-1",
        status: "running",
        currentStepIndex: 1,
        dryRun: false,
        inputAttachmentIds: ["in-1"],
        outputAttachmentIds: ["out-1"],
        errorMessage: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      const result = mapRunRowToRun(row);
      expect(result.id).toBe("run-1");
      expect(result.status).toBe("running");
      expect(result.currentStepIndex).toBe(1);
      expect(result.errorMessage).toBe("");
      expect(result.createdAt).toEqual(now);
      expect(result.updatedAt).toEqual(now);
    });
  });

  describe("buildInitialStepStates", () => {
    it("marks all steps completed when run status is completed", () => {
      const states = buildInitialStepStates(3, "completed", null, ["out-0", "out-1"]);
      expect(states[0]).toEqual({ status: "completed", outputAttachmentId: "out-0" });
      expect(states[1]).toEqual({ status: "completed", outputAttachmentId: "out-1" });
      expect(states[2]).toEqual({ status: "completed", outputAttachmentId: undefined });
    });

    it("marks past steps completed and current step awaiting_review when review required", () => {
      const states = buildInitialStepStates(3, "awaiting_review", 1, ["out-0", "out-1"]);
      expect(states[0]).toEqual({ status: "completed", outputAttachmentId: "out-0" });
      expect(states[1]).toEqual({ status: "awaiting_review", outputAttachmentId: "out-1" });
      expect(states[2]).toEqual({ status: "pending" });
    });

    it("marks steps pending when run is running from beginning", () => {
      const states = buildInitialStepStates(2, "running", 0, []);
      expect(states[0]).toEqual({ status: "pending" });
      expect(states[1]).toEqual({ status: "pending" });
    });

    it("avoids misattributing outputAttachmentId when preceding steps produce no file (name-based mapping)", () => {
      // Step 0 produces no attachment, Step 1 produces "out-1" named "step-2-output.xlsx"
      const states = buildInitialStepStates(2, "completed", null, ["out-1"], [
        { id: "out-1", name: "step-2-output.xlsx" },
      ]);
      expect(states[0]).toEqual({ status: "completed", outputAttachmentId: undefined });
      expect(states[1]).toEqual({ status: "completed", outputAttachmentId: "out-1" });
    });

    it("avoids misattributing outputAttachmentId when preceding steps produce no file (record-based mapping)", () => {
      const states = buildInitialStepStates(2, "completed", null, ["out-1"], {
        1: "out-1",
      });
      expect(states[0]).toEqual({ status: "completed", outputAttachmentId: undefined });
      expect(states[1]).toEqual({ status: "completed", outputAttachmentId: "out-1" });
    });

    it("maps outputAttachmentId accurately when stepIndex is explicitly specified", () => {
      const states = buildInitialStepStates(3, "completed", null, ["out-2"], [
        { id: "out-2", stepIndex: 2 },
      ]);
      expect(states[0]).toEqual({ status: "completed", outputAttachmentId: undefined });
      expect(states[1]).toEqual({ status: "completed", outputAttachmentId: undefined });
      expect(states[2]).toEqual({ status: "completed", outputAttachmentId: "out-2" });
    });
  });

  describe("resolveInitialSelectedStep", () => {
    it("returns null if no steps", () => {
      expect(resolveInitialSelectedStep(0, "completed", null)).toBeNull();
    });

    it("returns last step index when completed", () => {
      expect(resolveInitialSelectedStep(3, "completed", null)).toBe(2);
    });

    it("returns currentStepIndex if set and not completed", () => {
      expect(resolveInitialSelectedStep(3, "running", 1)).toBe(1);
    });

    it("returns 0 if steps exist but no currentStepIndex", () => {
      expect(resolveInitialSelectedStep(3, "pending", null)).toBe(0);
    });
  });

  describe("applyStepStartEvent", () => {
    it("marks prior steps completed and sets target step to running with empty tool calls", () => {
      const initial: Record<number, StepState> = {
        0: { status: "running" },
        1: { status: "pending" },
      };
      const updated = applyStepStartEvent(initial, 1);
      expect(updated[0].status).toBe("completed");
      expect(updated[1]).toEqual({
        status: "running",
        toolCalls: [],
        toolResults: [],
      });
    });
  });

  describe("applyToolCallToStep and applyToolResultToStep", () => {
    it("appends tool call to existing step", () => {
      const initial: Record<number, StepState> = {
        0: { status: "running", toolCalls: [] },
      };
      const updated = applyToolCallToStep(initial, 0, {
        toolCallId: "tc-1",
        toolName: "test_tool",
        args: { foo: "bar" },
      });
      expect(updated[0].toolCalls).toHaveLength(1);
      expect(updated[0].toolCalls?.[0].toolName).toBe("test_tool");
    });

    it("appends tool result to existing step", () => {
      const initial: Record<number, StepState> = {
        0: { status: "running", toolResults: [] },
      };
      const updated = applyToolResultToStep(initial, 0, {
        toolCallId: "tc-1",
        toolName: "test_tool",
        result: { ok: true },
      });
      expect(updated[0].toolResults).toHaveLength(1);
      expect(updated[0].toolResults?.[0].result).toEqual({ ok: true });
    });
  });

  describe("applyStepCompleteToStep and applyReviewRequiredToStep", () => {
    it("updates step completion details", () => {
      const initial: Record<number, StepState> = {
        0: { status: "running" },
      };
      const artifact: ArtifactData = {
        type: "markdown",
        title: "Test",
        content: "# Heading",
        messageId: "m1",
      };
      const updated = applyStepCompleteToStep(initial, 0, {
        summary: "Done summary",
        stepData: { "file.csv": [{ a: 1 }] },
        artifact,
        outputAttachmentId: "out-100",
      });
      expect(updated[0].status).toBe("completed");
      expect(updated[0].summary).toBe("Done summary");
      expect(updated[0].artifact).toBe(artifact);
      expect(updated[0].outputAttachmentId).toBe("out-100");
    });

    it("marks target step awaiting review", () => {
      const initial: Record<number, StepState> = {
        1: { status: "running" },
      };
      const updated = applyReviewRequiredToStep(initial, 1);
      expect(updated[1].status).toBe("awaiting_review");
    });
  });

  describe("resolveTargetAttachmentId", () => {
    it("returns null when no step is selected", () => {
      expect(resolveTargetAttachmentId(null, {})).toBeNull();
    });

    it("returns current step outputAttachmentId if present", () => {
      const states: Record<number, StepState> = {
        1: { status: "completed", outputAttachmentId: "out-curr" },
      };
      expect(resolveTargetAttachmentId(1, states)).toBe("out-curr");
    });

    it("walks backward to find previous step outputAttachmentId", () => {
      const states: Record<number, StepState> = {
        0: { status: "completed", outputAttachmentId: "out-prev" },
        1: { status: "running" },
      };
      expect(resolveTargetAttachmentId(1, states)).toBe("out-prev");
    });

    it("falls back to first inputAttachmentId when no output exists", () => {
      const states: Record<number, StepState> = {
        0: { status: "running" },
      };
      expect(resolveTargetAttachmentId(0, states, ["in-1", "in-2"])).toBe("in-1");
    });
  });

  describe("resolveStepPreviewArtifact", () => {
    it("returns direct artifact if step has one", () => {
      const artifact: ArtifactData = {
        type: "html",
        title: "HTML Preview",
        content: "<p>Hello</p>",
        messageId: "step-0",
      };
      const states: Record<number, StepState> = {
        0: { status: "completed", artifact },
      };
      expect(resolveStepPreviewArtifact(0, states)).toBe(artifact);
    });

    it("builds spreadsheet artifact from stepData when no direct artifact", () => {
      const states: Record<number, StepState> = {
        0: {
          status: "completed",
          stepData: { "data.xlsx": [{ id: 1, val: "test" }] },
        },
      };
      const result = resolveStepPreviewArtifact(0, states, "Step 1");
      expect(result).not.toBeNull();
      expect(result?.type).toBe("spreadsheet");
      expect(result?.title).toBe("Step 1 - data.xlsx");
      expect(result?.content).toBe(JSON.stringify([{ id: 1, val: "test" }]));
    });

    it("returns cached artifact for targetAttachmentId", () => {
      const cached: ArtifactData = {
        type: "markdown",
        title: "Cached",
        content: "Cached content",
        messageId: "step-1",
      };
      const states: Record<number, StepState> = {
        1: { status: "completed" },
      };
      const result = resolveStepPreviewArtifact(
        1,
        states,
        "Step 2",
        "att-1",
        { "att-1": cached },
      );
      expect(result).toBe(cached);
    });

    it("returns null if nothing matches", () => {
      expect(resolveStepPreviewArtifact(null, {})).toBeNull();
    });
  });

  describe("checkHasAnyArtifact", () => {
    it("returns true if artifactCache has keys", () => {
      expect(
        checkHasAnyArtifact(
          { a: { type: "markdown", title: "T", content: "C", messageId: "1" } },
          null,
          {},
        ),
      ).toBe(true);
    });

    it("returns true if targetAttachmentId is not null", () => {
      expect(checkHasAnyArtifact({}, "att-1", {})).toBe(true);
    });

    it("returns true if any step has artifact or stepData", () => {
      const states: Record<number, StepState> = {
        0: { status: "completed", stepData: { "test.csv": [] } },
      };
      expect(checkHasAnyArtifact({}, null, states)).toBe(true);
    });

    it("returns false when completely empty", () => {
      expect(checkHasAnyArtifact({}, null, {})).toBe(false);
    });
  });
});

