import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentPromptTab } from "@/components/agent/agent-prompt-tab";

const mockPrompts = vi.hoisted(() => ({
  list: [] as any[],
}));

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: vi.fn((selector: any) => selector({ prompts: mockPrompts.list })),
}));

vi.mock("@/components/shared/markdown-tab-editor", () => ({
  MarkdownTabEditor: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@/components/chat/prompt-picker", () => ({
  PromptPicker: ({
    prompts,
    onTogglePrompt,
    onSelectAll,
    onClearAll,
  }: any) => (
    <div data-testid="prompt-picker">
      <span>Global count: {prompts.length}</span>
      <button type="button" onClick={() => onTogglePrompt({ id: "p-global" })}>
        Toggle Global
      </button>
      <button type="button" onClick={() => onSelectAll(prompts)}>
        Select All
      </button>
      <button type="button" onClick={() => onClearAll()}>
        Clear All
      </button>
    </div>
  ),
}));

vi.mock("@/components/prompt/prompt-card", () => ({
  PromptCard: ({ prompt }: any) => (
    <div data-testid="prompt-card">{prompt.title}</div>
  ),
}));

describe("AgentPromptTab", () => {
  beforeEach(() => {
    mockPrompts.list = [
      { id: "p-global", title: "Global Prompt", projectIds: [], agentIds: [] },
      { id: "p-agent", title: "Agent Prompt", agentIds: ["agent-1"] },
      { id: "p-legacy", title: "Legacy Prompt", assistantIds: ["agent-1"] },
    ];
  });

  it("renders editors, mode options, prompt picker in specific mode, and agent shortcuts", () => {
    const onPromptChange = vi.fn();
    const onSubagentPromptChange = vi.fn();
    const onPromptModeChange = vi.fn();
    const onTogglePromptId = vi.fn();
    const onSelectPromptIds = vi.fn();
    const onSave = vi.fn();

    render(
      <AgentPromptTab
        agentId="agent-1"
        prompt="sys"
        onPromptChange={onPromptChange}
        subagentPrompt="sub"
        onSubagentPromptChange={onSubagentPromptChange}
        promptMode="specific"
        onPromptModeChange={onPromptModeChange}
        selectedPromptIds={new Set(["p-global"])}
        onTogglePromptId={onTogglePromptId}
        onSelectPromptIds={onSelectPromptIds}
        onSave={onSave}
      />,
    );

    expect(screen.getByText("Global count: 1")).toBeInTheDocument();
    expect(screen.getAllByTestId("prompt-card")).toHaveLength(2);

    fireEvent.click(screen.getByText("Toggle Global"));
    expect(onTogglePromptId).toHaveBeenCalledWith("p-global");

    fireEvent.click(screen.getByText("Select All"));
    expect(onSelectPromptIds).toHaveBeenCalledWith(new Set(["p-global"]));

    fireEvent.click(screen.getByText("Clear All"));
    expect(onSelectPromptIds).toHaveBeenCalledWith(new Set());

    fireEvent.click(screen.getByText("Agent Prompts Only"));
    expect(onPromptModeChange).toHaveBeenCalledWith("none");

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("renders empty shortcuts state, disabled state, and saving state", () => {
    mockPrompts.list = [];
    const { rerender } = render(
      <AgentPromptTab
        agentId="agent-1"
        prompt=""
        onPromptChange={vi.fn()}
        subagentPrompt=""
        onSubagentPromptChange={vi.fn()}
        onSave={vi.fn()}
        isSaving
      />,
    );

    expect(
      screen.getByText("No agent-specific shortcuts yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();

    rerender(
      <AgentPromptTab
        prompt=""
        onPromptChange={vi.fn()}
        subagentPrompt=""
        onSubagentPromptChange={vi.fn()}
        onSave={vi.fn()}
        disabled
      />,
    );
    expect(
      screen.queryByRole("button", { name: /save changes/i }),
    ).not.toBeInTheDocument();
  });
});
