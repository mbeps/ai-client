import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubagentConfigDialog } from "@/components/chat/subagent-config-dialog";
import { DEFAULT_AGENT_GUARDRAILS } from "@/drizzle/schemas/agent-schema";
import type { Agent } from "@/types/agent/agent";

const mockUseAppStore = vi.hoisted(() => vi.fn());

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: (state: { agents: Agent[] }) => unknown) =>
    mockUseAppStore(selector),
}));

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

const makeLeafAgent = (id: string, name: string): Agent => ({
  id,
  userId: "user-1",
  name,
  description: "Does leaf work",
  prompt: "",
  subagentPrompt: "",
  modelId: null,
  tools: [],
  skillMode: "dynamic",
  skillIds: [],
  promptMode: "all",
  promptIds: [],
  knowledgebaseIds: [],
  subagentIds: [],
  guardrails: DEFAULT_AGENT_GUARDRAILS,
  avatar: null,
  isBuiltIn: false,
  isOrchestrator: false,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("SubagentConfigDialog", () => {
  beforeEach(() => {
    mockUseAppStore.mockImplementation(
      (selector: (state: { agents: Agent[] }) => unknown) =>
        selector({ agents: [] }),
    );
  });

  it("renders title and toggle without tabs or removed descriptions", () => {
    const handleToggle = vi.fn();
    render(
      <SubagentConfigDialog
        open={true}
        onOpenChange={vi.fn()}
        subagentsEnabled={false}
        onToggleSubagents={handleToggle}
        onSubagentModelChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Subagents")).toBeDefined();
    expect(
      screen.queryByText(/Delegate complex tasks to isolated worker subagents/),
    ).toBeNull();
    expect(
      screen.queryByText(/Select a dedicated model for worker subagents/),
    ).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();

    const switchEl = screen.getByLabelText("Toggle subagents");
    fireEvent.click(switchEl);
    expect(handleToggle).toHaveBeenCalledWith(true);
  });

  it("renders worker model, sandboxing details, and Manage Agents link when opened", () => {
    const handleOpenChange = vi.fn();
    render(
      <SubagentConfigDialog
        open={true}
        onOpenChange={handleOpenChange}
        subagentsEnabled={true}
        onToggleSubagents={vi.fn()}
        onSubagentModelChange={vi.fn()}
      />,
    );

    expect(screen.queryByText("Active")).toBeNull();
    expect(screen.getByText("Worker Subagent Model")).toBeDefined();
    expect(screen.queryByText(/Tool Inheritance & Sandboxing/)).toBeNull();

    const manageLink = screen.getByRole("link", { name: /Manage Agents/i });
    expect(manageLink).toHaveAttribute("href", "/agents");
    fireEvent.click(manageLink);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it("falls back to BUILT_IN_AGENTS when store agents is empty", () => {
    render(
      <SubagentConfigDialog
        open={true}
        onOpenChange={vi.fn()}
        subagentsEnabled={true}
        onToggleSubagents={vi.fn()}
        onSubagentModelChange={vi.fn()}
        selectedSubagentIds={["builtin:researcher"]}
        onToggleSubagentId={vi.fn()}
      />,
    );

    expect(screen.getByText("Built-in Agents")).toBeInTheDocument();
    expect(screen.queryByText("Researcher")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Built-in Agents"));
    expect(screen.getByText("Researcher")).toBeInTheDocument();
    expect(screen.getByText("Planner")).toBeInTheDocument();
    expect(screen.getByText("Reviewer")).toBeInTheDocument();
    expect(screen.getByText("Worker")).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when Done button is clicked", () => {
    const handleOpenChange = vi.fn();
    render(
      <SubagentConfigDialog
        open={true}
        onOpenChange={handleOpenChange}
        subagentsEnabled={true}
        onToggleSubagents={vi.fn()}
        onSubagentModelChange={vi.fn()}
      />,
    );

    const doneButton = screen.getByRole("button", { name: /Done/i });
    fireEvent.click(doneButton);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onOpenChange(false) when Cancel button is clicked", () => {
    const handleOpenChange = vi.fn();
    render(
      <SubagentConfigDialog
        open={true}
        onOpenChange={handleOpenChange}
        subagentsEnabled={true}
        onToggleSubagents={vi.fn()}
        onSubagentModelChange={vi.fn()}
      />,
    );

    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelButton);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders SubagentPicker and forwards toggle, bulk-select, and excludeAgentId", () => {
    const onToggleSubagentId = vi.fn();
    const onSelectSubagentIds = vi.fn();
    render(
      <SubagentConfigDialog
        open={true}
        onOpenChange={vi.fn()}
        subagentsEnabled={true}
        onToggleSubagents={vi.fn()}
        onSubagentModelChange={vi.fn()}
        agents={[
          makeLeafAgent("leaf-1", "Custom Leaf"),
          makeLeafAgent("self-1", "Excluded Self"),
        ]}
        selectedSubagentIds={["leaf-1"]}
        onToggleSubagentId={onToggleSubagentId}
        onSelectSubagentIds={onSelectSubagentIds}
        excludeAgentId="self-1"
      />,
    );

    expect(screen.queryByText("Custom Leaf")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Custom Agents"));
    expect(screen.getByText("Custom Leaf")).toBeInTheDocument();
    expect(screen.queryByText("Excluded Self")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Custom Leaf"));
    expect(onToggleSubagentId).toHaveBeenCalledWith("leaf-1");

    fireEvent.click(screen.getByRole("button", { name: /Deselect All/i }));
    expect(onSelectSubagentIds).toHaveBeenCalledWith([]);
  });

  it("shows reasoning effort slider only for supported models and notifies on change", () => {
    const onEffortChange = vi.fn();
    const { rerender } = render(
      <SubagentConfigDialog
        open={true}
        onOpenChange={vi.fn()}
        subagentsEnabled={true}
        onToggleSubagents={vi.fn()}
        subagentModelId="gpt-4o"
        onSubagentModelChange={vi.fn()}
        subagentReasoningEffort="medium"
        onSubagentReasoningEffortChange={onEffortChange}
      />,
    );

    expect(screen.queryByText("Reasoning Effort")).toBeNull();

    rerender(
      <SubagentConfigDialog
        open={true}
        onOpenChange={vi.fn()}
        subagentsEnabled={true}
        onToggleSubagents={vi.fn()}
        subagentModelId="o3-mini"
        onSubagentModelChange={vi.fn()}
        subagentReasoningEffort="medium"
        onSubagentReasoningEffortChange={onEffortChange}
      />,
    );

    expect(screen.getByText("Reasoning Effort")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "High" }));
    expect(onEffortChange).toHaveBeenCalledWith("high");
  });
});
