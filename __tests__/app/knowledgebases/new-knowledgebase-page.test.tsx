import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewKnowledgebasePage from "@/app/(main)/knowledgebases/new/page";
import { ROUTES } from "@/config/routes";

const mockPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockCreateKnowledgebase = vi.hoisted(() => vi.fn());
vi.mock("@/actions/knowledgebases/create-knowledgebase", () => ({
  createKnowledgebase: mockCreateKnowledgebase,
}));

const mockToastSuccess = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

const mockUseUserModels = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: mockUseUserModels,
}));

describe("NewKnowledgebasePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUserModels.mockReturnValue({
      models: [{ id: "emb-1", label: "text-embedding-3-small" }],
      isLoading: false,
    });
  });

  it("renders page header and navigation links", () => {
    render(<NewKnowledgebasePage />);

    expect(screen.getByText("New Knowledgebase")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to knowledgebases/i }),
    ).toHaveAttribute("href", ROUTES.KNOWLEDGEBASES.path);
    expect(screen.getByRole("link", { name: /cancel/i })).toHaveAttribute(
      "href",
      ROUTES.KNOWLEDGEBASES.path,
    );
  });

  it("creates knowledgebase and redirects to detail page", async () => {
    const user = userEvent.setup();
    mockCreateKnowledgebase.mockResolvedValueOnce({
      ok: true,
      value: { id: "kb-new-1", name: "Project Docs" },
    });

    render(<NewKnowledgebasePage />);

    await user.type(
      screen.getByPlaceholderText("My Knowledgebase"),
      "Project Docs",
    );
    await user.type(
      screen.getByPlaceholderText("What is this knowledgebase about?"),
      "Architecture notes",
    );
    await user.click(
      screen.getByRole("button", { name: /create knowledgebase/i }),
    );

    await waitFor(() => {
      expect(mockCreateKnowledgebase).toHaveBeenCalledWith({
        name: "Project Docs",
        description: "Architecture notes",
      });
    });

    expect(mockToastSuccess).toHaveBeenCalledWith("Knowledgebase created");
    expect(mockPush).toHaveBeenCalledWith(
      ROUTES.KNOWLEDGEBASES.detail("kb-new-1"),
    );
  });

  it("displays error toast when server action returns ok: false", async () => {
    const user = userEvent.setup();
    mockCreateKnowledgebase.mockResolvedValueOnce({
      ok: false,
      error: { code: "INTERNAL", message: "No embedding provider configured" },
    });

    render(<NewKnowledgebasePage />);

    await user.type(screen.getByPlaceholderText("My Knowledgebase"), "My KB");
    await user.click(
      screen.getByRole("button", { name: /create knowledgebase/i }),
    );

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "No embedding provider configured",
      );
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("displays error toast when createKnowledgebase throws", async () => {
    const user = userEvent.setup();
    mockCreateKnowledgebase.mockRejectedValueOnce(new Error("Network error"));

    render(<NewKnowledgebasePage />);

    await user.type(screen.getByPlaceholderText("My Knowledgebase"), "My KB");
    await user.click(
      screen.getByRole("button", { name: /create knowledgebase/i }),
    );

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Failed to create knowledgebase",
      );
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows alert banner and disables submit when no embedding models are configured", () => {
    mockUseUserModels.mockReturnValue({
      models: [],
      isLoading: false,
    });

    render(<NewKnowledgebasePage />);

    expect(
      screen.getByText(
        "No embedding models configured. Please set up a provider with embedding support to create knowledgebases.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create knowledgebase/i }),
    ).toBeDisabled();
  });
});
