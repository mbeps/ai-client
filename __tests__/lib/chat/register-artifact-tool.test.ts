import { describe, expect, it, vi } from "vitest";
import { PROMPTS } from "@/config/prompts";
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

  it("handles stringified object containing sheets key", async () => {
    const tools = registerArtifactTool();
    const payload = { sheets: [{ name: "S1", data: [["A"]] }] };
    const result = await (tools.manage_artifact as any).execute({
      type: "spreadsheet",
      title: "Table With Object",
      sheets: JSON.stringify(payload),
    });

    expect(result.success).toBe(true);
    expect(JSON.parse(result.artifact.content)).toEqual(payload);
  });

  it("leaves content unchanged when stringified json object has no sheets key", async () => {
    const tools = registerArtifactTool();
    const result = await (tools.manage_artifact as any).execute({
      type: "spreadsheet",
      content: "fallback-content",
      sheets: JSON.stringify({ otherKey: 123 }),
    });

    expect(result.success).toBe(true);
    expect(result.artifact.content).toBe("fallback-content");
  });

  it("falls back to raw sheets string if JSON.parse fails", async () => {
    const tools = registerArtifactTool();
    const rawInvalid = "{not-json";
    const result = await (tools.manage_artifact as any).execute({
      type: "spreadsheet",
      sheets: rawInvalid,
    });

    expect(result.success).toBe(true);
    expect(result.artifact.content).toBe(rawInvalid);
    expect(result.artifact.title).toBe(PROMPTS.TOOLS.MANAGE_ARTIFACT.DEFAULT_TITLE);
  });

  it("falls back to text property when content is not provided", async () => {
    const tools = registerArtifactTool();
    const result = await (tools.manage_artifact as any).execute({
      type: "markdown",
      text: "# Text fallback",
    });

    expect(result.success).toBe(true);
    expect(result.artifact.content).toBe("# Text fallback");
  });

  it("falls back to empty string when neither content nor text is provided", async () => {
    const tools = registerArtifactTool();
    const result = await (tools.manage_artifact as any).execute({
      type: "markdown",
    });

    expect(result.success).toBe(true);
    expect(result.artifact.content).toBe("");
  });

  it("catches Error during execution and returns success: false", async () => {
    const tools = registerArtifactTool();
    const spy = vi.spyOn(crypto, "randomUUID").mockImplementationOnce(() => {
      throw new Error("UUID failure");
    });
    const result = await (tools.manage_artifact as any).execute({
      type: "markdown",
      content: "fail",
    });
    spy.mockRestore();

    expect(result).toEqual({
      success: false,
      message: "UUID failure",
    });
  });

  it("catches non-Error throwable during execution and returns success: false with Unknown error", async () => {
    const tools = registerArtifactTool();
    const spy = vi.spyOn(crypto, "randomUUID").mockImplementationOnce(() => {
      throw "String failure";
    });
    const result = await (tools.manage_artifact as any).execute({
      type: "markdown",
      content: "fail",
    });
    spy.mockRestore();

    expect(result).toEqual({
      success: false,
      message: "Unknown error occurred",
    });
  });

  describe("toModelOutput", () => {
    it("formats successful artifact creation with title and type", () => {
      const tools = registerArtifactTool();
      const outputFn = (tools.manage_artifact as any).toModelOutput;
      const result = outputFn({
        output: {
          success: true,
          artifact: { title: "Custom Diagram", type: "mermaid" },
        },
      });

      expect(result).toEqual({
        type: "text",
        value:
          'Artifact "Custom Diagram" (mermaid) created successfully and presented to the user on canvas.',
      });
    });

    it("falls back to default title and document type when omitted", () => {
      const tools = registerArtifactTool();
      const outputFn = (tools.manage_artifact as any).toModelOutput;
      const result = outputFn({
        output: {
          success: true,
          artifact: {},
        },
      });

      expect(result).toEqual({
        type: "text",
        value:
          'Artifact "Artifact" (document) created successfully and presented to the user on canvas.',
      });
    });

    it("formats error output when success is false", () => {
      const tools = registerArtifactTool();
      const outputFn = (tools.manage_artifact as any).toModelOutput;
      const result = outputFn({
        output: {
          success: false,
          message: "Invalid artifact schema",
        },
      });

      expect(result).toEqual({
        type: "text",
        value: "Failed to create artifact: Invalid artifact schema",
      });
    });

    it("falls back to Unknown error when error message is missing", () => {
      const tools = registerArtifactTool();
      const outputFn = (tools.manage_artifact as any).toModelOutput;
      const result = outputFn({
        output: {
          success: false,
        },
      });

      expect(result).toEqual({
        type: "text",
        value: "Failed to create artifact: Unknown error",
      });
    });

    it("falls back to success: true when success property is omitted", () => {
      const tools = registerArtifactTool();
      const outputFn = (tools.manage_artifact as any).toModelOutput;
      const result = outputFn({
        output: {
          artifact: { title: "Implicit Success" },
        },
      });

      expect(result).toEqual({
        type: "text",
        value:
          'Artifact "Implicit Success" (document) created successfully and presented to the user on canvas.',
      });
    });
  });
});
