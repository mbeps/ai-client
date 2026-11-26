import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AiStepOutputSection } from "@/components/workflows/canvas/config-sections/ai-step-output-section";
import type { AiStepNodeData } from "@/types/workflows/workflow";

function makeData(overrides: Partial<AiStepNodeData> = {}): AiStepNodeData {
  return {
    kind: "ai_step",
    variableName: "step1",
    prompt: "Do something",
    mcpServerIds: [],
    toolIds: [],
    requiresReview: false,
    ...overrides,
  };
}

describe("AiStepOutputSection", () => {
  it("resets canvasMode from disabled to inherit when selecting Canvas output", () => {
    const onChange = vi.fn();
    render(
      <AiStepOutputSection
        data={makeData({ outputMode: "text", canvasMode: "disabled" })}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Canvas (Artifact)" }));

    expect(onChange).toHaveBeenCalledWith({
      outputMode: "canvas",
      canvasMode: "inherit",
    });
  });

  it("preserves explicit canvasMode when selecting Canvas output", () => {
    const onChange = vi.fn();
    render(
      <AiStepOutputSection
        data={makeData({ outputMode: "structured", canvasMode: "markdown" })}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Canvas (Artifact)" }));

    expect(onChange).toHaveBeenCalledWith({
      outputMode: "canvas",
    });
  });

  it("sets canvasMode to disabled when selecting Plain text output", () => {
    const onChange = vi.fn();
    render(
      <AiStepOutputSection
        data={makeData({ outputMode: "canvas", canvasMode: "markdown" })}
        onChange={onChange}
      />,
    );

    const triggers = screen.getAllByRole("combobox");
    fireEvent.click(triggers[0]);
    fireEvent.click(screen.getByRole("option", { name: "Plain text" }));

    expect(onChange).toHaveBeenCalledWith({
      outputMode: "text",
      canvasMode: "disabled",
    });
  });

  it("initializes structuredOutputSchema when selecting Structured JSON without existing schema", () => {
    const onChange = vi.fn();
    render(
      <AiStepOutputSection
        data={makeData({ outputMode: "text", canvasMode: "disabled" })}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Structured JSON" }));

    expect(onChange).toHaveBeenCalledWith({
      outputMode: "structured",
      structuredOutputSchema: { fields: [] },
    });
  });

  it("updates canvasMode via Canvas Format select and toggles Human Review Gate", () => {
    const onChange = vi.fn();
    render(
      <AiStepOutputSection
        data={makeData({ outputMode: "canvas", canvasMode: undefined })}
        onChange={onChange}
      />,
    );

    const triggers = screen.getAllByRole("combobox");
    fireEvent.click(triggers[1]);
    fireEvent.click(screen.getByRole("option", { name: "HTML" }));

    expect(onChange).toHaveBeenCalledWith({ canvasMode: "html" });

    fireEvent.click(screen.getByRole("switch", { name: "Human Review Gate" }));
    expect(onChange).toHaveBeenCalledWith({ requiresReview: true });
  });
});
