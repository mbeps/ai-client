import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewAssistantPage from "@/app/(main)/assistants/new/page";
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

const mockCreateAssistant = vi.fn();
vi.mock("@/actions/assistants/create-assistant", () => ({
  createAssistant: (...args: any[]) => mockCreateAssistant(...args),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
  },
}));

const mockLoadAssistants = vi.fn();
vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({
      mcpServers: [],
      skills: [],
      prompts: [],
      loadAssistants: mockLoadAssistants,
    }),
}));

vi.mock("@/hooks/use-resource-hydration", () => ({
  useResourceHydration: () => ({ isLoading: false }),
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

describe("NewAssistantPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentTab = "settings";
  });

  it("renders page header and navigation back link", () => {
    render(<NewAssistantPage />);

    expect(screen.getByText("New Assistant")).toBeInTheDocument();
    const backLink = screen.getByRole("link", { name: /back to assistants/i });
    expect(backLink).toHaveAttribute("href", ROUTES.ASSISTANTS.path);
    const cancelLink = screen.getByRole("link", { name: /cancel/i });
    expect(cancelLink).toHaveAttribute("href", ROUTES.ASSISTANTS.path);
  });

  it("shows an error toast if name is empty upon submission", async () => {
    const user = userEvent.setup();
    render(<NewAssistantPage />);

    // Click the top Create Assistant button
    const createButtons = screen.getAllByRole("button", {
      name: /create assistant/i,
    });
    await user.click(createButtons[0]);

    expect(mockToastError).toHaveBeenCalledWith("Assistant name is required");
    expect(mockCreateAssistant).not.toHaveBeenCalled();
  });

  it("successfully creates assistant and redirects to detail page", async () => {
    const user = userEvent.setup();
    mockCreateAssistant.mockResolvedValueOnce({
      ok: true,
      value: { id: "asst-new-123", name: "Doc Writer" },
    });

    render(<NewAssistantPage />);

    const nameInput = screen.getByPlaceholderText("Assistant name");
    await user.type(nameInput, "Doc Writer");

    const descInput = screen.getByPlaceholderText("Describe this assistant...");
    await user.type(descInput, "Writes great docs");

    const createButtons = screen.getAllByRole("button", {
      name: /create assistant/i,
    });
    await user.click(createButtons[0]);

    await waitFor(() => {
      expect(mockCreateAssistant).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Doc Writer",
          description: "Writes great docs",
          skillMode: "dynamic",
          promptMode: "all",
        }),
      );
    });

    expect(mockToastSuccess).toHaveBeenCalledWith("Assistant created");
    expect(mockLoadAssistants).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith(ROUTES.ASSISTANTS.detail("asst-new-123"));
  });

  it("displays server error toast when createAssistant fails", async () => {
    const user = userEvent.setup();
    mockCreateAssistant.mockResolvedValueOnce({
      ok: false,
      error: { message: "Name already taken" },
    });

    render(<NewAssistantPage />);

    const nameInput = screen.getByPlaceholderText("Assistant name");
    await user.type(nameInput, "Duplicate");

    const createButtons = screen.getAllByRole("button", {
      name: /create assistant/i,
    });
    await user.click(createButtons[0]);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Name already taken");
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});
