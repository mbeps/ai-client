import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentGuardrailsTab } from "@/components/agent/agent-guardrails-tab";
import { DEFAULT_AGENT_GUARDRAILS } from "@/drizzle/schemas/agent-schema";

describe("AgentGuardrailsTab", () => {
  it("clamps maxSteps between 1 and 30 and ignores NaN", () => {
    const onChange = vi.fn();
    render(
      <AgentGuardrailsTab
        guardrails={DEFAULT_AGENT_GUARDRAILS}
        onGuardrailsChange={onChange}
        onSave={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(/max steps/i);
    fireEvent.change(input, { target: { value: "50" } });
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_AGENT_GUARDRAILS,
      maxSteps: 30,
    });

    fireEvent.change(input, { target: { value: "0" } });
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_AGENT_GUARDRAILS,
      maxSteps: 1,
    });

    onChange.mockClear();
    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("toggles isolateTools and invokes onSave", () => {
    const onChange = vi.fn();
    const onSave = vi.fn();
    render(
      <AgentGuardrailsTab
        guardrails={DEFAULT_AGENT_GUARDRAILS}
        onGuardrailsChange={onChange}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_AGENT_GUARDRAILS,
      isolateTools: false,
    });

    fireEvent.click(screen.getByRole("button", { name: /save guardrails/i }));
    expect(onSave).toHaveBeenCalledOnce();
  });
});
