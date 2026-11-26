import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/shared/error-page", () => ({
  ErrorPage: ({ heading, linkLabel }: { heading: string; linkLabel: string }) => (
    <div data-testid="error-page">
      <span>{heading}</span>
      <span>{linkLabel}</span>
    </div>
  ),
}));

vi.mock("@/components/shared/authenticated-layout", () => ({
  AuthenticatedLayout: ({
    children,
    sidebar,
    headerExtra,
  }: {
    children: React.ReactNode;
    sidebar: React.ReactNode;
    headerExtra: React.ReactNode;
  }) => (
    <div data-testid="authenticated-layout">
      {sidebar}
      {headerExtra}
      {children}
    </div>
  ),
}));

vi.mock("@/components/sidebar/app-sidebar", () => ({
  AppSidebar: () => <div data-testid="app-sidebar" />,
}));

vi.mock("@/components/shared/entity-options", () => ({
  EntityOptions: () => <div data-testid="entity-options" />,
}));

vi.mock("@/components/skeletons/card-grid-skeleton", () => ({
  CardGridSkeleton: () => <div data-testid="card-grid-skeleton" />,
}));

vi.mock("@/components/skeletons/chat-skeleton", () => ({
  ChatSkeleton: () => <div data-testid="chat-skeleton" />,
}));

vi.mock("@/components/skeletons/list-skeleton", () => ({
  ListSkeleton: () => <div data-testid="list-skeleton" />,
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

import MainError from "@/app/(main)/error";
import MainLayout from "@/app/(main)/layout";
import MainLoading from "@/app/(main)/loading";
import AgentChatLoading from "@/app/(main)/agents/[id]/[chatId]/loading";
import ChatsLoading from "@/app/(main)/chats/loading";
import ChatError from "@/app/(main)/chats/[id]/error";
import ChatLoading from "@/app/(main)/chats/[id]/loading";
import JobsLoading from "@/app/(main)/jobs/loading";
import ProjectChatLoading from "@/app/(main)/projects/[id]/[chatId]/loading";
import SearchLoading from "@/app/(main)/search/loading";
import WorkflowsLoading from "@/app/(main)/workflows/loading";

describe("app/(main) shell pages", () => {
  it("renders MainError", () => {
    render(<MainError error={new Error("boom")} reset={vi.fn()} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Go home")).toBeInTheDocument();
  });

  it("renders ChatError", () => {
    render(<ChatError error={new Error("boom")} reset={vi.fn()} />);
    expect(screen.getByText("Failed to load chat")).toBeInTheDocument();
    expect(screen.getByText("Back to chats")).toBeInTheDocument();
  });

  it("renders MainLayout with sidebar, headerExtra, and children", () => {
    render(
      <MainLayout>
        <div data-testid="child-content">hello</div>
      </MainLayout>,
    );
    expect(screen.getByTestId("authenticated-layout")).toBeInTheDocument();
    expect(screen.getByTestId("app-sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("entity-options")).toBeInTheDocument();
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("renders all loading skeletons", () => {
    const { rerender } = render(<MainLoading />);
    expect(screen.getByTestId("card-grid-skeleton")).toBeInTheDocument();

    rerender(<AgentChatLoading />);
    expect(screen.getByTestId("chat-page-skeleton")).toBeInTheDocument();

    rerender(<ChatsLoading />);
    expect(screen.getByTestId("card-grid-skeleton")).toBeInTheDocument();

    rerender(<ChatLoading />);
    expect(screen.getByTestId("chat-page-skeleton")).toBeInTheDocument();

    rerender(<JobsLoading />);
    expect(screen.getByTestId("table-list-skeleton")).toBeInTheDocument();

    rerender(<ProjectChatLoading />);
    expect(screen.getByTestId("chat-page-skeleton")).toBeInTheDocument();

    rerender(<SearchLoading />);
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);

    rerender(<WorkflowsLoading />);
    expect(screen.getByTestId("card-grid-skeleton")).toBeInTheDocument();
  });
});
