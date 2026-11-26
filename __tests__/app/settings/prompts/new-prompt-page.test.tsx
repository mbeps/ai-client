import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "@/config/routes";

const {
  mockPush,
  mockSearchParamsGet,
  mockLoadPrompts,
  mockCreatePrompt,
  mockToast,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockSearchParamsGet: vi.fn(),
  mockLoadPrompts: vi.fn(),
  mockCreatePrompt: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockSearchParamsGet }),
  unstable_rethrow: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

vi.mock("@/hooks/use-resource-hydration", () => ({
  useResourceHydration: vi.fn(),
}));

vi.mock("@/actions/prompts/create-prompt", () => ({
  createPrompt: mockCreatePrompt,
}));

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: (s: any) => any) =>
    selector({ loadPrompts: mockLoadPrompts }),
}));

vi.mock("@/components/prompt/prompt-form", () => ({
  PromptForm: ({
    onSubmit,
    onCancel,
    defaultProjectId,
    defaultAssistantId,
  }: {
    onSubmit: (v: any) => void;
    onCancel: () => void;
    defaultProjectId?: string;
    defaultAssistantId?: string;
  }) => (
    <div
      data-testid="prompt-form"
      data-project={defaultProjectId ?? ""}
      data-assistant={defaultAssistantId ?? ""}
    >
      <button
        type="button"
        onClick={() =>
          onSubmit({
            title: " My Prompt ",
            shortcut: " my-prompt ",
            content: " Hello ",
            projectIds: ["p1"],
            assistantIds: ["a1"],
          })
        }
      >
        Submit
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ),
}));

import NewPromptPage from "@/app/settings/prompts/new/page";

describe("NewPromptPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsGet.mockReturnValue(null);
    mockLoadPrompts.mockResolvedValue(undefined);
  });

  it("reads projectId and agentId/assistantId from searchParams", () => {
    mockSearchParamsGet.mockImplementation((key: string) => {
      if (key === "projectId") return "proj-1";
      if (key === "agentId") return "agent-1";
      return null;
    });

    const { rerender } = render(<NewPromptPage />);
    expect(screen.getByTestId("prompt-form")).toHaveAttribute("data-project", "proj-1");
    expect(screen.getByTestId("prompt-form")).toHaveAttribute("data-assistant", "agent-1");

    mockSearchParamsGet.mockImplementation((key: string) => {
      if (key === "assistantId") return "asst-2";
      return null;
    });
    rerender(<NewPromptPage />);
    expect(screen.getByTestId("prompt-form")).toHaveAttribute("data-assistant", "asst-2");
  });

  it("creates prompt, reloads prompts, and redirects on success", async () => {
    mockCreatePrompt.mockResolvedValue({ ok: true, value: { id: "p-1" } });
    render(<NewPromptPage />);

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(mockCreatePrompt).toHaveBeenCalledWith({
        title: "My Prompt",
        shortcut: "my-prompt",
        content: "Hello",
        projectIds: ["p1"],
        assistantIds: ["a1"],
      });
      expect(mockToast.success).toHaveBeenCalledWith("Prompt created");
      expect(mockLoadPrompts).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith(ROUTES.SETTINGS.PROMPTS.path);
    });
  });

  it("shows error toast when createPrompt returns !ok with message and fallback", async () => {
    mockCreatePrompt.mockResolvedValueOnce({
      ok: false,
      error: { message: "Shortcut exists" },
    });
    render(<NewPromptPage />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Shortcut exists");
    });

    mockCreatePrompt.mockResolvedValueOnce({
      ok: false,
      error: { message: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to create prompt");
    });
  });

  it("shows error toast when createPrompt throws Error or non-Error", async () => {
    mockCreatePrompt.mockRejectedValueOnce(new Error("Server error"));
    render(<NewPromptPage />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Server error");
    });

    mockCreatePrompt.mockRejectedValueOnce("unexpected");
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to create prompt");
    });
  });

  it("navigates back on cancel", () => {
    render(<NewPromptPage />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockPush).toHaveBeenCalledWith(ROUTES.SETTINGS.PROMPTS.path);
  });
});
