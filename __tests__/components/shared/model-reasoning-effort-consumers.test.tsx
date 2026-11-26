import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentSettingsTab } from "@/components/agent/agent-settings-tab";
import { AiStepConfig } from "@/components/workflows/canvas/config-sections/ai-step-config";
import { IfConditionConfig } from "@/components/workflows/canvas/config-sections/if-condition-config";
import { WorkflowConfigTab } from "@/components/workflows/editor/workflow-config-tab";

vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: vi.fn(() => ({
    models: [
      {
        id: "m-1",
        modelId: "gpt-4o",
        label: "GPT-4o",
        providerName: "OpenAI",
        reasoningEffortFormat: "none",
      },
      {
        id: "m-2",
        modelId: "o3-mini",
        label: "o3-mini",
        providerName: "OpenAI",
        reasoningEffortFormat: "openai",
      },
    ],
    isLoading: false,
  })),
}));

vi.mock("@/components/shared/markdown-tab-editor", () => ({
  MarkdownTabEditor: ({ value }: { value: string }) => (
    <div data-testid="markdown-tab-editor">{value}</div>
  ),
}));

describe("Model picker reasoning effort integration", () => {
  it("renders reasoning effort slider in AgentSettingsTab for reasoning models and clears effort when clearing model", () => {
    const onModelIdChange = vi.fn();
    const onReasoningEffortChange = vi.fn();
    render(
      <AgentSettingsTab
        name="Researcher"
        onNameChange={vi.fn()}
        description="Researches topics"
        onDescriptionChange={vi.fn()}
        modelId="o3-mini"
        onModelIdChange={onModelIdChange}
        reasoningEffort="medium"
        onReasoningEffortChange={onReasoningEffortChange}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText("Reasoning Effort")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^High$/i }));
    expect(onReasoningEffortChange).toHaveBeenCalledWith("high");

    fireEvent.click(screen.getByRole("button", { name: "Clear default model" }));
    expect(onModelIdChange).toHaveBeenCalledWith(null);
    expect(onReasoningEffortChange).toHaveBeenCalledWith(null);
  });

  it("renders reasoning effort slider in WorkflowConfigTab for reasoning models", () => {
    const onReasoningEffortChange = vi.fn();
    render(
      <WorkflowConfigTab
        name="Invoice Flow"
        onNameChange={vi.fn()}
        description=""
        onDescriptionChange={vi.fn()}
        modelId="o3-mini"
        onModelIdChange={vi.fn()}
        reasoningEffort="low"
        onReasoningEffortChange={onReasoningEffortChange}
        requiresFileUpload={false}
        onRequiresFileUploadChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Reasoning Effort")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Medium$/i }));
    expect(onReasoningEffortChange).toHaveBeenCalledWith("medium");
  });

  it("renders reasoning effort slider in AiStepConfig when override model supports reasoning", () => {
    const onChange = vi.fn();
    render(
      <AiStepConfig
        data={{
          kind: "ai_step",
          variableName: "step1",
          prompt: "Summarize",
          modelId: "o3-mini",
          reasoningEffort: "medium",
          mcpServerIds: [],
          toolIds: [],
          requiresReview: false,
        }}
        onChange={onChange}
        activeSection="general"
        mcpServers={[]}
        knowledgebases={[]}
        skills={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^More$/i }));
    expect(screen.getByText("Reasoning Effort")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Off$/i }));
    expect(onChange).toHaveBeenCalledWith({ reasoningEffort: "off" });
  });

  it("renders reasoning effort slider in IfConditionConfig when judge model supports reasoning", () => {
    const onChange = vi.fn();
    render(
      <IfConditionConfig
        data={{
          kind: "if_condition",
          variableName: "cond1",
          evaluationMode: "llm",
          logic: "and",
          rules: [],
          llmConditionPrompt: "Is valid?",
          modelId: "o3-mini",
          reasoningEffort: "medium",
        }}
        onChange={onChange}
      />,
    );

    expect(screen.getByText("Reasoning Effort")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^High$/i }));
    expect(onChange).toHaveBeenCalledWith({ reasoningEffort: "high" });
  });
});
