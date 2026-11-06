import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/lib/chat/build-system-prompt";
import type { ArtifactData } from "@/types/artifact/artifact-data";

describe("buildSystemPrompt — Active Canvas section", () => {
  it("omits Active Canvas section when canvasArtifacts is empty or not provided", () => {
    const prompt1 = buildSystemPrompt(null, null, null, false, {});
    expect(prompt1).not.toContain("## Active Canvas");

    const prompt2 = buildSystemPrompt(null, null, null, false, {
      canvasArtifacts: [],
    });
    expect(prompt2).not.toContain("## Active Canvas");
  });

  it("includes Active Canvas section with title, type, id, and content", () => {
    const artifacts: ArtifactData[] = [
      {
        id: "art-1",
        title: "Out of Office Notification",
        type: "markdown",
        content: "Dear Andy,\nI will be off for knee surgery.\nBest,\nMaruf",
      },
    ];

    const prompt = buildSystemPrompt(null, null, null, false, {
      canvasArtifacts: artifacts,
    });

    expect(prompt).toContain("## Active Canvas");
    expect(prompt).toContain('### "Out of Office Notification" [markdown] (id: "art-1")');
    expect(prompt).toContain("Dear Andy,\nI will be off for knee surgery.");
    expect(prompt).toContain("The content above reflects the latest state, including any direct edits made by the user on the canvas.");
    expect(prompt).toContain("call `manage_artifact` with the full updated content");
  });

  it("renders multiple active artifacts in the Active Canvas section", () => {
    const artifacts: ArtifactData[] = [
      {
        id: "art-1",
        title: "Doc 1",
        type: "markdown",
        content: "Content 1",
      },
      {
        id: "art-2",
        title: "Spreadsheet 1",
        type: "spreadsheet",
        content: '{"sheets":[]}',
      },
    ];

    const prompt = buildSystemPrompt(null, null, null, false, {
      canvasArtifacts: artifacts,
    });

    expect(prompt).toContain('### "Doc 1" [markdown]');
    expect(prompt).toContain('### "Spreadsheet 1" [spreadsheet]');
  });

  it("handles fallback artifact title, type, and missing id gracefully", () => {
    const artifacts: ArtifactData[] = [
      {
        id: "",
        title: "",
        type: "" as any,
        content: "Raw untitled content",
      },
    ];

    const prompt = buildSystemPrompt(null, null, null, false, {
      canvasArtifacts: artifacts,
    });

    expect(prompt).toContain('### "Untitled Artifact" [markdown]');
    expect(prompt).not.toContain('(id:');
    expect(prompt).toContain("Raw untitled content");
  });
});
