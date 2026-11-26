import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const {
  mockRenameProject,
  mockDeleteProject,
  mockSetShowRename,
  mockSetShowDelete,
  mockLoadProjects,
} = vi.hoisted(() => ({
  mockRenameProject: vi.fn(),
  mockDeleteProject: vi.fn(),
  mockSetShowRename: vi.fn(),
  mockSetShowDelete: vi.fn(),
  mockLoadProjects: vi.fn(),
}));

vi.mock("@/actions/projects/rename-project", () => ({
  renameProject: mockRenameProject,
}));

vi.mock("@/actions/projects/delete-project", () => ({
  deleteProject: mockDeleteProject,
}));

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: (s: { loadProjects: () => void }) => unknown) =>
    selector({ loadProjects: mockLoadProjects }),
}));

vi.mock("@/hooks/use-entity-options", () => ({
  useEntityOptions: (opts: {
    onRename: (id: string, name: string) => void;
    onDelete: (id: string) => void;
  }) => ({
    isMobile: false,
    showRename: false,
    setShowRename: mockSetShowRename,
    showDelete: false,
    setShowDelete: mockSetShowDelete,
    isDeleting: false,
    handleRename: () => opts.onRename("proj-1", "New Name"),
    handleDelete: () => opts.onDelete("proj-1"),
  }),
}));

vi.mock("@/components/shared/base-entity-options", () => ({
  BaseEntityOptions: ({
    items,
    handleRename,
    handleDelete,
  }: {
    items: Array<{ label: string; onClick: () => void }>;
    handleRename: () => void;
    handleDelete: () => void;
  }) => (
    <div>
      {items.map((item) => (
        <button key={item.label} type="button" onClick={item.onClick}>
          {item.label}
        </button>
      ))}
      <button type="button" onClick={handleRename}>
        Trigger Rename
      </button>
      <button type="button" onClick={handleDelete}>
        Trigger Delete
      </button>
    </div>
  ),
}));

import { ProjectOptions } from "@/components/project/project-options";

describe("ProjectOptions", () => {
  it("wires rename, delete, and menu item callbacks", () => {
    render(
      <ProjectOptions
        project={{ id: "proj-1", name: "My Project" } as any}
      />,
    );

    fireEvent.click(screen.getByText("Rename Project"));
    expect(mockSetShowRename).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByText("Delete Project"));
    expect(mockSetShowDelete).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByText("Trigger Rename"));
    expect(mockRenameProject).toHaveBeenCalledWith("proj-1", "New Name");

    fireEvent.click(screen.getByText("Trigger Delete"));
    expect(mockDeleteProject).toHaveBeenCalledWith("proj-1");
  });
});
