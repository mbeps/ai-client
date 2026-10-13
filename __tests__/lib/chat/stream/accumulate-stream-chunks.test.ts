import { describe, expect, it } from "vitest";
import {
  accumulateReasoningDelta,
  accumulateTextDelta,
} from "@/lib/chat/stream/accumulate-stream-chunks";

describe("accumulate-stream-chunks", () => {
  it("accumulates text deltas", () => {
    expect(accumulateTextDelta("", "Hello")).toBe("Hello");
    expect(accumulateTextDelta("Hello", " world")).toBe("Hello world");
  });

  it("accumulates reasoning deltas", () => {
    expect(accumulateReasoningDelta("", "Thinking")).toBe("Thinking");
    expect(accumulateReasoningDelta("Thinking", " step 1")).toBe("Thinking step 1");
  });
});

