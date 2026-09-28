import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ROUTES } from "@/config/routes";

vi.mock("@/actions/chats/list-chats", () => ({
  listChats: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    useSession: vi.fn(() => ({
      data: {
        user: { name: "Test User", email: "test@example.com" },
      },
    })),
    signOut: vi.fn(),
  },
}));

vi.mock("@/hooks/chat/use-create-chat", () => ({
  useCreateChat: vi.fn(() => vi.fn()),
}));

vi.mock("@/components/sidebar/sidebar-user-footer", () => ({
  SidebarUserFooter: () => <div data-testid="sidebar-user-footer">User Footer</div>,
}));

describe("AppSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Workflows and Running Jobs navigation buttons in order", async () => {
    await act(async () => {
      render(
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>,
      );
    });

    const workflowsLink = screen.getByRole("link", { name: /workflows/i });
    expect(workflowsLink).toBeInTheDocument();
    expect(workflowsLink).toHaveAttribute("href", ROUTES.WORKFLOWS.path);

    const runningJobsLink = screen.getByRole("link", { name: /running jobs/i });
    expect(runningJobsLink).toBeInTheDocument();
    expect(runningJobsLink).toHaveAttribute("href", ROUTES.JOBS.path);

    // Verify ordering: Running Jobs should appear directly after Workflows
    const allLinks = screen.getAllByRole("link");
    const workflowsIndex = allLinks.findIndex((el) => el.getAttribute("href") === ROUTES.WORKFLOWS.path);
    const jobsIndex = allLinks.findIndex((el) => el.getAttribute("href") === ROUTES.JOBS.path);

    expect(workflowsIndex).toBeGreaterThan(-1);
    expect(jobsIndex).toBe(workflowsIndex + 1);
  });
});
