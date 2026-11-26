import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EntityOptions } from "@/components/shared/entity-options";

const mockUsePathname = vi.hoisted(() => vi.fn());
const mockUseKnowledgebases = vi.hoisted(() => vi.fn());
const mockStore = vi.hoisted(() => ({
  chats: {} as Record<string, { id: string }>,
  projects: [] as Array<{ id: string }>,
  agents: [] as Array<{ id: string }>,
}));

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
  unstable_rethrow: vi.fn(),
}));

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: (s: typeof mockStore) => unknown) =>
    selector(mockStore),
}));

vi.mock("@/hooks/use-knowledgebases", () => ({
  useKnowledgebases: mockUseKnowledgebases,
}));

vi.mock("@/components/chat/chat-options", () => ({
  ChatOptions: ({ chat }: { chat: { id: string } }) => (
    <div data-testid="chat-options">{chat.id}</div>
  ),
}));
vi.mock("@/components/project/project-options", () => ({
  ProjectOptions: ({ project }: { project: { id: string } }) => (
    <div data-testid="project-options">{project.id}</div>
  ),
}));
vi.mock("@/components/agent/agent-options", () => ({
  AgentOptions: ({ agent }: { agent: { id: string } }) => (
    <div data-testid="agent-options">{agent.id}</div>
  ),
}));
vi.mock("@/components/knowledgebase/knowledgebase-options", () => ({
  KnowledgebaseOptions: ({ kb }: { kb: { id: string } }) => (
    <div data-testid="kb-options">{kb.id}</div>
  ),
}));

describe("EntityOptions", () => {
  it("returns null for root or unmatched paths and renders matching entity options", () => {
    mockUseKnowledgebases.mockReturnValue({
      normalizedKnowledgebases: [{ id: "kb-1" }],
    });
    mockStore.chats = { "c-1": { id: "c-1" } };
    mockStore.projects = [{ id: "p-1" }];
    mockStore.agents = [{ id: "a-1" }];

    mockUsePathname.mockReturnValue("/");
    const { container, rerender } = render(<EntityOptions />);
    expect(container.firstChild).toBeNull();

    mockUsePathname.mockReturnValue("/chat/c-1");
    rerender(<EntityOptions />);
    expect(screen.getByTestId("chat-options")).toHaveTextContent("c-1");

    mockUsePathname.mockReturnValue("/projects/p-1");
    rerender(<EntityOptions />);
    expect(screen.getByTestId("project-options")).toHaveTextContent("p-1");

    mockUsePathname.mockReturnValue("/agents/a-1");
    rerender(<EntityOptions />);
    expect(screen.getByTestId("agent-options")).toHaveTextContent("a-1");

    mockUsePathname.mockReturnValue("/knowledgebases/kb-1");
    rerender(<EntityOptions />);
    expect(screen.getByTestId("kb-options")).toHaveTextContent("kb-1");

    mockUsePathname.mockReturnValue("/unknown/xyz");
    rerender(<EntityOptions />);
    expect(screen.queryByTestId("kb-options")).not.toBeInTheDocument();
  });
});
