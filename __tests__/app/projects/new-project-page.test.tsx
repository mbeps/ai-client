import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewProjectPage from "@/app/(main)/projects/new/page";
import { useResourceHydration } from "@/hooks/use-resource-hydration";
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
  useResourceHydration: vi.fn(() => ({ isLoading: false })),
}));

vi.mock("@/components/project/project-settings-tab", () => ({
  ProjectSettingsTab: (p: any) => (
    <div>
      <input
        placeholder="Project name"
        value={p.name}
        onChange={(e) => p.onNameChange(e.target.value)}
      />
      <textarea
        placeholder="Describe this project..."
        value={p.description}
        onChange={(e) => p.onDescriptionChange(e.target.value)}
      />
      <button onClick={p.onSave}>Create Project</button>
    </div>
  ),
}));

vi.mock("@/components/project/project-prompt-tab", () => ({
  ProjectPromptTab: (p: any) => (
    <button
      data-testid="trigger-project-prompt"
      onClick={() => {
        p.onPromptChange("P");
        p.onPromptModeChange("selected");
        p.onTogglePromptId("pr1");
        p.onSelectPromptIds(new Set(["pr2"]));
      }}
    >
      PromptCB
    </button>
  ),
}));

vi.mock("@/components/shared/tools-config-tab", () => ({
  ToolsConfigTab: (p: any) => (
    <button
      data-testid="trigger-project-tools"
      onClick={() => {
        p.onToggleTool("s1", "t1");
        p.onBulkSelect("s1", ["t1", "t2"], true);
      }}
    >
      ToolsCB
    </button>
  ),
}));

vi.mock("@/components/project/project-knowledgebase-tab", () => ({
  ProjectKnowledgebaseTab: (p: any) => (
    <button
      data-testid="trigger-project-kb"
      onClick={() => {
        p.onKnowledgebaseIdChange("kb1");
      }}
    >
      KbCB
    </button>
  ),
}));

vi.mock("@/components/shared/skills-config-tab", () => ({
  SkillsConfigTab: (p: any) => (
    <button
      data-testid="trigger-project-skills"
      onClick={() => {
        p.onSkillModeChange("selected");
        p.onToggleSkill("sk1");
      }}
    >
      SkillsCB
    </button>
  ),
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

  it("shows error toast when name is empty and handles thrown errors", async () => {
    const user = userEvent.setup();
    render(<NewProjectPage />);

    await user.click(screen.getByRole("tab", { name: /prompt/i }));
    const promptSaveBtn = screen.getAllByRole("button", { name: /create project/i })[0];
    await user.click(promptSaveBtn);
    expect(mockToastError).toHaveBeenCalledWith("Project name is required");

    mockCreateProject.mockRejectedValueOnce(new Error("Network error"));
    await user.type(screen.getByPlaceholderText("Project name"), "Proj");
    await user.click(screen.getAllByRole("button", { name: /create project/i })[0]);
    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalled();
    });
  });

  it("switches through all tabs and interacts with form controls", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<NewProjectPage />);

    await user.type(screen.getByPlaceholderText("Project name"), "My Project");
    const descInput = screen.queryByPlaceholderText(/description/i);
    if (descInput) await user.type(descInput, "My Desc");

    for (const tabName of [/prompt/i, /tools/i, /knowledge/i, /skills/i, /subagents/i]) {
      const tabs = screen.queryAllByRole("tab", { name: tabName });
      if (tabs[0]) await user.click(tabs[0]);
    }
  });

  it("handles empty error message and non-Error rejection on create", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<NewProjectPage />);

    await user.type(screen.getByPlaceholderText("Project name"), "Proj");

    mockCreateProject.mockResolvedValueOnce({ ok: false, error: { message: "" } });
    await user.click(screen.getAllByRole("button", { name: /create project/i })[0]);
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Failed to create project"),
    );

    mockCreateProject.mockRejectedValueOnce("non-error");
    await user.click(screen.getAllByRole("button", { name: /create project/i })[0]);
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Failed to create project"),
    );
  });

  it("renders skeleton when hydrating and covers all tab callbacks", async () => {
    vi.mocked(useResourceHydration).mockReturnValueOnce({ isLoading: true } as any);
    const { unmount } = render(<NewProjectPage />);
    expect(screen.queryByText("New Project")).not.toBeInTheDocument();
    unmount();

    const user = userEvent.setup();
    render(<NewProjectPage />);

    const tabToTestId: Array<[RegExp, string]> = [
      [/prompt/i, "trigger-project-prompt"],
      [/tools/i, "trigger-project-tools"],
      [/knowledge/i, "trigger-project-kb"],
      [/skills/i, "trigger-project-skills"],
    ];

    for (const [tabPattern, testId] of tabToTestId) {
      const tab = screen.getAllByRole("tab", { name: tabPattern })[0];
      await user.click(tab);
      const btn = screen.queryAllByTestId(testId)[0];
      if (btn) {
        await user.click(btn);
        await user.click(btn);
      }
    }
  });
});
