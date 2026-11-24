import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/lib/chat/build-system-prompt";
import { getInteractiveUiSystemPrompt } from "@/lib/generative-ui/catalog";

describe("buildSystemPrompt - interactive UI", () => {
  it("injects the interactive UI catalog prompt when isInteractiveUiEnabled is true", () => {
    const prompt = buildSystemPrompt(null, null, null, false, {
      supportsTools: true,
      isInteractiveUiEnabled: true,
    });

    expect(prompt).toContain(getInteractiveUiSystemPrompt());
  });

  it("injects the interactive UI catalog prompt even when supportsTools is false", () => {
    const prompt = buildSystemPrompt(null, null, null, false, {
      supportsTools: false,
      isInteractiveUiEnabled: true,
    });

    expect(prompt).toContain(getInteractiveUiSystemPrompt());
  });

  it("does not inject the interactive UI catalog prompt when isInteractiveUiEnabled is false or omitted", () => {
    const disabledPrompt = buildSystemPrompt(null, null, null, false, {
      supportsTools: true,
      isInteractiveUiEnabled: false,
    });
    const omittedPrompt = buildSystemPrompt(null, null, null, false, {
      supportsTools: true,
    });

    const uiPrompt = getInteractiveUiSystemPrompt();
    expect(disabledPrompt).not.toContain(uiPrompt);
    expect(omittedPrompt).not.toContain(uiPrompt);
  });
});
