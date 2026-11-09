import { describe, expect, it } from "vitest";
import { buildMetadata } from "@/hooks/chat/stream/use-stream-prompt-content";

describe("buildMetadata", () => {
  it("includes reasoningEffort when provided", () => {
    const meta = buildMetadata({
      model: "o3-mini",
      selectedServerIds: ["srv-1"],
      selectedTools: ["tool-1"],
      reasoningEffort: "high",
    });

    expect(meta.model).toBe("o3-mini");
    expect(meta.selectedServerIds).toEqual(["srv-1"]);
    expect(meta.selectedTools).toEqual(["tool-1"]);
    expect(meta.reasoningEffort).toBe("high");
  });

  it("omits reasoningEffort when undefined", () => {
    const meta = buildMetadata({
      model: "gpt-4o",
      selectedServerIds: [],
      selectedTools: [],
    });

    expect(meta.reasoningEffort).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(meta, "reasoningEffort")).toBe(false);
  });

  it("includes assistantId, subagents, and knowledgebases when provided", () => {
    const meta = buildMetadata({
      model: "o3-mini",
      selectedServerIds: [],
      selectedTools: [],
      selectedAssistantId: "asst-1",
      selectedKbIds: ["kb-1"],
      selectedSkillIds: ["skill-1"],
      subagentsEnabled: true,
      subagentModelId: "worker-1",
      reasoningEffort: "low",
    });

    expect(meta.assistantId).toBe("asst-1");
    expect(meta.selectedKbIds).toEqual(["kb-1"]);
    expect(meta.selectedSkillIds).toEqual(["skill-1"]);
    expect(meta.subagentsEnabled).toBe(true);
    expect(meta.subagentModelId).toBe("worker-1");
    expect(meta.reasoningEffort).toBe("low");
  });
});
