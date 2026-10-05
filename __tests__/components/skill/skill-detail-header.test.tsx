import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SkillDetailHeader } from "@/components/skill/skill-detail-header";

describe("SkillDetailHeader", () => {
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
    onDelete: vi.fn(),
    isDeleting: false,
    onExport: vi.fn(),
    isExporting: false,
  };

  it("renders display name, slug, description, and status correctly", () => {
    render(<SkillDetailHeader {...defaultProps} />);

    expect(screen.getByDisplayValue("AI SDK Nextjs")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ai-sdk-nextjs")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Helper skill for Next.js AI SDK"),
    ).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByText("Slash command: /")).toBeInTheDocument();
    expect(screen.getByText(/31\/500/)).toBeInTheDocument();
  });

  it("calls onDisplayNameChange when editing title", async () => {
    const user = userEvent.setup();
    const onDisplayNameChange = vi.fn();

    render(
      <SkillDetailHeader
        {...defaultProps}
        onDisplayNameChange={onDisplayNameChange}
      />,
    );

    const titleInput = screen.getByLabelText("Skill name");
    await user.clear(titleInput);
    await user.type(titleInput, "Updated Skill");

    expect(onDisplayNameChange).toHaveBeenCalled();
  });

  it("sanitizes slug input on change", async () => {
    const user = userEvent.setup();
    const onNameChange = vi.fn();

    render(
      <SkillDetailHeader {...defaultProps} onNameChange={onNameChange} />,
    );

    const slugInput = screen.getByLabelText("Skill slash command slug");
    await user.clear(slugInput);
    await user.type(slugInput, "My-New_Skill!");

    expect(onNameChange).toHaveBeenCalledWith(expect.stringMatching(/^[a-z0-9-]*$/));
  });

  it("calls onDescriptionChange with trimmed limit on edit", async () => {
    const user = userEvent.setup();
    const onDescriptionChange = vi.fn();

    render(
      <SkillDetailHeader
        {...defaultProps}
        onDescriptionChange={onDescriptionChange}
      />,
    );

    const descInput = screen.getByLabelText("Skill description");
    await user.type(descInput, "More details");

    expect(onDescriptionChange).toHaveBeenCalled();
  });

  it("toggles enabled switch", async () => {
    const user = userEvent.setup();
    const onEnabledChange = vi.fn();

    render(
      <SkillDetailHeader
        {...defaultProps}
        onEnabledChange={onEnabledChange}
      />,
    );

    const switchEl = screen.getByRole("switch");
    await user.click(switchEl);

    expect(onEnabledChange).toHaveBeenCalledWith(false);
  });

  it("handles button actions for Save and dropdown actions for Export and Delete", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    const onDelete = vi.fn();
    const onSave = vi.fn();

    render(
      <SkillDetailHeader
        {...defaultProps}
        onExport={onExport}
        onDelete={onDelete}
        onSave={onSave}
      />,
    );

    // Save Changes
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(onSave).toHaveBeenCalledTimes(1);

    // Open More Options dropdown
    const moreBtn = screen.getByRole("button", { name: /more options/i });
    await user.click(moreBtn);

    // Export Bundle from dropdown
    const exportItem = await screen.findByRole("menuitem", { name: /export bundle/i });
    await user.click(exportItem);
    expect(onExport).toHaveBeenCalledTimes(1);

    // Open dropdown again for Delete Skill
    await user.click(moreBtn);
    const deleteItem = await screen.findByRole("menuitem", { name: /delete skill/i });
    await user.click(deleteItem);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
