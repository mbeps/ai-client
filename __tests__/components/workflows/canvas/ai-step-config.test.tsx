import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AiStepConfig } from "@/components/workflows/canvas/config-sections/ai-step-config";

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
    onValueChange,
  }: {
    onValueChange: (val: string) => void;
  }) => (
    <div>
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
    <button type="button" onClick={() => onChange("medium")}>
      Set Reasoning
    </button>
  ),
}));

vi.mock("@/components/shared/markdown-tab-editor", () => ({
  MarkdownTabEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (val: string) => void;
  }) => (
    <textarea
      data-testid="markdown-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@/components/chat/tool-picker-list", () => ({
  ToolPickerList: ({
    onToggleTool,
    onBulkSelect,
    onBulkSelectBatch,
  }: {
    onToggleTool: (serverId: string, toolName: string) => void;
    onBulkSelect: (
      serverId: string,
      toolNames: string[],
      select: boolean,
    ) => void;
    onBulkSelectBatch: (
      groups: Array<{ serverId: string; toolNames: string[] }>,
      select: boolean,
    ) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onToggleTool("srv-1", "search")}>
        Toggle External Tool
      </button>
      <button type="button" onClick={() => onToggleTool("internal", "calc")}>
        Toggle Internal Tool
      </button>
      <button
        type="button"
        onClick={() => onBulkSelect("srv-1", ["search", "fetch"], true)}
      >
        Bulk Select
      </button>
      <button
        type="button"
        onClick={() =>
          onBulkSelectBatch(
            [{ serverId: "srv-1", toolNames: ["search", "fetch"] }],
            false,
          )
        }
      >
        Bulk Deselect
      </button>
    </div>
  ),
}));

vi.mock("@/components/chat/skills-picker", () => ({
  SkillsPicker: ({
    onToggleSkill,
    onSelectSkills,
  }: {
    onToggleSkill: (id: string) => void;
    onSelectSkills: (ids: Set<string>) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onToggleSkill("sk-1")}>
        Toggle Skill
      </button>
      <button type="button" onClick={() => onSelectSkills(new Set(["sk-2"]))}>
        Select Skills
      </button>
    </div>
  ),
}));

vi.mock("@/components/shared/subagent-picker", () => ({
  SubagentPicker: ({
    onToggle,
    onSelectIds,
  }: {
    onToggle: (id: string) => void;
    onSelectIds: (ids: string[]) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onToggle("ag-1")}>
        Toggle Subagent
      </button>
      <button type="button" onClick={() => onToggle("ag-2")}>
        Add Subagent
      </button>
      <button type="button" onClick={() => onSelectIds(["ag-3"])}>
        Select Subagents
      </button>
    </div>
  ),
}));

const baseData = {
  kind: "ai_step" as const,
  variableName: "step1",
  prompt: "Hello",
  mcpServerIds: ["srv-0"],
  toolIds: ["internal:tool:calc"],
  requiresReview: true,
};

describe("AiStepConfig", () => {
  it("handles prompt section callbacks", () => {
    const onChange = vi.fn();
    render(
      <AiStepConfig
        data={baseData}
        mcpServers={[]}
        knowledgeBases={[]}
        skills={[]}
        agents={[]}
        activeSection="prompt"
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByTestId("markdown-editor"), {
      target: { value: "Updated prompt" },
    });
    expect(onChange).toHaveBeenCalledWith({ prompt: "Updated prompt" });

    fireEvent.click(screen.getByText("Select Model"));
    expect(onChange).toHaveBeenCalledWith({ modelId: "gpt-4o" });

    fireEvent.click(screen.getByText("Clear Model"));
    expect(onChange).toHaveBeenCalledWith({
      modelId: undefined,
      reasoningEffort: undefined,
    });

    fireEvent.click(screen.getByText("Set Reasoning"));
    expect(onChange).toHaveBeenCalledWith({ reasoningEffort: "medium" });

    fireEvent.click(screen.getByRole("switch", { name: /Human Review Gate/i }));
    expect(onChange).toHaveBeenCalledWith({ requiresReview: false });
  });

  it("handles tools section callbacks including ensureServerIncluded and bulk select/deselect", () => {
    const onChange = vi.fn();
    render(
      <AiStepConfig
        data={baseData}
        mcpServers={[
          { id: "srv-1", name: "S1", enabled: true } as never,
          { id: "srv-2", name: "S2", enabled: false } as never,
        ]}
        knowledgeBases={[]}
        skills={[]}
        agents={[]}
        activeSection="tools"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText("Toggle External Tool"));
    expect(onChange).toHaveBeenCalledWith({
      toolIds: ["internal:tool:calc", "srv-1:tool:search"],
      mcpServerIds: ["srv-0", "srv-1"],
    });

    fireEvent.click(screen.getByText("Toggle Internal Tool"));
    expect(onChange).toHaveBeenCalledWith({ toolIds: [] });

    fireEvent.click(screen.getByText("Bulk Select"));
    expect(onChange).toHaveBeenCalledWith({
      toolIds: ["internal:tool:calc", "srv-1:tool:search", "srv-1:tool:fetch"],
      mcpServerIds: ["srv-0", "srv-1"],
    });

    fireEvent.click(screen.getByText("Bulk Deselect"));
    expect(onChange).toHaveBeenCalledWith({
      toolIds: ["internal:tool:calc"],
    });
  });

  it("handles skills and subagents sections", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <AiStepConfig
        data={{ ...baseData, skillMode: "specific", skillIds: [] }}
        mcpServers={[]}
        knowledgeBases={[]}
        skills={[]}
        agents={[]}
        activeSection="skills"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText("Toggle Skill"));
    expect(onChange).toHaveBeenCalledWith({ skillIds: ["sk-1"] });

    fireEvent.click(screen.getByText("Select Skills"));
    expect(onChange).toHaveBeenCalledWith({ skillIds: ["sk-2"] });

    rerender(
      <AiStepConfig
        data={{ ...baseData, subagentIds: ["ag-1"] }}
        mcpServers={[]}
        knowledgeBases={[]}
        skills={[]}
        agents={[]}
        activeSection="subagents"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByText("Toggle Subagent"));
    expect(onChange).toHaveBeenCalledWith({ subagentIds: [] });

    fireEvent.click(screen.getByText("Add Subagent"));
    expect(onChange).toHaveBeenCalledWith({ subagentIds: ["ag-1", "ag-2"] });

    fireEvent.click(screen.getByText("Select Subagents"));
    expect(onChange).toHaveBeenCalledWith({ subagentIds: ["ag-3"] });
  });

  it("handles select changes and undefined optional arrays", () => {
    const onChange = vi.fn();
    const minimalData = {
      kind: "ai_step" as const,
      variableName: "step2",
      prompt: "Hi",
      requiresReview: true,
    };

    const { rerender } = render(
      <AiStepConfig
        data={minimalData}
        mcpServers={[]}
        activeSection="prompt"
        onChange={onChange}
      />,
    );

    const promptSelects = screen.getAllByTestId("mock-select");
    fireEvent.change(promptSelects[0], { target: { value: "markdown" } });
    expect(onChange).toHaveBeenCalledWith({ canvasMode: "markdown" });

    fireEvent.change(promptSelects[1], { target: { value: "before" } });
    expect(onChange).toHaveBeenCalledWith({ reviewTiming: "before" });

    rerender(
      <AiStepConfig
        data={minimalData}
        mcpServers={[]}
        activeSection="tools"
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId("mock-select"), {
      target: { value: "auto" },
    });
    expect(onChange).toHaveBeenCalledWith({ toolApprovalMode: "auto" });

    rerender(
      <AiStepConfig
        data={minimalData}
        mcpServers={[]}
        activeSection="skills"
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByTestId("mock-select"), {
      target: { value: "none" },
    });
    expect(onChange).toHaveBeenCalledWith({ skillMode: "none" });

    rerender(
      <AiStepConfig
        data={minimalData}
        mcpServers={[]}
        activeSection="subagents"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText("Toggle Subagent"));
    expect(onChange).toHaveBeenCalledWith({ subagentIds: ["ag-1"] });
  });
});
