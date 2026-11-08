import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SkillDetailsTab } from "@/components/skill/skill-details-tab";

describe("SkillDetailsTab", () => {
  const defaultProps = {
    displayName: "AI SDK Nextjs",
    onDisplayNameChange: vi.fn(),
    name: "ai-sdk-nextjs",
    onNameChange: vi.fn(),
    description: "Helper skill for Next.js AI SDK",
    onDescriptionChange: vi.fn(),
    enabled: true,
    onEnabledChange: vi.fn(),
    onSave: vi.fn(),
    isSaving: false,
  };

  it("renders display name, skill ID, description, and status correctly", () => {
    render(<SkillDetailsTab {...defaultProps} />);

    expect(screen.getByDisplayValue("AI SDK Nextjs")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ai-sdk-nextjs")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Helper skill for Next.js AI SDK"),
    ).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByText("Skill ID")).toBeInTheDocument();
    expect(screen.getByText("/")).toBeInTheDocument();
    expect(screen.getByText(/31\/500/)).toBeInTheDocument();
  });

  it("calls onDisplayNameChange when title changes", async () => {
    const user = userEvent.setup();
    const onDisplayNameChange = vi.fn();

    render(
      <SkillDetailsTab
        {...defaultProps}
        onDisplayNameChange={onDisplayNameChange}
      />,
    );

    const input = screen.getByLabelText("Skill name");
    await user.clear(input);
    await user.type(input, "New Name");

    expect(onDisplayNameChange).toHaveBeenCalled();
  });

  it("sanitizes slug input on change", async () => {
    const user = userEvent.setup();
    const onNameChange = vi.fn();

    render(<SkillDetailsTab {...defaultProps} onNameChange={onNameChange} />);

    const slugInput = screen.getByLabelText("Skill ID");
    await user.clear(slugInput);
    await user.type(slugInput, "My_Skill!");

    expect(onNameChange).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-z0-9-]*$/),
    );
  });

  it("calls onSave when save button is clicked", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(<SkillDetailsTab {...defaultProps} onSave={onSave} />);

    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveBtn);

    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
