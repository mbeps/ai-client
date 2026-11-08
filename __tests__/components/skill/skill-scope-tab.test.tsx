import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SkillScopeTab } from "@/components/skill/skill-scope-tab";
import { useAppStore } from "@/lib/store/use-app-store";

describe("SkillScopeTab", () => {
  const defaultProps = {
    scope: "global" as const,
    onScopeChange: vi.fn(),
    projectId: null,
    onProjectIdChange: vi.fn(),
    assistantId: null,
    onAssistantIdChange: vi.fn(),
    onSave: vi.fn(),
    isSaving: false,
  };

  it("renders scope header, selector options, and save button", () => {
    render(<SkillScopeTab {...defaultProps} />);

    expect(screen.getByText("Scope & Visibility")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Control where this agent skill shortcut and tool can be invoked.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /global/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /project/i })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /assistant/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save changes/i }),
    ).toBeInTheDocument();
  });

  it("calls onSave when save button is clicked", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(<SkillScopeTab {...defaultProps} onSave={onSave} />);

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveButton);

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("calls onScopeChange when scope radio is clicked", async () => {
    const user = userEvent.setup();
    const onScopeChange = vi.fn();

    render(<SkillScopeTab {...defaultProps} onScopeChange={onScopeChange} />);

    const projectRadio = screen.getByRole("radio", { name: /project/i });
    await user.click(projectRadio);

    expect(onScopeChange).toHaveBeenCalledWith("project");
  });
});
