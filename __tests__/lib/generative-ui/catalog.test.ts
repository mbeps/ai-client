import { describe, expect, it } from "vitest";
import {
  generativeUICatalog,
  getInteractiveUiSystemPrompt,
} from "@/lib/generative-ui/catalog";

describe("generativeUICatalog", () => {
  it("registers all 24 UI components and sendChatMessage action", () => {
    const expectedComponents = [
      "Stack",
      "Grid",
      "Card",
      "Separator",
      "Text",
      "Metric",
      "Badge",
      "Alert",
      "Progress",
      "DataTable",
      "Tabs",
      "Accordion",
      "Button",
      "Input",
      "Textarea",
      "Select",
      "Switch",
      "Checkbox",
      "Slider",
      "AreaChart",
      "BarChart",
      "LineChart",
      "PieChart",
      "RadarChart",
    ];

    expect(generativeUICatalog.componentNames).toHaveLength(24);
    for (const name of expectedComponents) {
      expect(generativeUICatalog.componentNames).toContain(name);
    }
    expect(generativeUICatalog.actionNames).toContain("sendChatMessage");
  });

  it("returns a memoized, non-empty system prompt mentioning spec fences and core components", () => {
    const first = getInteractiveUiSystemPrompt();
    const second = getInteractiveUiSystemPrompt();

    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(200);
    expect(first).toContain("```spec");
    expect(first).toContain("manage_artifact");
    expect(first).toContain("Card");
    expect(first).toContain("AreaChart");
    expect(first).toContain("sendChatMessage");
    expect(first).toContain("/elements/");
    expect(first).toContain('"$then"');
    expect(first).toContain('"$else"');
    expect(first).toContain("Element objects ONLY have top-level keys");
  });
});
