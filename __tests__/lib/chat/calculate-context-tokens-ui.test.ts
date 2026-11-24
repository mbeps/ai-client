import { describe, expect, it } from "vitest";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
import { calculateContextUsage } from "@/lib/chat/calculate-context-tokens";
import { estimateTokens } from "@/lib/chat/estimate-tokens";
import { getInteractiveUiSystemPrompt } from "@/lib/generative-ui/catalog";

describe("calculateContextUsage - interactive UI", () => {
  it("adds catalog prompt tokens to systemInstructions and excludes interactive_ui from toolDefinitions", () => {
    const baseline = calculateContextUsage({
      systemPrompt: "You are helpful.",
      toolNames: ["manage_artifact"],
    });

    const withFullId = calculateContextUsage({
      systemPrompt: "You are helpful.",
      toolNames: ["manage_artifact", INTERNAL_TOOL_IDS.INTERACTIVE_UI],
    });

    const withShortName = calculateContextUsage({
      systemPrompt: "You are helpful.",
      toolNames: ["manage_artifact", "interactive_ui"],
    });

    const expectedUiPromptTokens = estimateTokens(
      getInteractiveUiSystemPrompt(),
    );

    expect(withFullId.breakdown.toolDefinitions).toBe(
      baseline.breakdown.toolDefinitions,
    );
    expect(withFullId.breakdown.systemInstructions).toBe(
      baseline.breakdown.systemInstructions + expectedUiPromptTokens,
    );

    expect(withShortName.breakdown.toolDefinitions).toBe(
      baseline.breakdown.toolDefinitions,
    );
    expect(withShortName.breakdown.systemInstructions).toBe(
      baseline.breakdown.systemInstructions + expectedUiPromptTokens,
    );
  });
});
