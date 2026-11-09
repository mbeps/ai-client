import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SkillScopeTab } from "@/components/skill/skill-scope-tab";
import { useAppStore } from "@/lib/store/use-app-store";

describe("SkillScopeTab", () => {
  const defaultProps = {
    projectIds: [],
    onProjectIdsChange: vi.fn(),
    assistantIds: [],
    onAssistantIdsChange: vi.fn(),
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
    expect(screen.getByRole("radio", { name: /scoped/i })).toBeInTheDocument();
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

  it("switches to scoped mode when scoped radio is clicked", async () => {
    const user = userEvent.setup();

    render(<SkillScopeTab {...defaultProps} />);

    const scopedRadio = screen.getByRole("radio", { name: /scoped/i });
    await user.click(scopedRadio);

    expect(scopedRadio).toHaveAttribute("aria-checked", "true");
  });
});
