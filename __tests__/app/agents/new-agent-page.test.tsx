import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewAgentPage from "@/app/(main)/agents/new/page";

const mockPush = vi.hoisted(() => vi.fn());
const mockSetTab = vi.hoisted(() => vi.fn());
const mockLoadAgents = vi.hoisted(() => vi.fn());
const mockCreateAgent = vi.hoisted(() => vi.fn());
const mockToastSuccess = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}));
vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: () => ({ withOptions: () => ({}) }),
  },
  useQueryState: () => ["settings", mockSetTab],
}));
vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));
vi.mock("@/components/shared/markdown-tab-editor", () => ({
  MarkdownTabEditor: ({ value, onChange, placeholder }: any) => (
    <textarea
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));
vi.mock("@/actions/agents/create-agent", () => ({
  createAgent: mockCreateAgent,
}));
vi.mock("@/actions/knowledgebases/list-knowledgebases", () => ({
  listKnowledgebases: vi.fn(async () => ({ ok: true, value: [] })),
}));
vi.mock("@/hooks/use-resource-hydration", () => ({
  useResourceHydration: vi.fn(() => ({ isLoading: false })),
}));
vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: vi.fn(() => ({ models: [], isLoading: false })),
}));
vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: vi.fn((selector: any) =>
    selector({
      agents: [],
      mcpServers: [],
      skills: [],
      prompts: [],
      loadAgents: mockLoadAgents,
    }),
  ),
}));

describe("NewAgentPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new agent and navigates to its detail page", async () => {
    mockCreateAgent.mockResolvedValueOnce({
      ok: true,
      value: { id: "new-agent-1" },
    });

    render(<NewAgentPage />);

    const nameInput = screen.getByPlaceholderText("Agent name");
    fireEvent.change(nameInput, { target: { value: "Code Reviewer" } });

    fireEvent.click(
      screen.getAllByRole("button", { name: /create agent/i })[0],
    );

    await waitFor(() => {
      expect(mockCreateAgent).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Code Reviewer" }),
      );
      expect(mockLoadAgents).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/agents/new-agent-1");
    });
  });
});
