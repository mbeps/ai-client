import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock ResizeObserver for Radix UI / Tabs
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
      aria-label="prompt-content-editor"
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
let currentParamId = "prompt-1";
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

vi.mock("@/actions/prompts/update-prompt", () => ({
  updatePrompt: vi.fn(),
}));

vi.mock("@/actions/prompts/delete-prompt", () => ({
  deletePrompt: vi.fn(),
}));

import { deletePrompt } from "@/actions/prompts/delete-prompt";
import { updatePrompt } from "@/actions/prompts/update-prompt";
import PromptDetailPage from "@/app/settings/prompts/[id]/page";
import { useAppStore } from "@/lib/store/use-app-store";

describe("PromptDetailPage", () => {
  const mockPrompt = {
    id: "prompt-1",
    userId: "user-1",
    title: "Markdown Converter",
    shortcut: "markdown-converter",
    content: "Convert text into markdown",
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
    currentParamId = "prompt-1";
    currentQueryTab = "details";
    useAppStore.setState({
      prompts: [mockPrompt],
      projects: mockProjects,
      assistants: mockAssistants,
    });
  });

  it("renders tabs correctly with Prompt Details active initially", async () => {
    render(<PromptDetailPage />);

    expect(screen.getByRole("tab", { name: /details/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^prompt$/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /scope/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /danger zone/i })).toBeInTheDocument();

    expect(screen.getByDisplayValue("Markdown Converter")).toBeInTheDocument();
    expect(screen.getByDisplayValue("markdown-converter")).toBeInTheDocument();
  });

  it("switches tabs to Prompt Content and Scope", async () => {
    const user = userEvent.setup();
    render(<PromptDetailPage />);

    // Click on Prompt content tab trigger
    const promptTabTrigger = screen.getByRole("tab", { name: /^prompt$/i });
    await user.click(promptTabTrigger);
    expect(mockSetTab).toHaveBeenCalledWith("content");

    // Click on Scope tab trigger
    const scopeTabTrigger = screen.getByRole("tab", { name: /scope/i });
    await user.click(scopeTabTrigger);
    expect(mockSetTab).toHaveBeenCalledWith("scope");
  });

  it("calls updatePrompt action when saving", async () => {
    const user = userEvent.setup();
    vi.mocked(updatePrompt).mockResolvedValueOnce({
      ok: true,
      value: { ...mockPrompt, title: "Markdown Converter Updated" },
    } as any);

    render(<PromptDetailPage />);

    const titleInput = screen.getByDisplayValue("Markdown Converter");
    await user.clear(titleInput);
    await user.type(titleInput, "Markdown Converter Updated");

    const saveButtons = screen.getAllByRole("button", { name: /save changes/i });
    await user.click(saveButtons[0]);

    await waitFor(() => {
      expect(updatePrompt).toHaveBeenCalledWith(
        "prompt-1",
        expect.objectContaining({
          title: "Markdown Converter Updated",
          shortcut: "markdown-converter",
          content: "Convert text into markdown",
        }),
      );
    });
  });

  it("opens delete confirm dialog and deletes prompt", async () => {
    const user = userEvent.setup();
    currentQueryTab = "danger";
    vi.mocked(deletePrompt).mockResolvedValueOnce({ ok: true, value: undefined } as any);

    render(<PromptDetailPage />);

    const deleteBtn = screen.getByRole("button", { name: /delete prompt/i });
    await user.click(deleteBtn);

    const confirmBtn = screen.getByRole("button", { name: "Delete" });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(deletePrompt).toHaveBeenCalledWith("prompt-1");
      expect(mockPush).toHaveBeenCalledWith("/settings/prompts");
    });
  });
});
