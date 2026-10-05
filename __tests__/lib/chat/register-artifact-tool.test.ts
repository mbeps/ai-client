import { describe, expect, it } from "vitest";
import { registerArtifactTool } from "@/lib/chat/register-artifact-tool";

describe("registerArtifactTool", () => {
  it("registers manage_artifact tool with schema and description", () => {
    const tools = registerArtifactTool();
    expect(tools.manage_artifact).toBeDefined();
    expect(tools.manage_artifact.description).toBeDefined();
    expect(tools.manage_artifact.inputSchema).toBeDefined();
  });

  it("creates markdown artifact with generated UUID and success: true", async () => {
    const tools = registerArtifactTool();
    const result = await (tools.manage_artifact as any).execute({
      type: "markdown",
      title: "My Doc",
      content: "# Hello World",
    });

    expect(result.success).toBe(true);
    expect(result.artifact).toMatchObject({
      type: "markdown",
      title: "My Doc",
      content: "# Hello World",
    });
    expect(result.artifact.id).toEqual(expect.any(String));
  });

  it("serializes sheets array for spreadsheet artifacts", async () => {
    const tools = registerArtifactTool();
    const sheets = [
      {
        name: "Sheet1",
        data: [
          ["A", "B"],
          [1, 2],
        ],
      },
    ];
    const result = await (tools.manage_artifact as any).execute({
      type: "spreadsheet",
      title: "Financials",
      sheets,
    });

    expect(result.success).toBe(true);
    expect(JSON.parse(result.artifact.content)).toEqual({ sheets });
  });

  it("handles stringified sheets for spreadsheet artifacts", async () => {
    const tools = registerArtifactTool();
    const sheets = [
      {
        name: "Sheet1",
        data: [["Header"], ["Value"]],
      },
    ];
    const result = await (tools.manage_artifact as any).execute({
      type: "spreadsheet",
      title: "Table",
      sheets: JSON.stringify(sheets),
    });

    expect(result.success).toBe(true);
    expect(JSON.parse(result.artifact.content)).toEqual({ sheets });
  });
});
