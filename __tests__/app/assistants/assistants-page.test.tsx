import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AssistantsPage from "@/app/(main)/assistants/page";
import { ROUTES } from "@/config/routes";
import type { Assistant } from "@/types/assistant/assistant";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const mockLoadAssistants = vi.fn();

const mockAssistants: Assistant[] = [
  {
    id: "asst-1",
    userId: "user-1",
    name: "Code Expert",
    description: "Assists with coding tasks",
    prompt: "You are a code expert",
    tools: [],
    avatar: null,
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
      assistants: mockAssistants,
      loadAssistants: mockLoadAssistants,
      loadError: null,
    }),
}));

describe("AssistantsPage", () => {
  it("renders page title and Create Assistant link pointing to ROUTES.ASSISTANTS.new", () => {
    render(<AssistantsPage />);

    expect(screen.getByText("Assistants")).toBeInTheDocument();
    const createLink = screen.getByRole("link", { name: /create assistant/i });
    expect(createLink).toBeInTheDocument();
    expect(createLink).toHaveAttribute("href", ROUTES.ASSISTANTS.new);
  });
});
