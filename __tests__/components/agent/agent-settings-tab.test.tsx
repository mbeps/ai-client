import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentSettingsTab } from "@/components/agent/agent-settings-tab";

vi.mock("@/components/shared/model-selector", () => ({
  ModelSelector: ({
    value,
    onValueChange,
    disabled,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    disabled?: boolean;
  }) => (
    <select
      aria-label="Default Model"
      value={value}
      disabled={disabled}
      onChange={(e) => onValueChange(e.target.value)}
    >
      <option value="">None</option>
      <option value="gpt-4o">gpt-4o</option>
    </select>
  ),
}));

vi.mock("@/components/chat/input/reasoning-effort-selector", () => ({
  ModelReasoningEffortCard: ({
    value,
    onChange,
  }: {
    value: string | null;
    onChange: (v: any) => void;
  }) => (
    <button type="button" onClick={() => onChange("high")}>
      Reasoning: {value ?? "none"}
    </button>
  ),
}));

describe("AgentSettingsTab", () => {
  it("updates name, description, modelId, and clears modelId", () => {
    const onNameChange = vi.fn();
    const onDescriptionChange = vi.fn();
    const onModelIdChange = vi.fn();
    const onReasoningEffortChange = vi.fn();
    const onSave = vi.fn();

    render(
      <AgentSettingsTab
        name="My Agent"
        onNameChange={onNameChange}
        description="Desc"
        onDescriptionChange={onDescriptionChange}
        modelId="gpt-4o"
        onModelIdChange={onModelIdChange}
        reasoningEffort={null}
        onReasoningEffortChange={onReasoningEffortChange}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Agent name"), {
      target: { value: "New Name" },
    });
    expect(onNameChange).toHaveBeenCalledWith("New Name");

    fireEvent.change(
      screen.getByPlaceholderText(/Describe this agent/i),
      { target: { value: "New Desc" } },
    );
    expect(onDescriptionChange).toHaveBeenCalledWith("New Desc");

    fireEvent.change(screen.getByLabelText("Default Model"), {
      target: { value: "" },
    });
    expect(onModelIdChange).toHaveBeenCalledWith(null);

    fireEvent.click(screen.getByRole("button", { name: "Clear default model" }));
    expect(onModelIdChange).toHaveBeenCalledWith(null);
    expect(onReasoningEffortChange).toHaveBeenCalledWith(null);

    fireEvent.click(screen.getByRole("button", { name: /save details/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("hides save button and clear button when disabled", () => {
    render(
      <AgentSettingsTab
        name="My Agent"
        onNameChange={vi.fn()}
        description="Desc"
        onDescriptionChange={vi.fn()}
        modelId="gpt-4o"
        onModelIdChange={vi.fn()}
        onSave={vi.fn()}
        disabled
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Clear default model" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /save details/i }),
    ).not.toBeInTheDocument();
  });

  it("renders saving spinner when isSaving is true and handles null modelId", () => {
    render(
      <AgentSettingsTab
        name="Agent"
        onNameChange={vi.fn()}
        description=""
        onDescriptionChange={vi.fn()}
        modelId={null}
        onModelIdChange={vi.fn()}
        onSave={vi.fn()}
        isSaving={true}
      />,
    );

    const saveBtn = screen.getByRole("button", { name: /save/i });
    expect(saveBtn).toBeDisabled();
    expect(saveBtn.querySelector(".animate-spin")).toBeInTheDocument();
  });
});
