import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SkillEditorTab } from "@/components/skill/skill-editor-tab";

// Mock MarkdownTabEditor
vi.mock("@/components/shared/markdown-tab-editor", () => ({
  MarkdownTabEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (val: string) => void;
  }) => (
    <textarea
      aria-label="mock-markdown-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

describe("SkillEditorTab", () => {
  const defaultProps = {
    files: [{ path: "references/guide.md", content: "Guide content" }],
    selectedFilePath: "SKILL.md",
    onSelectFile: vi.fn(),
    activeContent: "# Main instructions",
    onChangeContent: vi.fn(),
    onCreateFile: vi.fn(),
    onCreateFolder: vi.fn(),
    onRenameFile: vi.fn(),
    onDeleteFile: vi.fn(),
    onRenameFolder: vi.fn(),
    onDeleteFolder: vi.fn(),
    onMoveFile: vi.fn(),
    isSkillMd: true,
    onSave: vi.fn(),
    isSaving: false,
  };

  it("renders editor header, top directory picker, and file editor", () => {
    render(<SkillEditorTab {...defaultProps} />);

    expect(screen.getByText("Editor")).toBeInTheDocument();
    expect(screen.getByText("Directory")).toBeInTheDocument();
    expect(screen.getAllByText("SKILL.md").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Primary Instructions")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("# Main instructions"),
    ).toBeInTheDocument();
  });

  it("calls onSave when save button is clicked", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(<SkillEditorTab {...defaultProps} onSave={onSave} />);

    const saveButtons = screen.getAllByRole("button", {
      name: /save changes/i,
    });
    await user.click(saveButtons[0]);

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("supports rename, move, and delete when editing a non-SKILL.md file", async () => {
    const user = userEvent.setup();
    const onRenameFile = vi.fn();
    const onDeleteFile = vi.fn();
    const promptSpy = vi
      .spyOn(window, "prompt")
      .mockReturnValueOnce("references/renamed.md")
      .mockReturnValueOnce(null);

    render(
      <SkillEditorTab
        {...defaultProps}
        isSkillMd={false}
        selectedFilePath="references/guide.md"
        activeContent="Guide content"
        onRenameFile={onRenameFile}
        onDeleteFile={onDeleteFile}
        onClearFileToMove={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /rename/i }));
    expect(onRenameFile).toHaveBeenCalledWith(
      "references/guide.md",
      "references/renamed.md",
    );

    await user.click(screen.getByRole("button", { name: /rename/i }));
    expect(onRenameFile).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /move/i }));
    await user.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDeleteFile).toHaveBeenCalledWith("references/guide.md");

    promptSpy.mockRestore();
  });
});
