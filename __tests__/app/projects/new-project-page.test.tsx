import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewProjectPage from "@/app/(main)/projects/new/page";
import { ROUTES } from "@/config/routes";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

let currentTab = "settings";
const mockSetTab = vi.fn((newTab: string) => {
  currentTab = newTab;
});

vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: vi.fn().mockReturnValue({
      withOptions: vi.fn().mockReturnValue({}),
    }),
  },
  useQueryState: vi.fn((_key, _options) => [currentTab, mockSetTab]),
}));

const mockCreateProject = vi.fn();
vi.mock("@/actions/projects/create-project", () => ({
  createProject: (...args: any[]) => mockCreateProject(...args),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
  },
}));

const mockLoadProjects = vi.fn();
vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({
      mcpServers: [],
      skills: [],
      prompts: [],
      loadProjects: mockLoadProjects,
    }),
}));

vi.mock("@/hooks/use-resource-hydration", () => ({
  useResourceHydration: () => ({ isLoading: false }),
}));

vi.mock("@/hooks/use-knowledgebases", () => ({
  useKnowledgebases: () => ({ normalizedKnowledgebases: [] }),
}));

vi.mock("@/components/shared/markdown-tab-editor", () => ({
  MarkdownTabEditor: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      aria-label="prompt-editor"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

describe("NewProjectPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentTab = "settings";
  });

  it("renders page header and navigation back link", () => {
    render(<NewProjectPage />);

    expect(screen.getByText("New Project")).toBeInTheDocument();
    const backLink = screen.getByRole("link", { name: /back to projects/i });
    expect(backLink).toHaveAttribute("href", ROUTES.PROJECTS.path);
    const cancelLink = screen.getByRole("link", { name: /cancel/i });
    expect(cancelLink).toHaveAttribute("href", ROUTES.PROJECTS.path);
  });

  it("shows an error toast if name is empty upon submission", async () => {
    const user = userEvent.setup();
    render(<NewProjectPage />);

    // Click the top Create Project button
    const createButtons = screen.getAllByRole("button", {
      name: /create project/i,
    });
    await user.click(createButtons[0]);

    expect(mockToastError).toHaveBeenCalledWith("Project name is required");
    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  it("successfully creates project and redirects to detail page", async () => {
    const user = userEvent.setup();
    mockCreateProject.mockResolvedValueOnce({
      ok: true,
      value: { id: "proj-new-456", name: "Beta Project" },
    });

    render(<NewProjectPage />);

    const nameInput = screen.getByPlaceholderText("Project name");
    await user.type(nameInput, "Beta Project");

    const descInput = screen.getByPlaceholderText("Describe this project...");
    await user.type(descInput, "Beta workspace for testing");

    const createButtons = screen.getAllByRole("button", {
      name: /create project/i,
    });
    await user.click(createButtons[0]);

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Beta Project",
          description: "Beta workspace for testing",
          skillMode: "dynamic",
          promptMode: "all",
          knowledgebaseId: null,
        }),
      );
    });

    expect(mockToastSuccess).toHaveBeenCalledWith("Project created");
    expect(mockLoadProjects).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith(ROUTES.PROJECTS.detail("proj-new-456"));
  });

  it("displays server error toast when createProject fails", async () => {
    const user = userEvent.setup();
    mockCreateProject.mockResolvedValueOnce({
      ok: false,
      error: { message: "Failed to create project" },
    });

    render(<NewProjectPage />);

    const nameInput = screen.getByPlaceholderText("Project name");
    await user.type(nameInput, "Duplicate Project");

    const createButtons = screen.getAllByRole("button", {
      name: /create project/i,
    });
    await user.click(createButtons[0]);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to create project");
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});
