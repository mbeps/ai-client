import { describe, expect, it } from "vitest";
import { resolvePromptPayload } from "@/components/chat/input/resolve-prompt-payload";

describe("resolvePromptPayload", () => {
  it("returns prompt IDs when non-empty", () => {
    expect(resolvePromptPayload(["p1", "p2"])).toEqual(["p1", "p2"]);
  });

  it("returns undefined when array is empty", () => {
    expect(resolvePromptPayload([])).toBeUndefined();
  });
});

