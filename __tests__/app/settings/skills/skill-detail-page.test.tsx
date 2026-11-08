import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// Mock CSS imports for jsdom
vi.mock("katex/dist/katex.min.css", () => ({}));
vi.mock("@blocknote/mantine/style.css", () => ({}));
vi.mock("@blocknote/core/fonts/inter.css", () => ({}));

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
      aria-label="skill-content-editor"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// Hoisted Mocks
const mockPush = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());
const mockNotFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
let currentParamId = "skill-1";
let currentQueryTab = "details";
const mockSetTab = vi.fn((newTab: string) => {
  currentQueryTab = newTab;
});

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: currentParamId }),
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  notFound: () => mockNotFound(),
}));

vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: vi.fn().mockReturnValue({
      withOptions: vi.fn().mockReturnValue({}),
    }),
  },
  useQueryState: vi.fn((_key, _options) => [currentQueryTab, mockSetTab]),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/actions/skills/update-skill", () => ({
  updateSkill: vi.fn(),
}));

vi.mock("@/actions/skills/delete-skill", () => ({
  deleteSkill: vi.fn(),
}));

vi.mock("@/actions/skills/export-skill", () => ({
  exportSkillZip: vi.fn(),
}));

import { deleteSkill } from "@/actions/skills/delete-skill";
import { updateSkill } from "@/actions/skills/update-skill";
import SkillDetailPage from "@/app/settings/skills/[id]/page";
import { useAppStore } from "@/lib/store/use-app-store";

describe("SkillDetailPage", () => {
  const mockSkill = {
    id: "skill-1",
    userId: "user-1",
    name: "ai-sdk-nextjs",
    displayName: "AI SDK Nextjs",
    description: "Helper skill for Next.js AI SDK",
    content: "Skill instructions content",
    files: [
      {
        path: "SKILL.md",
        content: "Skill instructions content",
      },
    ],
    enabled: true,
    projectId: null,
    assistantId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProjects = [
    {
      id: "proj-1",
      userId: "user-1",
      name: "Alpha Project",
      description: "Description",
      globalPrompt: "",
      tools: [],
      skillMode: "dynamic" as const,
      skillIds: [],
      promptMode: "all" as const,
      promptIds: [],
      knowledgebaseId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockAssistants = [
    {
      id: "asst-1",
      userId: "user-1",
      name: "Beta Assistant",
      description: "Description",
      prompt: "",
      tools: [],
      skillMode: "dynamic" as const,
      skillIds: [],
      promptMode: "all" as const,
      promptIds: [],
      avatar: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    currentParamId = "skill-1";
    currentQueryTab = "details";
    useAppStore.setState({
      skills: [mockSkill],
      projects: mockProjects,
      assistants: mockAssistants,
    });
  });

  it("renders tabs correctly with Details active initially", () => {
    render(<SkillDetailPage />);

    expect(screen.getByRole("tab", { name: /details/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /editor/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /scope/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /export/i })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /danger zone/i }),
    ).toBeInTheDocument();

    expect(screen.getByDisplayValue("AI SDK Nextjs")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ai-sdk-nextjs")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Helper skill for Next.js AI SDK"),
    ).toBeInTheDocument();
  });

  it("switches tabs to Editor, Scope, Export, and Danger Zone", async () => {
    const user = userEvent.setup();
    render(<SkillDetailPage />);

    const editorTabTrigger = screen.getByRole("tab", { name: /editor/i });
    await user.click(editorTabTrigger);
    expect(mockSetTab).toHaveBeenCalledWith("editor");

    const scopeTabTrigger = screen.getByRole("tab", { name: /scope/i });
    await user.click(scopeTabTrigger);
    expect(mockSetTab).toHaveBeenCalledWith("scope");

    const exportTabTrigger = screen.getByRole("tab", { name: /export/i });
    await user.click(exportTabTrigger);
    expect(mockSetTab).toHaveBeenCalledWith("export");

    const dangerTabTrigger = screen.getByRole("tab", { name: /danger zone/i });
    await user.click(dangerTabTrigger);
    expect(mockSetTab).toHaveBeenCalledWith("danger");
  });

  it("renders editor tab with top directory picker and file editor", async () => {
    currentQueryTab = "editor";
    render(<SkillDetailPage />);

    expect(screen.getByText("Directory")).toBeInTheDocument();
    expect(screen.getAllByText("SKILL.md").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Primary Instructions")).toBeInTheDocument();
  });

  it("switches scope to project and saves with projectId in payload", async () => {
    const user = userEvent.setup();
    currentQueryTab = "scope";
    vi.mocked(updateSkill).mockResolvedValueOnce({
      ok: true,
      value: { ...mockSkill, projectId: "proj-1" } as any,
    });

    render(<SkillDetailPage />);

    const projectRadio = screen.getByRole("radio", { name: /project/i });
    await user.click(projectRadio);
    expect(projectRadio).toHaveAttribute("aria-checked", "true");

    const saveButton = screen.getByRole("button", { name: /save changes/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(updateSkill).toHaveBeenCalledWith(
        "skill-1",
        expect.objectContaining({
          name: "ai-sdk-nextjs",
          displayName: "AI SDK Nextjs",
          projectId: null,
          assistantId: null,
        }),
      );
    });
  });

  it("exports skill via export tab button", async () => {
    const user = userEvent.setup();
    currentQueryTab = "export";
    const { exportSkillZip } = await import("@/actions/skills/export-skill");
    vi.mocked(exportSkillZip).mockResolvedValueOnce({
      ok: true,
      value: {
        filename: "ai-sdk-nextjs.zip",
        base64: "UEsDBBQAAAAIA==...",
      },
    });

    render(<SkillDetailPage />);

    const downloadButton = screen.getByRole("button", {
      name: /download zip bundle/i,
    });
    await user.click(downloadButton);

    await waitFor(() => {
      expect(exportSkillZip).toHaveBeenCalledWith("skill-1");
    });
  });

  it("deletes skill via delete dialog in Danger Zone tab", async () => {
    const user = userEvent.setup();
    currentQueryTab = "danger";
    vi.mocked(deleteSkill).mockResolvedValueOnce({
      ok: true,
      value: undefined,
    });

    render(<SkillDetailPage />);

    const deleteBtn = screen.getByRole("button", { name: /delete skill/i });
    await user.click(deleteBtn);

    const confirmBtn = screen.getByRole("button", { name: "Delete" });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(deleteSkill).toHaveBeenCalledWith("skill-1");
      expect(mockPush).toHaveBeenCalledWith("/settings/skills");
    });
  });
});
