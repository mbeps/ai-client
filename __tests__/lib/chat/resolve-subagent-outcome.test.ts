import { describe, expect, it } from "vitest";
import { resolveSubagentOutcome } from "@/lib/chat/resolve-subagent-outcome";

describe("resolveSubagentOutcome", () => {
  it("resolves running state to 'Delegating...'", () => {
    expect(resolveSubagentOutcome("running", "")).toEqual({
      label: "Delegating...",
      isError: false,
    });
    expect(resolveSubagentOutcome("running", "STATUS: BLOCKED")).toEqual({
      label: "Delegating...",
      isError: false,
    });
  });

  it("resolves error state or STATUS: BLOCKED to 'Blocked'", () => {
    expect(resolveSubagentOutcome("error", "Failed to connect")).toEqual({
      label: "Blocked",
      isError: true,
    });
    expect(resolveSubagentOutcome("done", "Step finished.\nSTATUS: BLOCKED")).toEqual({
      label: "Blocked",
      isError: true,
    });
  });

  it("resolves STATUS: DONE_WITH_CONCERNS to 'Concerns'", () => {
    expect(resolveSubagentOutcome("done", "STATUS: DONE_WITH_CONCERNS - Missing data")).toEqual({
      label: "Concerns",
      isError: false,
    });
  });

  it("resolves STATUS: NEEDS_CONTEXT to 'Needs Context'", () => {
    expect(resolveSubagentOutcome("done", "STATUS: NEEDS_CONTEXT - Which file?")).toEqual({
      label: "Needs Context",
      isError: false,
    });
  });

  it("resolves standard completed outcome when no special markers are present", () => {
    expect(resolveSubagentOutcome("done", "Everything completed successfully.")).toEqual({
      label: "Completed",
      isError: false,
    });
  });
});

