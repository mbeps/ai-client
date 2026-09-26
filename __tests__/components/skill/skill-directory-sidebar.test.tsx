import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SkillDirectorySidebar } from "@/components/skill/skill-directory-sidebar";
import type { SkillBundledFile } from "@/types/skill/skill";

const sampleFiles: SkillBundledFile[] = [
  { path: "references/guide.md", content: "Guide content" },
  { path: "scripts/run.sh", content: "#!/bin/bash" },
];

describe("SkillDirectorySidebar", () => {
  it("renders directory count and root SKILL.md", () => {
    render(
      <SkillDirectorySidebar
        files={sampleFiles}
        selectedPath="SKILL.md"
        onSelectFile={vi.fn()}
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onRenameFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onRenameFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
        onMoveFile={vi.fn()}
      />,
    );

    expect(screen.getByText("Directory")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("SKILL.md")).toBeInTheDocument();
    expect(screen.getByText("references")).toBeInTheDocument();
    expect(screen.getByText("scripts")).toBeInTheDocument();
  });

  it("calls onSelectFile when clicking on a file item", async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();

    render(
      <SkillDirectorySidebar
        files={sampleFiles}
        selectedPath="SKILL.md"
        onSelectFile={handleSelect}
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onRenameFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onRenameFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
        onMoveFile={vi.fn()}
      />,
    );

    const guideFile = screen.getByText("guide.md");
    await user.click(guideFile);

    expect(handleSelect).toHaveBeenCalledWith("references/guide.md");
  });

  it("opens create file dialog and submits new file", async () => {
    const user = userEvent.setup();
    const handleCreateFile = vi.fn();

    render(
      <SkillDirectorySidebar
        files={sampleFiles}
        selectedPath="SKILL.md"
        onSelectFile={vi.fn()}
        onCreateFile={handleCreateFile}
        onCreateFolder={vi.fn()}
        onRenameFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onRenameFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
        onMoveFile={vi.fn()}
      />,
    );

    const newFileBtn = screen.getByTitle("New File");
    await user.click(newFileBtn);

    const input = screen.getByPlaceholderText(/guide\.md or script\.py/i);
    await user.type(input, "notes.md");

    const submitBtn = screen.getByRole("button", { name: /^Create File$/i });
    await user.click(submitBtn);

    expect(handleCreateFile).toHaveBeenCalledWith("notes.md", "# notes.md\n\n");
  });

  it("opens create folder dialog and submits new folder", async () => {
    const user = userEvent.setup();
    const handleCreateFolder = vi.fn();

    render(
      <SkillDirectorySidebar
        files={sampleFiles}
        selectedPath="SKILL.md"
        onSelectFile={vi.fn()}
        onCreateFile={vi.fn()}
        onCreateFolder={handleCreateFolder}
        onRenameFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onRenameFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
        onMoveFile={vi.fn()}
      />,
    );

    const newFolderBtn = screen.getByTitle("New Folder");
    await user.click(newFolderBtn);

    const input = screen.getByPlaceholderText(/references, scripts, or assets/i);
    await user.type(input, "assets");

    const submitBtn = screen.getByRole("button", { name: /^Create Folder$/i });
    await user.click(submitBtn);

    expect(handleCreateFolder).toHaveBeenCalledWith("assets");
  });

  it("opens move file dialog when externalMoveFile is passed", async () => {
    const user = userEvent.setup();
    const handleMoveFile = vi.fn();

    render(
      <SkillDirectorySidebar
        files={sampleFiles}
        selectedPath="SKILL.md"
        onSelectFile={vi.fn()}
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onRenameFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onRenameFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
        onMoveFile={handleMoveFile}
        externalMoveFile="references/guide.md"
      />,
    );

    expect(
      screen.getByRole("heading", { name: /^Move File$/i }),
    ).toBeInTheDocument();
    const rootBtn = screen.getByRole("button", { name: /^Root \(\/\)$/i });
    await user.click(rootBtn);

    const submitMoveBtn = screen.getByRole("button", { name: /^Move File$/i });
    await user.click(submitMoveBtn);

    expect(handleMoveFile).toHaveBeenCalledWith("references/guide.md", "");
  });
});

