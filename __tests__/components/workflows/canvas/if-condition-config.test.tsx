import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IfConditionConfig } from "@/components/workflows/canvas/config-sections/if-condition-config";

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (val: string) => void;
    children: React.ReactNode;
  }) => (
    <select
      data-testid="mock-select"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

vi.mock("@/components/shared/model-selector", () => ({
  ModelSelector: ({
    value,
    onValueChange,
  }: {
    value: string;
    onValueChange: (val: string) => void;
  }) => (
    <div data-testid="model-selector" data-value={value}>
      <button type="button" onClick={() => onValueChange("gpt-4o")}>
        Select Model
      </button>
      <button type="button" onClick={() => onValueChange("")}>
        Clear Model
      </button>
    </div>
  ),
}));

vi.mock("@/components/chat/input/reasoning-effort-selector", () => ({
  ModelReasoningEffortCard: ({
    onChange,
  }: {
    onChange: (val: string) => void;
  }) => (
    <button
      type="button"
      data-testid="reasoning-effort"
      onClick={() => onChange("high")}
    >
      Set Reasoning
    </button>
  ),
}));

describe("IfConditionConfig", () => {
  it("handles rules add, update, remove, is_empty operator, and empty rules state", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <IfConditionConfig
        data={{
          kind: "if_condition",
          variableName: "if1",
          evaluationMode: "deterministic",
          logic: "and",
          rules: [],
        }}
        onChange={onChange}
      />,
    );

    expect(screen.getByText(/No rules added yet/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Add Rule/i }));
    expect(onChange).toHaveBeenCalledTimes(1);

    rerender(
      <IfConditionConfig
        data={{
          kind: "if_condition",
          variableName: "if1",
          evaluationMode: "deterministic",
          logic: "and",
          rules: [
            {
              id: "r1",
              leftTemplate: "{{a}}",
              operator: "equals",
              rightValue: "1",
            },
            {
              id: "r2",
              leftTemplate: "{{b}}",
              operator: "is_empty",
            },
          ],
        }}
        onChange={onChange}
      />,
    );

    const leftInputs = screen.getAllByPlaceholderText("{{step1.summary}}");
    fireEvent.change(leftInputs[0], { target: { value: "{{x}}" } });
    expect(onChange).toHaveBeenCalledWith({
      rules: [
        { id: "r1", leftTemplate: "{{x}}", operator: "equals", rightValue: "1" },
        { id: "r2", leftTemplate: "{{b}}", operator: "is_empty" },
      ],
    });

    const rightInput = screen.getByPlaceholderText("Expected value");
    fireEvent.change(rightInput, { target: { value: "2" } });
    expect(onChange).toHaveBeenCalledWith({
      rules: [
        { id: "r1", leftTemplate: "{{a}}", operator: "equals", rightValue: "2" },
        { id: "r2", leftTemplate: "{{b}}", operator: "is_empty" },
      ],
    });

    // Remove r1
    const buttons = screen.getAllByRole("button");
    // buttons[0] = Add Rule, buttons[1] = remove r1
    fireEvent.click(buttons[1]);
    expect(onChange).toHaveBeenCalledWith({
      rules: [{ id: "r2", leftTemplate: "{{b}}", operator: "is_empty" }],
    });

    const selects = screen.getAllByTestId("mock-select");
    fireEvent.change(selects[0], { target: { value: "hybrid" } });
    expect(onChange).toHaveBeenCalledWith({ evaluationMode: "hybrid" });

    fireEvent.change(selects[1], { target: { value: "or" } });
    expect(onChange).toHaveBeenCalledWith({ logic: "or" });

    fireEvent.change(selects[2], { target: { value: "contains" } });
    expect(onChange).toHaveBeenCalledWith({
      rules: [
        { id: "r1", leftTemplate: "{{a}}", operator: "contains", rightValue: "1" },
        { id: "r2", leftTemplate: "{{b}}", operator: "is_empty" },
      ],
    });
  });

  it("handles undefined rightValue and undefined llmConditionPrompt", () => {
    render(
      <IfConditionConfig
        data={{
          kind: "if_condition",
          variableName: "if3",
          evaluationMode: "hybrid",
          logic: "and",
          rules: [{ id: "r1", leftTemplate: "{{a}}", operator: "equals" }],
        }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText("Expected value")).toHaveValue("");
    expect(screen.getByLabelText(/LLM Condition Prompt/i)).toHaveValue("");
  });

  it("handles llm/hybrid mode prompt, modelId select/clear, and reasoning effort", () => {
    const onChange = vi.fn();
    render(
      <IfConditionConfig
        data={{
          kind: "if_condition",
          variableName: "if2",
          evaluationMode: "llm",
          logic: "or",
          rules: [],
          llmConditionPrompt: "",
        }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText(/LLM Condition Prompt/i), {
      target: { value: "Is it urgent?" },
    });
    expect(onChange).toHaveBeenCalledWith({
      llmConditionPrompt: "Is it urgent?",
    });

    fireEvent.click(screen.getByText("Select Model"));
    expect(onChange).toHaveBeenCalledWith({ modelId: "gpt-4o" });

    fireEvent.click(screen.getByText("Clear Model"));
    expect(onChange).toHaveBeenCalledWith({
      modelId: undefined,
      reasoningEffort: undefined,
    });

    fireEvent.click(screen.getByTestId("reasoning-effort"));
    expect(onChange).toHaveBeenCalledWith({ reasoningEffort: "high" });
  });
});
