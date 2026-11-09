import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProjectsPage from "@/app/(main)/projects/page";
import { ROUTES } from "@/config/routes";
import type { Project } from "@/types/project/project";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const mockLoadProjects = vi.fn();

const mockProjects: Project[] = [
  {
    id: "proj-1",
    userId: "user-1",
    name: "Alpha Workspace",
    description: "Core workspace",
    globalPrompt: "Global prompt",
    knowledgebaseId: null,
    tools: [],
    skillMode: "dynamic",
    skillIds: [],
    promptMode: "all",
    promptIds: [],
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
];

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({
      projects: mockProjects,
      loadProjects: mockLoadProjects,
      loadError: null,
    }),
}));

describe("ProjectsPage", () => {
  it("renders page title and New Project link pointing to ROUTES.PROJECTS.new", () => {
    render(<ProjectsPage />);

    expect(screen.getByText("Projects")).toBeInTheDocument();
    const createLink = screen.getByRole("link", { name: /new project/i });
    expect(createLink).toBeInTheDocument();
    expect(createLink).toHaveAttribute("href", ROUTES.PROJECTS.new);
  });
});
