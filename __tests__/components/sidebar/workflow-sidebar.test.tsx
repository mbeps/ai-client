import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkflowSidebar } from "@/components/sidebar/workflow-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ROUTES } from "@/config/routes";

const mockUsePathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: {
          id: "u-1",
          name: "Test User",
          email: "test@example.com",
        },
      },
    }),
    signOut: vi.fn(),
  },
}));

vi.mock("@/lib/store", () => ({
  useAppStore: {
    getState: () => ({
      resetEntityState: vi.fn(),
      resetChatState: vi.fn(),
    }),
  },
}));

vi.mock("@/hooks/use-resource-hydration", () => ({
  hydratedResources: {
    clear: vi.fn(),
  },
}));

describe("WorkflowSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue(ROUTES.WORKFLOWS.path);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders all workflow navigation items including Running Jobs", () => {
    render(
      <TooltipProvider>
        <SidebarProvider>
          <WorkflowSidebar />
        </SidebarProvider>
      </TooltipProvider>,
    );

    // Back to home button
    const backLink = screen.getByRole("link", { name: /back to home/i });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute("href", ROUTES.HOME.path);

    // All Workflows
    const allWorkflowsLink = screen.getByRole("link", { name: /all workflows/i });
    expect(allWorkflowsLink).toBeInTheDocument();
    expect(allWorkflowsLink).toHaveAttribute("href", ROUTES.WORKFLOWS.path);

    // Translation
    const translationLink = screen.getByRole("link", { name: /translation/i });
    expect(translationLink).toBeInTheDocument();
    expect(translationLink).toHaveAttribute("href", ROUTES.WORKFLOWS.TRANSLATION.path);

    // Step-by-Step Automations (Transform)
    const transformLink = screen.getByRole("link", {
      name: new RegExp(ROUTES.WORKFLOWS.TRANSFORM.name, "i"),
    });
    expect(transformLink).toBeInTheDocument();
    expect(transformLink).toHaveAttribute("href", ROUTES.WORKFLOWS.TRANSFORM.path);
  });

  it("highlights the active link based on current pathname", () => {
    mockUsePathname.mockReturnValue(ROUTES.WORKFLOWS.path);

    render(
      <TooltipProvider>
        <SidebarProvider>
          <WorkflowSidebar />
        </SidebarProvider>
      </TooltipProvider>,
    );

    const allWorkflowsLink = screen.getByRole("link", { name: /all workflows/i });
    const translationLink = screen.getByRole("link", { name: /translation/i });

    expect(allWorkflowsLink).toHaveAttribute("data-active", "true");
    expect(translationLink).toHaveAttribute("data-active", "false");
  });

  it("highlights another active link when pathname changes", () => {
    mockUsePathname.mockReturnValue(ROUTES.WORKFLOWS.TRANSLATION.path);

    render(
      <TooltipProvider>
        <SidebarProvider>
          <WorkflowSidebar />
        </SidebarProvider>
      </TooltipProvider>,
    );

    const translationLink = screen.getByRole("link", { name: /translation/i });
    const allWorkflowsLink = screen.getByRole("link", { name: /all workflows/i });

    expect(translationLink).toHaveAttribute("data-active", "true");
    expect(allWorkflowsLink).toHaveAttribute("data-active", "false");
  });

  it("renders user footer within workflow sidebar", () => {
    render(
      <TooltipProvider>
        <SidebarProvider>
          <WorkflowSidebar />
        </SidebarProvider>
      </TooltipProvider>,
    );

    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });
});
