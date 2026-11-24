import { describe, expect, it } from "vitest";
import { ARTIFACT_TYPES, type ArtifactType } from "@/config/artifacts";
import {
  DEFAULT_ENABLED_TOOLS,
  INTERNAL_TOOL_CATALOGUE,
  INTERNAL_TOOL_IDS,
  PICKER_INTERNAL_TOOLS,
} from "@/config/tools";
import { extractArtifactFromToolResult } from "@/lib/chat/extract-artifact-from-tool-result";
import { manageArtifactSchema } from "@/schemas/chat/chat";
import type { ArtifactData } from "@/types/artifact/artifact-data";

describe("config/artifacts", () => {
  it("exports all supported artifact types including ui", () => {
    expect(ARTIFACT_TYPES).toEqual([
      "markdown",
      "spreadsheet",
      "html",
      "mermaid",
      "ui",
    ]);

    const uiType: ArtifactType = "ui";
    const data: ArtifactData = {
      id: "art-ui-1",
      type: uiType,
      title: "Dashboard",
      content: "{}",
    };
    expect(data.type).toBe("ui");
  });
});

describe("config/tools — interactive_ui & PICKER_INTERNAL_TOOLS", () => {
  it("registers INTERACTIVE_UI in INTERNAL_TOOL_IDS, DEFAULT_ENABLED_TOOLS, and INTERNAL_TOOL_CATALOGUE", () => {
    expect(INTERNAL_TOOL_IDS.INTERACTIVE_UI).toBe(
      "internal:tool:interactive_ui",
    );
    expect(DEFAULT_ENABLED_TOOLS).toContain(INTERNAL_TOOL_IDS.INTERACTIVE_UI);

    const entry = INTERNAL_TOOL_CATALOGUE.find(
      (tool) => tool.id === INTERNAL_TOOL_IDS.INTERACTIVE_UI,
    );
    expect(entry).toBeDefined();
    expect(entry?.name).toBe("interactive_ui");
  });

  it("exposes all 3 internal picker toggles in PICKER_INTERNAL_TOOLS", () => {
    expect(PICKER_INTERNAL_TOOLS).toHaveLength(3);
    expect(PICKER_INTERNAL_TOOLS.map((item) => item.id)).toEqual([
      INTERNAL_TOOL_IDS.MANAGE_ARTIFACT,
      INTERNAL_TOOL_IDS.MANAGE_MEMORY,
      INTERNAL_TOOL_IDS.INTERACTIVE_UI,
    ]);
    expect(PICKER_INTERNAL_TOOLS.map((item) => item.toolName)).toEqual([
      "manage_artifact",
      "manage_memory",
      "interactive_ui",
    ]);
    for (const item of PICKER_INTERNAL_TOOLS) {
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
      expect(item.keywords.length).toBeGreaterThan(0);
    }
  });
});

describe("ui artifact schema and extraction", () => {
  it("accepts type: 'ui' in manageArtifactSchema", () => {
    const result = manageArtifactSchema.safeParse({
      type: "ui",
      title: "Revenue Dashboard",
      content: JSON.stringify({ root: "card", elements: {} }),
    });
    expect(result.success).toBe(true);
  });

  it("extracts type: 'ui' in extractArtifactFromToolResult", () => {
    const extracted = extractArtifactFromToolResult({
      toolCallId: "tc-ui-1",
      toolName: "manage_artifact",
      result: {
        id: "art-ui-1",
        type: "ui",
        title: "Revenue Dashboard",
        content: '{"root":"card","elements":{}}',
      },
    });

    expect(extracted).toEqual({
      id: "art-ui-1",
      type: "ui",
      title: "Revenue Dashboard",
      content: '{"root":"card","elements":{}}',
    });
  });
});
