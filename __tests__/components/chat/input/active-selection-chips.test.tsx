import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActiveSelectionChips } from "@/components/chat/input/active-selection-chips";

describe("ActiveSelectionChips", () => {
  const baseProps = {
    selectedAssistant: null,
    onRemoveAssistant: vi.fn(),
    selectedPrompts: [],
    onRemovePrompt: vi.fn(),
    selectedKbs: new Set<string>(),
    knowledgebases: [],
    onRemoveKb: vi.fn(),
    selectedSkills: new Set<string>(),
    skills: [],
    onRemoveSkill: vi.fn(),
  };

  it("returns null when nothing is selected", () => {
    const { container } = render(<ActiveSelectionChips {...baseProps} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders assistant, MCP/local prompts, skills, and knowledgebases and handles removals", () => {
    const onRemoveAssistant = vi.fn();
    const onRemovePrompt = vi.fn();
    const onRemoveKb = vi.fn();
    const onRemoveSkill = vi.fn();

    const prompts: any[] = [
      { id: "p1", isMcp: true, title: "MCP Prompt" },
      { id: "p2", isMcp: false, shortcut: "sc", title: "Local Prompt" },
      { id: "p3", isMcp: false, title: "Title Only" },
    ];

    render(
      <ActiveSelectionChips
        {...baseProps}
        selectedAssistant={{ id: "a1", name: "Coder" } as any}
        onRemoveAssistant={onRemoveAssistant}
        selectedPrompts={prompts}
        onRemovePrompt={onRemovePrompt}
        selectedKbs={new Set(["kb1", "kb-missing"])}
        knowledgebases={[{ id: "kb1", name: "Docs KB" } as any]}
        onRemoveKb={onRemoveKb}
        selectedSkills={new Set(["sk1", "sk-name", "sk-missing"])}
        skills={[
          { id: "sk1", name: "skill-one", displayName: "Skill One" } as any,
          { id: "other", name: "sk-name", displayName: "Skill Name" } as any,
        ]}
        onRemoveSkill={onRemoveSkill}
      />,
    );

    expect(screen.getByText("@Coder")).toBeTruthy();
    expect(screen.getByText("/MCP Prompt")).toBeTruthy();
    expect(screen.getByText("/sc")).toBeTruthy();
    expect(screen.getByText("/Title Only")).toBeTruthy();
    expect(screen.getByText("/skill-one")).toBeTruthy();
    expect(screen.getByText("/sk-name")).toBeTruthy();
    expect(screen.getByText("/sk-missing")).toBeTruthy();
    expect(screen.getByText("Docs KB")).toBeTruthy();
    expect(screen.getByText("kb-missing")).toBeTruthy();

    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => fireEvent.click(btn));

    expect(onRemoveAssistant).toHaveBeenCalledTimes(1);
    expect(onRemovePrompt).toHaveBeenCalledWith("p1");
    expect(onRemovePrompt).toHaveBeenCalledWith("p2");
    expect(onRemovePrompt).toHaveBeenCalledWith("p3");
    expect(onRemoveSkill).toHaveBeenCalledWith("sk1");
    expect(onRemoveSkill).toHaveBeenCalledWith("sk-name");
    expect(onRemoveSkill).toHaveBeenCalledWith("sk-missing");
    expect(onRemoveKb).toHaveBeenCalledWith("kb1");
    expect(onRemoveKb).toHaveBeenCalledWith("kb-missing");
  });

  it("renders skills without remove button when onRemoveSkill is omitted", () => {
    render(
      <ActiveSelectionChips
        {...baseProps}
        selectedSkills={new Set(["sk1"])}
        skills={[{ id: "sk1", displayName: "Display Only" } as any]}
        onRemoveSkill={undefined}
      />,
    );
    expect(screen.getByText("/Display Only")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
