import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SkillDirectoryPicker } from "@/components/skill/skill-directory-picker";
import type { SkillBundledFile } from "@/types/skill/skill";

const sampleFiles: SkillBundledFile[] = [
  { path: "references/guide.md", content: "Guide content" },
  { path: "scripts/run.sh", content: "#!/bin/bash" },
];

describe("SkillDirectoryPicker", () => {
  const defaultProps = {
    files: sampleFiles,
    selectedPath: "SKILL.md",
    onSelectFile: vi.fn(),
    onCreateFile: vi.fn(),
    onCreateFolder: vi.fn(),
    onRenameFile: vi.fn(),
    onDeleteFile: vi.fn(),
    onRenameFolder: vi.fn(),
    onDeleteFolder: vi.fn(),
    onMoveFile: vi.fn(),
  };

  it("is collapsed by default and shows accordion trigger with directory info", () => {
    render(<SkillDirectoryPicker {...defaultProps} />);

    const trigger = screen.getByRole("button", { name: /directory/i });
    expect(trigger).toBeInTheDocument();
    expect(screen.getByText("Directory")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("references")).not.toBeInTheDocument();
  });

  it("expands on clicking header and renders actions and tree items", async () => {
    const user = userEvent.setup();
    render(<SkillDirectoryPicker {...defaultProps} />);

    const trigger = screen.getByRole("button", { name: /directory/i });
    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTitle("New File")).toBeInTheDocument();
    expect(screen.getByTitle("New Folder")).toBeInTheDocument();
    expect(screen.getByText("SKILL.md")).toBeInTheDocument();
    expect(screen.getByText("references")).toBeInTheDocument();
    expect(screen.getByText("guide.md")).toBeInTheDocument();
    expect(screen.getByText("scripts")).toBeInTheDocument();
    expect(screen.getByText("run.sh")).toBeInTheDocument();
  });

  it("calls onSelectFile when clicking a file node in expanded tree view", async () => {
    const user = userEvent.setup();
    const onSelectFile = vi.fn();

    render(
      <SkillDirectoryPicker {...defaultProps} onSelectFile={onSelectFile} />,
    );

    const trigger = screen.getByRole("button", { name: /directory/i });
    await user.click(trigger);

    const guideNode = screen.getByText("guide.md");
    await user.click(guideNode);

    expect(onSelectFile).toHaveBeenCalledWith("references/guide.md");
  });
});
